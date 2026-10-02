import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const dependencyChecks = [
  ["documents", "matter_id"],
  ["invoices", "matter_id"],
  ["matter_payments", "matter_id"],
  ["matter_disbursements", "matter_id"],
  ["matter_events", "matter_id"],
  ["legal_document_records", "matter_id"],
] as const;

async function hasProtectedHistory(matterId:string){
  const supabase=createServerSupabaseClient();
  if(!supabase) throw new Error("Supabase persistence is required.");
  const counts:Record<string,number>={};
  for(const [table,column] of dependencyChecks){
    const result=await supabase.from(table).select("id",{count:"exact",head:true}).eq(column,matterId);
    if(result.error) throw new Error(result.error.message);
    counts[table]=result.count??0;
  }
  return {counts,total:Object.values(counts).reduce((sum,value)=>sum+value,0)};
}

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"approveMatterRemoval"});
    if(!scope.firmId) throw new Error("Active firm is required.");
    const supabase=createServerSupabaseClient();
    if(!supabase) throw new Error("Supabase persistence is required.");
    const result=await supabase.from("matter_record_change_requests")
      .select("id,matter_id,request_type,status,reason,requested_by,requested_at,decided_by,decided_at,decision_note,matters(title,case_reference,client_name)")
      .eq("firm_id",scope.firmId)
      .order("requested_at",{ascending:false})
      .limit(100);
    if(result.error) throw new Error(result.error.message);
    return NextResponse.json({success:true,requests:result.data??[]});
  }catch(error){
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load governance queue."},{status:403});
  }
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"approveMatterRemoval"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body=await request.json();
    const requestId=String(body.requestId??"").trim();
    const decision=String(body.decision??"").trim();
    const decisionNote=String(body.decisionNote??"").trim();
    if(!requestId||!["approve","reject"].includes(decision)) return NextResponse.json({success:false,error:"requestId and a valid decision are required."},{status:400});
    const supabase=createServerSupabaseClient();
    if(!supabase) throw new Error("Supabase persistence is required.");
    const pending=await supabase.from("matter_record_change_requests")
      .select("id,matter_id,requested_by,reason,status")
      .eq("id",requestId).eq("firm_id",scope.firmId).eq("status","pending").maybeSingle();
    if(pending.error) throw new Error(pending.error.message);
    if(!pending.data) return NextResponse.json({success:false,error:"Pending request not found."},{status:404});
    if(pending.data.requested_by===scope.actorLawyerId) return NextResponse.json({success:false,error:"The requester cannot approve or reject their own removal request."},{status:403});

    if(decision==="reject"){
      const rejected=await supabase.from("matter_record_change_requests").update({status:"rejected",decided_by:scope.actorLawyerId,decided_at:new Date().toISOString(),decision_note:decisionNote||"Removal rejected"}).eq("id",requestId).eq("status","pending").select("id,status").single();
      if(rejected.error) throw new Error(rejected.error.message);
      await supabase.from("matter_events").insert({matter_id:pending.data.matter_id,event_type:"MATTER_REMOVAL_REJECTED",actor_name:scope.actorName,reason:decisionNote||"Removal rejected",metadata:{requestId}});
      return NextResponse.json({success:true,request:rejected.data});
    }

    const protectedHistory=await hasProtectedHistory(pending.data.matter_id);
    if(protectedHistory.total>0) return NextResponse.json({success:false,error:"This case now contains protected legal or financial history and cannot be removed. Archive it instead.",dependencyCounts:protectedHistory.counts},{status:409});

    const matter=await supabase.from("matters").update({record_state:"deleted",record_state_reason:pending.data.reason,record_state_at:new Date().toISOString(),record_state_by:scope.actorLawyerId}).eq("id",pending.data.matter_id).eq("firm_id",scope.firmId).select("id,record_state").single();
    if(matter.error) throw new Error(matter.error.message);
    const approved=await supabase.from("matter_record_change_requests").update({status:"approved",decided_by:scope.actorLawyerId,decided_at:new Date().toISOString(),decision_note:decisionNote||"Approved by firm governance"}).eq("id",requestId).eq("status","pending").select("id,status").single();
    if(approved.error) throw new Error(approved.error.message);
    await supabase.from("matter_events").insert({matter_id:pending.data.matter_id,event_type:"MATTER_REMOVAL_APPROVED",actor_name:scope.actorName,reason:decisionNote||"Approved by firm governance",metadata:{requestId,recordState:"deleted"}});
    return NextResponse.json({success:true,request:approved.data,matter:matter.data});
  }catch(error){
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to decide governance request."},{status:403});
  }
}
