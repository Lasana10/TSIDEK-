import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ matterId: string }> };

async function runtime(request: Request, matterId: string) {
  const scope = await resolveRequestScope(request);
  await assertMatterPermission({ scope, matterId, permission: "viewBilling" });
  if (!scope.firmId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const matter = await supabase.from("matters").select("id,firm_id,title,client_name").eq("id", matterId).eq("firm_id", scope.firmId).single();
  if (matter.error) throw new Error(matter.error.message);
  return { scope, supabase, matter: matter.data };
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
  const {matterId}=await context.params; const rt=await runtime(request,matterId); const {scope,supabase,matter}=rt; const body=await request.json(); const action=String(body.action||"");
  if(!scope.actorLawyerId) throw new Error("A linked lawyer profile is required.");
  if(action==="createInvoice"){
    await assertMatterPermission({scope,matterId,permission:"viewBilling"});
    const amount=Math.round(Number(body.amountXaf||0)); if(amount<=0)return NextResponse.json({success:false,error:"Invoice amount must be positive."},{status:400});
    const numberResult=await supabase.rpc("next_firm_document_number",{p_firm_id:scope.firmId,p_prefix:"INV",p_table:"invoice"}); if(numberResult.error)throw new Error(numberResult.error.message);
    const invoice=await supabase.from("invoices").insert({firm_id:scope.firmId,matter_id:matterId,invoice_number:numberResult.data,amount_xaf:amount,status:"Sent",due_date:body.dueDate||null,description:String(body.description||"Legal fees"),issued_at:new Date().toISOString(),created_by:scope.actorLawyerId}).select("*").single(); if(invoice.error)throw new Error(invoice.error.message);
    const ledger=await supabase.from("finance_ledger_entries").upsert({firm_id:scope.firmId,matter_id:matterId,entry_type:"INVOICE",source_table:"invoices",source_id:invoice.data.id,amount_xaf:amount,direction:"DEBIT",account_bucket:"RECEIVABLE",status:"POSTED",description:`Invoice ${invoice.data.invoice_number}`,created_by:scope.actorLawyerId},{onConflict:"firm_id,source_table,source_id,entry_type"}); if(ledger.error)throw new Error(ledger.error.message);
  } else if(action==="recordPayment"){
    const amount=Math.round(Number(body.amountXaf||0)); if(amount<=0)return NextResponse.json({success:false,error:"Payment amount must be positive."},{status:400});
    const payment=await supabase.from("matter_payments").insert({firm_id:scope.firmId,matter_id:matterId,invoice_id:body.invoiceId||null,amount_xaf:amount,provider:String(body.provider||"CASH"),payment_kind:String(body.paymentKind||"Invoice payment"),account_type:String(body.accountType||"Firm operating"),status:"Confirmed",provider_reference:body.providerReference||null,note:body.note||null,received_at:new Date().toISOString(),confirmed_by:scope.actorLawyerId,created_by:scope.actorLawyerId}).select("*").single(); if(payment.error)throw new Error(payment.error.message);
    const ledger=await supabase.from("finance_ledger_entries").upsert({firm_id:scope.firmId,matter_id:matterId,entry_type:"PAYMENT",source_table:"matter_payments",source_id:payment.data.id,amount_xaf:amount,direction:"CREDIT",account_bucket:payment.data.account_type==="Client funds"?"CLIENT_FUNDS":"OPERATING",status:"POSTED",description:`Confirmed payment via ${payment.data.provider}`,provider_reference:payment.data.provider_reference,created_by:scope.actorLawyerId},{onConflict:"firm_id,source_table,source_id,entry_type"}); if(ledger.error)throw new Error(ledger.error.message);
    const receiptNo=await supabase.rpc("next_firm_document_number",{p_firm_id:scope.firmId,p_prefix:"RCT",p_table:"receipt"}); if(receiptNo.error)throw new Error(receiptNo.error.message);
    const receipt=await supabase.from("payment_receipts").insert({firm_id:scope.firmId,matter_id:matterId,payment_id:payment.data.id,receipt_number:receiptNo.data,amount_xaf:amount,issued_to:matter.client_name,issued_by:scope.actorLawyerId,metadata:{provider:payment.data.provider,provider_reference:payment.data.provider_reference}}); if(receipt.error)throw new Error(receipt.error.message);
    if(payment.data.invoice_id){const inv=await supabase.from("invoices").select("id,amount_xaf,paid_xaf").eq("id",payment.data.invoice_id).eq("matter_id",matterId).single();if(inv.error)throw new Error(inv.error.message);const nextPaid=Number(inv.data.paid_xaf||0)+amount;const upd=await supabase.from("invoices").update({paid_xaf:nextPaid,status:nextPaid>=Number(inv.data.amount_xaf)?"Paid":"Partial",updated_at:new Date().toISOString()}).eq("id",inv.data.id);if(upd.error)throw new Error(upd.error.message);}
  } else if(action==="recordExpense"){
    const amount=Math.round(Number(body.amountXaf||0)); if(amount<=0)return NextResponse.json({success:false,error:"Expense amount must be positive."},{status:400});
    const expense=await supabase.from("matter_disbursements").insert({firm_id:scope.firmId,matter_id:matterId,amount_xaf:amount,category:String(body.category||"Other"),payee:String(body.payee||"Unknown payee"),status:"Paid",client_recoverable:body.clientRecoverable!==false,note:body.note||null,approved_by:scope.actorLawyerId,paid_at:new Date().toISOString(),created_by:scope.actorLawyerId}).select("*").single();if(expense.error)throw new Error(expense.error.message);
    const ledger=await supabase.from("finance_ledger_entries").upsert({firm_id:scope.firmId,matter_id:matterId,entry_type:"DISBURSEMENT",source_table:"matter_disbursements",source_id:expense.data.id,amount_xaf:amount,direction:"DEBIT",account_bucket:"OPERATING",status:"POSTED",description:`${expense.data.category}: ${expense.data.payee}`,created_by:scope.actorLawyerId},{onConflict:"firm_id,source_table,source_id,entry_type"});if(ledger.error)throw new Error(ledger.error.message);
  } else if(action==="reconcile"){
    const current=await summary(rt,matterId);const recon=await supabase.from("finance_reconciliation_reviews").insert({firm_id:scope.firmId,matter_id:matterId,expected_xaf:current.totals.invoiced,received_xaf:current.totals.paid,variance_xaf:current.totals.invoiced-current.totals.paid,status:current.totals.outstanding===0?"approved":"open",notes:body.notes||null,source_summary:current.totals,prepared_by:scope.actorLawyerId,reviewed_by:current.totals.outstanding===0?scope.actorLawyerId:null,reviewed_at:current.totals.outstanding===0?new Date().toISOString():null}).select("*").single();if(recon.error)throw new Error(recon.error.message);
  } else if(action==="generateStatement"){
    const current=await summary(rt,matterId);const statement=await supabase.from("client_financial_statements").insert({firm_id:scope.firmId,matter_id:matterId,invoiced_xaf:current.totals.invoiced,paid_xaf:current.totals.paid,outstanding_xaf:current.totals.outstanding,recoverable_expenses_xaf:current.totals.recoverableExpenses,client_funds_xaf:0,generated_by:scope.actorLawyerId,snapshot:{invoices:current.invoices,payments:current.payments,receipts:current.receipts,expenses:current.expenses}}).select("*").single();if(statement.error)throw new Error(statement.error.message);
  } else return NextResponse.json({success:false,error:"Unsupported finance action."},{status:400});
  return NextResponse.json({success:true,...await summary(rt,matterId)});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update finance."},{status:403});}
}
