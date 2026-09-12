import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request); if(!scope.authenticated||!scope.userEmail)throw new Error("Authenticated client session required.");
  const email=scope.userEmail.trim().toLowerCase(); const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const grants=await supabase.from("client_portal_grants").select("*").eq("client_email",email).eq("grant_status","ACTIVE").is("revoked_at",null).order("created_at",{ascending:false});if(grants.error)throw new Error(grants.error.message);
  const result=[] as any[];
  for(const grant of grants.data??[]){
   const matter=await supabase.from("matters").select("id,title,client_name,status,matter_type,jurisdiction,synopsis,procedural_stage,opened_at,closed_at").eq("id",grant.matter_id).eq("firm_id",grant.firm_id).maybeSingle();if(matter.error)throw new Error(matter.error.message);if(!matter.data)continue;
   const payload:any={grant:{id:grant.id,canViewDocuments:grant.can_view_documents,canViewFinance:grant.can_view_finance,canViewUpdates:grant.can_view_updates,canUploadDocuments:grant.can_upload_documents},matter:matter.data};
   if(grant.can_view_updates){const updates=await supabase.from("matter_client_updates").select("id,title,body,channel,status,delivery_status,instruction_required,instruction_status,client_acknowledged_at,sent_at,created_at").eq("matter_id",grant.matter_id).eq("firm_id",grant.firm_id).in("status",["Approved","Sent","Delivered","approved","sent","delivered"]).order("created_at",{ascending:false}).limit(20);if(updates.error)throw new Error(updates.error.message);payload.updates=updates.data??[];}
   if(grant.can_view_documents){const docs=await supabase.from("documents").select("id,title,document_type,status,version_label,filed_at,created_at").eq("matter_id",grant.matter_id).eq("sharing_policy","Client-share ready").order("created_at",{ascending:false}).limit(30);if(docs.error)throw new Error(docs.error.message);payload.documents=docs.data??[];}
   if(grant.can_view_finance){const [statements,receipts]=await Promise.all([supabase.from("client_financial_statements").select("id,statement_date,invoiced_xaf,paid_xaf,outstanding_xaf,recoverable_expenses_xaf,client_funds_xaf,created_at").eq("matter_id",grant.matter_id).eq("firm_id",grant.firm_id).order("created_at",{ascending:false}).limit(3),supabase.from("payment_receipts").select("id,receipt_number,amount_xaf,issued_at,delivery_status").eq("matter_id",grant.matter_id).eq("firm_id",grant.firm_id).order("issued_at",{ascending:false}).limit(20)]);if(statements.error)throw new Error(statements.error.message);if(receipts.error)throw new Error(receipts.error.message);payload.financialStatements=statements.data??[];payload.receipts=receipts.data??[];}
   await supabase.from("client_portal_grants").update({last_access_at:new Date().toISOString()}).eq("id",grant.id);
   result.push(payload);
  }
  return NextResponse.json({success:true,email,matters:result});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load client portal."},{status:403});}
}
