import { NextResponse } from "next/server";
import { assertFirmModule, assertFirmPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const WRITE_ROLES = new Set(["owner","partner","administrator","finance"]);

function asMoney(value:unknown){
  const amount=Number(value??0);
  if(!Number.isFinite(amount)||amount<=0) throw new Error("A valid positive XAF amount is required.");
  return Math.round(amount);
}

export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  await assertFirmModule({scope,module:"finance"});
  await assertFirmPermission({scope,permission:"viewBilling"});
  if(!scope.firmId) throw new Error("Authenticated firm context is required.");
  const supabase=createServerSupabaseClient();
  if(!supabase) throw new Error("Supabase server configuration is required.");

  const [invoiceResult,ledgerResult,matterResult]=await Promise.all([
   supabase.from("invoices").select("id,matter_id,invoice_number,description,amount_xaf,paid_xaf,currency,status,issued_at,due_date,created_at,updated_at").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(250),
   supabase.from("finance_ledger_entries").select("id,matter_id,entry_type,amount_xaf,direction,account_bucket,status,description,provider_reference,source_table,source_id,metadata,created_at").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(250),
   supabase.from("matters").select("id,title,client_name,status").eq("firm_id",scope.firmId).order("updated_at",{ascending:false}).limit(250)
  ]);
  for(const result of [invoiceResult,ledgerResult,matterResult]) if(result.error) throw new Error(result.error.message);
  const invoices=invoiceResult.data??[];
  const ledgerRaw=ledgerResult.data??[];
  const ledger=ledgerRaw.map((row)=>{
    const metadata=(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as Record<string,unknown>;
    const invoiceId=metadata.invoiceId ? String(metadata.invoiceId) : row.source_table==="invoices"&&row.source_id ? String(row.source_id) : null;
    return {
      id:row.id,matter_id:row.matter_id,invoice_id:invoiceId,entry_type:row.entry_type,amount_xaf:row.amount_xaf,
      direction:row.direction==="CREDIT"?"in":"out",
      payment_method:metadata.paymentMethod?String(metadata.paymentMethod):null,
      reference:row.provider_reference??null,description:row.description,
      occurred_at:metadata.occurredAt?String(metadata.occurredAt):row.created_at,created_at:row.created_at
    };
  });
  const billed=invoices.reduce((sum,row)=>sum+Number(row.amount_xaf??0),0);
  const paidOnInvoices=invoices.reduce((sum,row)=>sum+Number(row.paid_xaf??0),0);
  const cashIn=ledgerRaw.filter(row=>row.direction==="CREDIT").reduce((sum,row)=>sum+Number(row.amount_xaf??0),0);
  const cashOut=ledgerRaw.filter(row=>row.direction==="DEBIT").reduce((sum,row)=>sum+Number(row.amount_xaf??0),0);
  const outstanding=invoices.reduce((sum,row)=>sum+Math.max(0,Number(row.amount_xaf??0)-Number(row.paid_xaf??0)),0);
  const overdue=invoices.filter(row=>row.due_date&&new Date(row.due_date).getTime()<Date.now()&&!["paid","settled","cancelled","void"].includes(String(row.status??"").toLowerCase()));
  return NextResponse.json({success:true,actorRole:scope.actorRole,writable:WRITE_ROLES.has(String(scope.actorRole??"").toLowerCase()),metrics:{billed,paidOnInvoices,cashIn,cashOut,outstanding,overdueCount:overdue.length},invoices,ledger,matters:matterResult.data??[]});
 }catch(error){
  return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load finance."},{status:statusForApiError(error)});
 }
}

