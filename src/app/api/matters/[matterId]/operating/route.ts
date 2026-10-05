import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";

export async function POST(request:Request,{params}:{params:Promise<{matterId:string}>}){
 try{
  const{matterId}=await params;
  const scope=await resolveRequestScope(request);
  const body=await request.json();
  const action=String(body.action??"");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
  if(!scope.firmId)throw new Error("Authenticated firm context is required.");
  let record:unknown=null;let eventType="";

  if(action==="create_execution"){
   await assertMatterPermission({scope,matterId,permission:"assignWork"});
   const title=String(body.title??"").trim();if(!title)throw new Error("Execution title is required.");
   const result=await supabase.from("matter_execution_actions").insert({firm_id:scope.firmId,matter_id:matterId,title,action_type:String(body.actionType??"professional_action"),target_system:String(body.targetSystem??"").trim()||null,execution_mode:String(body.executionMode??"human_assisted"),responsible_lawyer_id:scope.actorLawyerId??null,status:"planned",due_at:body.dueAt||null}).select("*").single();
   if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_EXECUTION_PLANNED";
  } else if(action==="advance_execution"){
   await assertMatterPermission({scope,matterId,permission:"assignWork"});
   const id=String(body.id??"");const status=String(body.status??"");
   if(!id||!["ready","awaiting_approval","in_progress","submitted","acknowledged","completed","failed","cancelled"].includes(status))throw new Error("Valid execution action and status are required.");
   const patch:Record<string,unknown>={status,last_error:String(body.lastError??"").trim()||null,external_reference:String(body.externalReference??"").trim()||null,evidence_reference:String(body.evidenceReference??"").trim()||null,updated_at:new Date().toISOString()};
   if(["submitted","acknowledged","completed"].includes(status))patch.executed_at=new Date().toISOString();if(status==="acknowledged")patch.acknowledged_at=new Date().toISOString();if(status==="completed")patch.completed_at=new Date().toISOString();
   const result=await supabase.from("matter_execution_actions").update(patch).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType=`MATTER_EXECUTION_${status.toUpperCase()}`;
  } else if(action==="record_outcome"){
   await assertMatterPermission({scope,matterId,permission:"manageEvidence"});
   const title=String(body.title??"").trim();const summary=String(body.resultSummary??"").trim();if(!title||!summary)throw new Error("Outcome title and result summary are required.");
   const result=await supabase.from("matter_outcomes").insert({firm_id:scope.firmId,matter_id:matterId,title,result_summary:summary,client_result:String(body.clientResult??"").trim()||null,reusable_lesson:String(body.reusableLesson??"").trim()||null,precedent_candidate:Boolean(body.precedentCandidate)}).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_OUTCOME_RECORDED";
  } else if(action==="review_outcome"){
   await assertMatterPermission({scope,matterId,permission:"approveAIWork"});
   const id=String(body.id??"");const status=String(body.knowledgeStatus??"");if(!id||!["reviewed","approved_internal","restricted","not_reusable"].includes(status))throw new Error("Valid outcome and knowledge status are required.");
   const result=await supabase.from("matter_outcomes").update({knowledge_status:status,reviewed_by:scope.actorLawyerId??null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType=`MATTER_OUTCOME_${status.toUpperCase()}`;
  } else return NextResponse.json({success:false,error:"Unsupported operating action."},{status:400});

  await supabase.from("matter_events").insert({matter_id:matterId,event_type:eventType,actor_name:scope.actorName,metadata:{operatingAction:action,record}});
  return NextResponse.json({success:true,record});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update matter operating record."},{status:statusForApiError(error)});}
}
