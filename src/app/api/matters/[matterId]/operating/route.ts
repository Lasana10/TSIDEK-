import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";

const executionStatuses = new Set(["ready","awaiting_approval","in_progress","submitted","acknowledged","completed","failed","cancelled"]);
const executionTransitions: Record<string, readonly string[]> = {
  planned: ["ready","cancelled"],
  ready: ["awaiting_approval","in_progress"],
  awaiting_approval: ["in_progress","cancelled"],
  in_progress: ["submitted","failed"],
  submitted: ["acknowledged","failed"],
  acknowledged: ["completed","failed"],
  failed: ["ready","cancelled"],
  completed: [],
  cancelled: [],
};
const knowledgeStatuses = new Set(["reviewed","approved_internal","restricted","not_reusable"]);
const providerBoundStatuses = new Set(["ready","awaiting_approval","in_progress","submitted","acknowledged","completed"]);

async function assertExecutionProviderReady(input:{firmId:string;mode:string;targetSystem:string|null;status:string}){
 if(!["direct_api","partner_api"].includes(input.mode)||!providerBoundStatuses.has(input.status))return;
 if(!input.targetSystem)throw new Error(`${input.mode === "direct_api" ? "Direct" : "Partner"} API execution requires a target provider/system before it can be marked ready.`);
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 const connection=await supabase.from("firm_integration_connections").select("id,provider,status").eq("firm_id",input.firmId).eq("provider",input.targetSystem).in("status",["verified","configured","active"]).limit(1).maybeSingle();
 if(connection.error)throw new Error(connection.error.message);
 if(!connection.data)throw new Error(`Execution cannot advance through ${input.mode.replace("_"," ")} because ${input.targetSystem} is not a verified/configured firm integration. Use human-assisted/manual execution or configure the provider first.`);
}

export async function GET(request:Request,{params}:{params:Promise<{matterId:string}>}){
 try{
  const{matterId}=await params;
  const scope=await resolveRequestScope(request);
  await assertMatterPermission({scope,matterId,allowAnyMember:true});
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
  const[executions,outcomes]=await Promise.all([
   supabase.from("matter_execution_actions").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
   supabase.from("matter_outcomes").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
  ]);
  if(executions.error)throw new Error(executions.error.message);if(outcomes.error)throw new Error(outcomes.error.message);
  return NextResponse.json({success:true,executions:executions.data??[],outcomes:outcomes.data??[]});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load matter operating records."},{status:statusForApiError(error)});}
}

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
   const executionMode=String(body.executionMode??"human_assisted");if(!["direct_api","partner_api","human_assisted","manual"].includes(executionMode))throw new Error("Invalid execution mode.");
   const targetSystem=String(body.targetSystem??"").trim()||null;
   if(["direct_api","partner_api"].includes(executionMode)&&!targetSystem)throw new Error("Direct/partner API execution must identify the target provider/system.");
   const result=await supabase.from("matter_execution_actions").insert({firm_id:scope.firmId,matter_id:matterId,title,action_type:String(body.actionType??"professional_action"),target_system:targetSystem,execution_mode:executionMode,responsible_lawyer_id:scope.actorLawyerId??null,status:"planned",due_at:body.dueAt||null}).select("*").single();
   if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_EXECUTION_PLANNED";
  } else if(action==="advance_execution"){
   const id=String(body.id??"");const status=String(body.status??"");if(!id||!executionStatuses.has(status))throw new Error("Valid execution action and status are required.");
   await assertMatterPermission({scope,matterId,permission:["awaiting_approval","submitted","acknowledged","completed"].includes(status)?"approveFilings":"assignWork"});
   const current=await supabase.from("matter_execution_actions").select("id,execution_mode,target_system,status").eq("id",id).eq("matter_id",matterId).single();if(current.error)throw new Error(current.error.message);
   const currentStatus=String(current.data.status??"");
   if(!executionTransitions[currentStatus]?.includes(status))throw new Error(`Invalid execution transition: ${currentStatus} → ${status}. Refresh the Matter and use the next permitted action.`);
   await assertExecutionProviderReady({firmId:scope.firmId,mode:String(current.data.execution_mode),targetSystem:current.data.target_system?String(current.data.target_system):null,status});
   if(["submitted","acknowledged","completed"].includes(status)&&["direct_api","partner_api"].includes(String(current.data.execution_mode))&&!String(body.externalReference??"").trim()&&!String(body.evidenceReference??"").trim())throw new Error("API/partner execution requires an external or evidence reference before submission/acknowledgement/completion can be recorded.");
   const patch:Record<string,unknown>={status,updated_at:new Date().toISOString()};
   if(body.lastError!==undefined)patch.last_error=String(body.lastError??"").trim()||null;
   if(body.externalReference!==undefined)patch.external_reference=String(body.externalReference??"").trim()||null;
   if(body.evidenceReference!==undefined)patch.evidence_reference=String(body.evidenceReference??"").trim()||null;
   if(status==="submitted")patch.executed_at=new Date().toISOString();if(status==="acknowledged")patch.acknowledged_at=new Date().toISOString();if(status==="completed")patch.completed_at=new Date().toISOString();
   // Optimistic concurrency prevents stale clients from overwriting a more recent transition.
   const result=await supabase.from("matter_execution_actions").update(patch).eq("id",id).eq("matter_id",matterId).eq("status",currentStatus).select("*").maybeSingle();if(result.error)throw new Error(result.error.message);if(!result.data)throw new Error("The execution status changed while you were working. Refresh and try again.");record=result.data;eventType=`MATTER_EXECUTION_${status.toUpperCase()}`;
  } else if(action==="record_outcome"){
   await assertMatterPermission({scope,matterId,permission:"archiveMatters"});
   const title=String(body.title??"").trim();const summary=String(body.resultSummary??"").trim();if(!title||!summary)throw new Error("Outcome title and result summary are required.");
   const result=await supabase.from("matter_outcomes").insert({firm_id:scope.firmId,matter_id:matterId,title,result_summary:summary,client_result:String(body.clientResult??"").trim()||null,reusable_lesson:String(body.reusableLesson??"").trim()||null,precedent_candidate:Boolean(body.precedentCandidate)}).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_OUTCOME_RECORDED";
  } else if(action==="review_outcome"){
   await assertMatterPermission({scope,matterId,permission:"approveAIWork"});
   const id=String(body.id??"");const status=String(body.knowledgeStatus??"");if(!id||!knowledgeStatuses.has(status))throw new Error("Valid outcome and knowledge status are required.");
   const patch:Record<string,unknown>={knowledge_status:status,reviewed_by:scope.actorLawyerId??null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   if(body.reusableLesson!==undefined)patch.reusable_lesson=String(body.reusableLesson??"").trim()||null;
   const result=await supabase.from("matter_outcomes").update(patch).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType=`MATTER_OUTCOME_${status.toUpperCase()}`;
  } else return NextResponse.json({success:false,error:"Unsupported operating action."},{status:400});

  const event=await supabase.from("matter_events").insert({matter_id:matterId,event_type:eventType,actor_name:scope.actorName,metadata:{operatingAction:action,record}});if(event.error)throw new Error(event.error.message);
  return NextResponse.json({success:true,record});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update matter operating record."},{status:statusForApiError(error)});}
}
