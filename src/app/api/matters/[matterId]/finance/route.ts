import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmModule, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveFirmProviderCredentials } from "@/lib/tenant-integrations.server";
import { PaymentService, type MobileMoneyProvider } from "@/lib/payment-service/pawapay";

type Context = { params: Promise<{ matterId: string }> };

async function runtime(request: Request, matterId: string) {
  const scope = await resolveRequestScope(request);
  await assertFirmModule({ scope, module: "finance" });
  await assertMatterPermission({ scope, matterId, permission: "viewBilling" });
  if (!scope.firmId) throw new Error("Authenticated firm context is required.");
  const firmId = scope.firmId;
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const matter = await supabase.from("matters").select("id,firm_id,title,client_name").eq("id", matterId).eq("firm_id", firmId).single();
  if (matter.error) throw new Error(matter.error.message);
  return { scope, firmId, supabase, matter: matter.data };
}

async function summary(rt: Awaited<ReturnType<typeof runtime>>, matterId: string) {
  const { supabase } = rt;
  const [invoices,payments,expenses,receipts,recons,statements] = await Promise.all([
    supabase.from("invoices").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
    supabase.from("matter_payments").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
    supabase.from("matter_disbursements").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
    supabase.from("payment_receipts").select("*").eq("matter_id",matterId).order("issued_at",{ascending:false}),
    supabase.from("finance_reconciliation_reviews").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
    supabase.from("client_financial_statements").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(10),
  ]);
  for (const r of [invoices,payments,expenses,receipts,recons,statements]) if(r.error) throw new Error(r.error.message);
  const inv=invoices.data??[]; const pay=payments.data??[]; const exp=expenses.data??[];
  const invoiced=inv.reduce((s,x)=>s+Number(x.amount_xaf||0),0);
  const paid=pay.filter(x=>x.status==="Confirmed").reduce((s,x)=>s+Number(x.amount_xaf||0),0);
  const recoverable=exp.filter(x=>x.client_recoverable!==false && !["Cancelled"].includes(String(x.status))).reduce((s,x)=>s+Number(x.amount_xaf||0),0);
  return { invoices:inv,payments:pay,expenses:exp,receipts:receipts.data??[],reconciliations:recons.data??[],statements:statements.data??[],totals:{invoiced,paid,outstanding:Math.max(0,invoiced-paid),recoverableExpenses:recoverable} };
}

export async function GET(request:Request,context:Context){
 try{const {matterId}=await context.params;const rt=await runtime(request,matterId);return NextResponse.json({success:true,matter:rt.matter,...await summary(rt,matterId)});}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load finance."},{status:403});}
}

