import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request); if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const [reports,matters]=await Promise.all([
      supabase.from("matter_activity_reports").select("*").eq("firm_id",scope.firmId).order("occurred_at",{ascending:false}).limit(300),
      supabase.from("matters").select("id,title,client_name,status").eq("firm_id",scope.firmId).order("updated_at",{ascending:false}).limit(300)
    ]);
    if(reports.error) throw new Error(reports.error.message); if(matters.error) throw new Error(matters.error.message);
    return NextResponse.json({success:true,reports:reports.data??[],matters:matters.data??[]});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load activity reports."},{status:403})}
}
export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request); if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const body=await request.json(); const matterId=String(body.matterId??""); if(!matterId) throw new Error("Case is required.");
    const minutes=Math.max(0,Number(body.minutes??0)); const expense=Math.max(0,Number(body.expenseXaf??0));
    const created=await supabase.from("matter_activity_reports").insert({
      firm_id:scope.firmId,matter_id:matterId,lawyer_id:scope.actorLawyerId,activity_type:String(body.activityType??"legal_work"),
      title:String(body.title??"Compte rendu").trim(),summary:String(body.summary??"").trim(),outcome:String(body.outcome??"").trim()||null,
      next_action:String(body.nextAction??"").trim()||null,occurred_at:body.occurredAt||new Date().toISOString(),minutes:Math.round(minutes),
      billable:Boolean(body.billable),expense_xaf:Math.round(expense),status:"final",metadata:{source:"compte_rendu"}
    }).select("*").single();
    if(created.error) throw new Error(created.error.message);
    if(minutes>0){
      const time=await supabase.from("matter_time_entries").insert({
        firm_id:scope.firmId,matter_id:matterId,lawyer_id:scope.actorLawyerId,activity_type:created.data.activity_type,
        description:created.data.title,started_at:null,ended_at:null,minutes:Math.round(minutes),billable:Boolean(body.billable),
        billing_status:Boolean(body.billable)?"unbilled":"non_billable"
      });
      if(time.error) throw new Error(time.error.message);
    }
    if(expense>0){
      const ex=await supabase.from("firm_expenses").insert({
        firm_id:scope.firmId,matter_id:matterId,category:"case_disbursement",description:String(body.expenseDescription??created.data.title),
        amount_xaf:Math.round(expense),expense_date:new Date(created.data.occurred_at).toISOString().slice(0,10),recoverable:true,tax_relevant:false,status:"recorded",created_by:scope.actorLawyerId
      });
      if(ex.error) throw new Error(ex.error.message);
    }
    return NextResponse.json({success:true,report:created.data},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to save activity report."},{status:400})}
}