export async function POST(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  await assertFirmModule({scope,module:"finance"});
  await assertFirmPermission({scope,permission:"viewBilling"});
  if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  if(!WRITE_ROLES.has(String(scope.actorRole??"").toLowerCase())) throw new Error("Permission denied: finance write access is required for this action.");
  const supabase=createServerSupabaseClient();
  if(!supabase) throw new Error("Supabase server configuration is required.");
  const body=await request.json();
  const action=String(body.action??"");

  if(action==="createInvoice"){
   const matterId=String(body.matterId??"").trim();
   if(!matterId) return NextResponse.json({success:false,error:"Case is required."},{status:400});
   const matter=await supabase.from("matters").select("id").eq("id",matterId).eq("firm_id",scope.firmId).maybeSingle();
   if(matter.error) throw new Error(matter.error.message);
   if(!matter.data) throw new Error("Case not found in the active firm.");
   const amount=asMoney(body.amountXaf);
   const issuedAt=body.issuedAt?String(body.issuedAt):new Date().toISOString();
   const invoiceNumber=String(body.invoiceNumber??"").trim()||`TSK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
   const created=await supabase.from("invoices").insert({
    firm_id:scope.firmId,matter_id:matterId,invoice_number:invoiceNumber,
    description:String(body.description??"Legal fees").trim()||"Legal fees",amount_xaf:amount,paid_xaf:0,currency:"XAF",
    status:"issued",issued_at:issuedAt,due_date:body.dueDate?String(body.dueDate):null,created_by:scope.actorLawyerId
   }).select("*").single();
   if(created.error) throw new Error(created.error.message);
   return NextResponse.json({success:true,invoice:created.data},{status:201});
  }

  if(action==="recordEntry"){
   const entryType=String(body.entryType??"payment");
   const allowed=new Set(["payment","expense","disbursement","receipt","adjustment"]);
   if(!allowed.has(entryType)) return NextResponse.json({success:false,error:"Unsupported finance entry type."},{status:400});
   const isCredit=entryType==="payment"||entryType==="receipt"||String(body.direction??"").toLowerCase()==="in";
   const invoiceId=body.invoiceId?String(body.invoiceId):null;
   const matterId=body.matterId?String(body.matterId):null;
   const amount=asMoney(body.amountXaf);
   const accountBucket=entryType==="disbursement"?"DISBURSEMENT":isCredit?"REVENUE":"OPERATING";
   const occurredAt=body.occurredAt?String(body.occurredAt):new Date().toISOString();
   const reference=body.reference?String(body.reference).trim():null;
   const paymentMethod=body.paymentMethod?String(body.paymentMethod).trim():null;
   const created=await supabase.from("finance_ledger_entries").insert({
    firm_id:scope.firmId,matter_id:matterId,entry_type:entryType,source_table:invoiceId?"invoices":null,source_id:invoiceId,
    amount_xaf:amount,direction:isCredit?"CREDIT":"DEBIT",account_bucket:accountBucket,status:"POSTED",
    description:body.description?String(body.description).trim():null,provider_reference:reference,created_by:scope.actorLawyerId,
    metadata:{invoiceId,paymentMethod,occurredAt}
   }).select("*").single();
   if(created.error) throw new Error(created.error.message);

   if(invoiceId&&isCredit){
    const invoice=await supabase.from("invoices").select("id,amount_xaf,paid_xaf").eq("id",invoiceId).eq("firm_id",scope.firmId).maybeSingle();
    if(invoice.error) throw new Error(invoice.error.message);
    if(invoice.data){
      const nextPaid=Number(invoice.data.paid_xaf??0)+amount;
      const nextStatus=nextPaid>=Number(invoice.data.amount_xaf??0)?"paid":"part_paid";
      const updated=await supabase.from("invoices").update({paid_xaf:nextPaid,status:nextStatus,updated_at:new Date().toISOString()}).eq("id",invoiceId).eq("firm_id",scope.firmId);
      if(updated.error) throw new Error(updated.error.message);
    }
   }
   return NextResponse.json({success:true,entry:{...created.data,direction:isCredit?"in":"out",invoice_id:invoiceId,payment_method:paymentMethod,reference,occurred_at:occurredAt}},{status:201});
  }
  return NextResponse.json({success:false,error:"Unsupported finance action."},{status:400});
 }catch(error){
  return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update finance."},{status:statusForApiError(error)});
 }
}