export async function POST(request:Request,context:Context){
 try{
  const {matterId}=await context.params; const rt=await runtime(request,matterId); const {scope,firmId,supabase,matter}=rt; const body=await request.json(); const action=String(body.action||"");
  if(!scope.actorLawyerId) throw new Error("A linked lawyer profile is required.");
  if(action==="createInvoice"){
    await assertMatterPermission({scope,matterId,permission:"viewBilling"});
    const amount=Number(body.amountXaf);
    if(!Number.isSafeInteger(amount)||amount<=0)return NextResponse.json({success:false,error:"Valid positive invoice amount required."},{status:400});
    const key=String(body.idempotencyKey??"");
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(key))return NextResponse.json({success:false,error:"Unique request key is required."},{status:400});
    const invoiced=await supabase.rpc("tsidek_issue_matter_invoice",{
      p_firm_id:firmId,p_matter_id:matterId,p_actor_id:scope.actorLawyerId,
      p_amount_xaf:amount,p_description:String(body.description??"Legal fees"),
      p_due_at:body.dueDate||null,p_idempotency_key:key
    });
    if(invoiced.error)throw new Error(invoiced.error.message);
  } else if(action==="requestMobilePayment"){
    const amount=Math.round(Number(body.amountXaf||0)); if(amount<=0)return NextResponse.json({success:false,error:"Payment amount must be positive."},{status:400});
    const phoneNumber=String(body.phoneNumber||"").replace(/\D/g,""); if(phoneNumber.length<9)return NextResponse.json({success:false,error:"A valid client phone number is required."},{status:400});
    const provider=String(body.provider||"").toUpperCase() as MobileMoneyProvider; if(!["MTN","ORANGE"].includes(provider))return NextResponse.json({success:false,error:"Provider must be MTN or ORANGE."},{status:400});
    const tenantCredentials=await resolveFirmProviderCredentials(firmId,"pawapay");
    const result=await PaymentService.initiateMobilePayment({amount,currency:"XAF",phoneNumber,provider,matterId,description:String(body.description||"Legal fee payment"),clientReferenceId:body.invoiceId?`INV-${String(body.invoiceId).slice(0,36)}`:`MATTER-${matterId}`},tenantCredentials?{apiToken:tenantCredentials.apiToken,apiKey:tenantCredentials.apiKey,environment:tenantCredentials.environment,apiUrl:tenantCredentials.apiUrl}:undefined);
    if(!result.configured)return NextResponse.json({success:false,error:result.providerMessage},{status:503});
    const payment=await supabase.from("matter_payments").insert({firm_id:firmId,matter_id:matterId,invoice_id:body.invoiceId||null,amount_xaf:amount,currency:"XAF",provider:"PAWAPAY",phone_number:phoneNumber,payment_kind:String(body.paymentKind||"Invoice payment"),account_type:String(body.accountType||"Firm operating"),status:"Pending",provider_reference:result.transactionId,provider_status:result.status,provider_payload:{initiation_status:result.status,message:result.providerMessage,mobile_provider:provider},requested_at:new Date().toISOString(),note:body.note||null,created_by:scope.actorLawyerId}).select("*").single(); if(payment.error)throw new Error(payment.error.message);
  } else if(action==="recordPayment"){
    const amount=Number(body.amountXaf),provider=String(body.provider??"CASH").toUpperCase();
    if(!Number.isSafeInteger(amount)||amount<=0)return NextResponse.json({success:false,error:"Positive payment amount required."},{status:400});
    if(!["CASH","BANK","MTN","ORANGE","WAVE"].includes(provider))return NextResponse.json({success:false,error:"Unsupported provider."},{status:400});
    const evidenceDocumentId=String(body.evidenceDocumentId??"");
    const key=String(body.idempotencyKey??"");
    const attestation=String(body.attestation??"").trim();
    const reference=String(body.providerReference??"").trim();
    if(!/^[0-9a-f-]{36}$/i.test(evidenceDocumentId)||!/^[0-9a-f-]{36}$/i.test(key)||attestation.length<12)
      return NextResponse.json({success:false,error:"Stored payment proof, unique request key, and reviewer attestation are required."},{status:400});
    if(provider!=="CASH"&&reference.length<5)return NextResponse.json({success:false,error:"External payment reference required."},{status:400});
    const recorded=await supabase.rpc("tsidek_record_evidenced_payment",{
      p_firm_id:firmId,p_matter_id:matterId,p_actor_id:scope.actorLawyerId,
      p_invoice_id:body.invoiceId||null,p_amount_xaf:amount,p_provider:provider,
      p_reference:reference,p_account_type:String(body.accountType??"Firm operating"),
      p_evidence_document_id:evidenceDocumentId,p_idempotency_key:key,p_attestation:attestation
    });
    if(recorded.error)throw new Error(recorded.error.message);
  } else if(action==="recordExpense"){
    const amount=Math.round(Number(body.amountXaf||0)); if(amount<=0)return NextResponse.json({success:false,error:"Expense amount must be positive."},{status:400});
    const expense=await supabase.from("matter_disbursements").insert({firm_id:firmId,matter_id:matterId,amount_xaf:amount,category:String(body.category||"Other"),payee:String(body.payee||"Unknown payee"),status:"Paid",client_recoverable:body.clientRecoverable!==false,note:body.note||null,approved_by:scope.actorLawyerId,paid_at:new Date().toISOString(),created_by:scope.actorLawyerId}).select("*").single();if(expense.error)throw new Error(expense.error.message);
    const ledger=await supabase.from("finance_ledger_entries").upsert({firm_id:firmId,matter_id:matterId,entry_type:"DISBURSEMENT",source_table:"matter_disbursements",source_id:expense.data.id,amount_xaf:amount,direction:"DEBIT",account_bucket:"OPERATING",status:"POSTED",description:`${expense.data.category}: ${expense.data.payee}`,created_by:scope.actorLawyerId},{onConflict:"firm_id,source_table,source_id,entry_type"});if(ledger.error)throw new Error(ledger.error.message);
  } else if(action==="reconcile"){
    const reconciled=await supabase.rpc("tsidek_reconcile_matter_finance",{
      p_firm_id:firmId,p_matter_id:matterId,p_actor_id:scope.actorLawyerId,
      p_notes:String(body.notes??"")
    });
    if(reconciled.error)throw new Error(reconciled.error.message);
  } else if(action==="generateStatement"){
    const current=await summary(rt,matterId);const statement=await supabase.from("client_financial_statements").insert({firm_id:firmId,matter_id:matterId,invoiced_xaf:current.totals.invoiced,paid_xaf:current.totals.paid,outstanding_xaf:current.totals.outstanding,recoverable_expenses_xaf:current.totals.recoverableExpenses,client_funds_xaf:0,generated_by:scope.actorLawyerId,snapshot:{invoices:current.invoices,payments:current.payments,receipts:current.receipts,expenses:current.expenses}}).select("*").single();if(statement.error)throw new Error(statement.error.message);
  } else return NextResponse.json({success:false,error:"Unsupported finance action."},{status:400});
  return NextResponse.json({success:true,...await summary(rt,matterId)});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update finance."},{status:403});}
}
