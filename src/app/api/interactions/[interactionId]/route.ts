import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordMatterEvent } from "@/lib/matter-events.server";

type Context={params:Promise<{interactionId:string}>};
const extractionTypes=new Set(["fact","changed_fact","contradiction","instruction","commitment","deadline","document","person","organisation","risk","research_question","task","payment","conflict_name","client_update"]);
const cycleStages=new Set(["enquiry","intake","preliminary_discussion","consultation","engagement","matter"]);
const consultationStatuses=new Set(["not_required","suggested","scheduled","paid","waived","credited","completed"]);

async function loadContext(request:Request,interactionId:string){
 const scope=await resolveRequestScope(request);if(!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
 const result=await supabase.from("legal_interactions").select("*").eq("id",interactionId).eq("firm_id",scope.firmId).maybeSingle();if(result.error)throw new Error(result.error.message);if(!result.data)throw new Error("Interaction not found.");
 if(result.data.matter_id)await assertMatterPermission({scope,matterId:result.data.matter_id,allowAnyMember:true});
 return {scope,supabase,interaction:result.data};
}

export async function GET(request:Request,context:Context){
 try{const {interactionId}=await context.params;const {scope,supabase,interaction}=await loadContext(request,interactionId);const [extractions,party,matter,lawyers]=await Promise.all([
  supabase.from("interaction_extractions").select("*").eq("interaction_id",interactionId).eq("firm_id",scope.firmId).order("created_at"),
  interaction.primary_party_id?supabase.from("parties").select("id,display_name,phone,email,client_status").eq("id",interaction.primary_party_id).maybeSingle():Promise.resolve({data:null,error:null}),
  interaction.matter_id?supabase.from("matters").select("id,title,client_name,status,confidentiality_level").eq("id",interaction.matter_id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from("lawyers").select("id,full_name,role").eq("firm_id",scope.firmId).order("full_name"),
 ]);if(extractions.error)throw new Error(extractions.error.message);if(party.error)throw new Error(party.error.message);if(matter.error)throw new Error(matter.error.message);if(lawyers.error)throw new Error(lawyers.error.message);return NextResponse.json({success:true,interaction,extractions:extractions.data??[],party:party.data,matter:matter.data,lawyers:lawyers.data??[]});}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load interaction."},{status:403})}
}

export async function PATCH(request:Request,context:Context){
 try{const {interactionId}=await context.params;const {scope,supabase,interaction}=await loadContext(request,interactionId);const body=await request.json();let matterId=interaction.matter_id as string|null;if(body.matterId!==undefined){matterId=body.matterId?String(body.matterId):null;if(matterId)await assertMatterPermission({scope,matterId,allowAnyMember:true});}
  const update:Record<string,unknown>={updated_at:new Date().toISOString()};if(body.note!==undefined)update.raw_note=String(body.note).trim()||null;if(body.subject!==undefined)update.subject=String(body.subject).trim()||null;if(body.matterId!==undefined)update.matter_id=matterId;if(body.assignedTo!==undefined)update.assigned_to=body.assignedTo?String(body.assignedTo):null;if(body.verificationStatus!==undefined&&["unreviewed","reviewed","partially_confirmed","confirmed","rejected"].includes(String(body.verificationStatus))){update.verification_status=String(body.verificationStatus);update.reviewed_by=scope.actorLawyerId;update.reviewed_at=new Date().toISOString();}if(body.clientCycleStage!==undefined&&cycleStages.has(String(body.clientCycleStage)))update.client_cycle_stage=String(body.clientCycleStage);if(body.consultationStatus!==undefined&&consultationStatuses.has(String(body.consultationStatus)))update.consultation_status=String(body.consultationStatus);if(body.substantiveAdviceDetected!==undefined)update.substantive_advice_detected=Boolean(body.substantiveAdviceDetected);if(body.consultationFeeXaf!==undefined)update.consultation_fee_xaf=body.consultationFeeXaf===null?null:Math.max(0,Math.round(Number(body.consultationFeeXaf)||0));
  const result=await supabase.from("legal_interactions").update(update).eq("id",interactionId).eq("firm_id",scope.firmId).select("*").single();if(result.error)throw new Error(result.error.message);return NextResponse.json({success:true,interaction:result.data});}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update interaction."},{status:403})}
}

export async function POST(request:Request,context:Context){
 try{const {interactionId}=await context.params;const {scope,supabase,interaction}=await loadContext(request,interactionId);const body=await request.json();const action=String(body.action??"add_extraction");
  if(action==="convert_consultation"){
   const status=consultationStatuses.has(String(body.consultationStatus))?String(body.consultationStatus):"scheduled";const fee=body.consultationFeeXaf===undefined||body.consultationFeeXaf===null?null:Math.max(0,Math.round(Number(body.consultationFeeXaf)||0));const reason=String(body.reason??"Substantive legal discussion requires controlled consultation handling.").trim();
   const updated=await supabase.from("legal_interactions").update({client_cycle_stage:"consultation",substantive_advice_detected:true,consultation_status:status,consultation_fee_xaf:fee,consultation_conversion_reason:reason,updated_at:new Date().toISOString()}).eq("id",interactionId).eq("firm_id",scope.firmId).select("*").single();if(updated.error)throw new Error(updated.error.message);
   if(interaction.matter_id)await recordMatterEvent({matterId:interaction.matter_id,scope,eventType:"CONSULTATION_CONTROL_ACTIVATED",reason,metadata:{interaction_id:interactionId,consultation_status:status,fee_xaf:fee}});
   return NextResponse.json({success:true,interaction:updated.data});
  }
  if(action==="add_extraction"){
   const type=String(body.extractionType??"");const summary=String(body.summary??"").trim();if(!extractionTypes.has(type)||!summary)return NextResponse.json({success:false,error:"Extraction type and summary are required."},{status:400});
   const result=await supabase.from("interaction_extractions").insert({firm_id:scope.firmId,interaction_id:interactionId,extraction_type:type,summary,detail:body.detail&&typeof body.detail==="object"?body.detail:{},status:"suggested",confidence:null}).select("*").single();if(result.error)throw new Error(result.error.message);return NextResponse.json({success:true,extraction:result.data},{status:201});
  }
  if(action==="review_extraction"){
   const extractionId=String(body.extractionId??"");const decision=String(body.decision??"confirmed");if(!extractionId||!["confirmed","edited","rejected"].includes(decision))return NextResponse.json({success:false,error:"Valid extraction and decision are required."},{status:400});
   const current=await supabase.from("interaction_extractions").select("*").eq("id",extractionId).eq("interaction_id",interactionId).eq("firm_id",scope.firmId).single();if(current.error)throw new Error(current.error.message);
   const summary=body.summary!==undefined?String(body.summary).trim():current.data.summary;const detail={...(current.data.detail??{}),...(body.detail&&typeof body.detail==="object"?body.detail:{})};
   const reviewed=await supabase.from("interaction_extractions").update({summary,detail,status:decision,confirmed_by:decision==="rejected"?null:scope.actorLawyerId,confirmed_at:decision==="rejected"?null:new Date().toISOString()}).eq("id",extractionId).select("*").single();if(reviewed.error)throw new Error(reviewed.error.message);
   if(decision!=="rejected"&&body.materialize!==false){const matterId=interaction.matter_id as string|null;if(!matterId)return NextResponse.json({success:false,error:"Link the interaction to a matter before converting confirmed legal information into matter work."},{status:400});await assertMatterPermission({scope,matterId,allowAnyMember:true});
    if(["task","deadline","research_question"].includes(current.data.extraction_type)){
     await assertFirmPermission({scope,permission:"assignWork"});const task=await supabase.from("tasks").insert({matter_id:matterId,assigned_to:body.assignedTo?String(body.assignedTo):scope.actorLawyerId,title:summary,description:String(detail.description??`Confirmed from ${interaction.interaction_type} interaction.`),deadline:detail.due_at?String(detail.due_at):null,status:"Open",is_completed:false}).select("id").single();if(task.error)throw new Error(task.error.message);detail.materialized_task_id=task.data.id;
    }else if(current.data.extraction_type==="commitment"){
     const commitment=await supabase.from("matter_commitments").insert({firm_id:scope.firmId,matter_id:matterId,interaction_id:interactionId,party_id:interaction.primary_party_id,owner_lawyer_id:body.assignedTo?String(body.assignedTo):scope.actorLawyerId,commitment_by:String(detail.commitment_by??"Client / participant"),commitment_to:detail.commitment_to?String(detail.commitment_to):null,description:summary,due_at:detail.due_at?String(detail.due_at):null,status:"open",source:"interaction",created_by:scope.actorLawyerId}).select("id").single();if(commitment.error)throw new Error(commitment.error.message);detail.materialized_commitment_id=commitment.data.id;
    }else if(current.data.extraction_type==="client_update"){
     const update=await supabase.from("matter_client_updates").insert({firm_id:scope.firmId,matter_id:matterId,created_by:scope.actorLawyerId,title:String(detail.title??"Client update"),body:summary,channel:String(detail.channel??"Portal"),audience:"Client",status:"Draft",instruction_required:Boolean(detail.instruction_required)}).select("id").single();if(update.error)throw new Error(update.error.message);detail.materialized_client_update_id=update.data.id;
    }else{
     await recordMatterEvent({matterId,scope,eventType:`INTERACTION_${String(current.data.extraction_type).toUpperCase()}_CONFIRMED`,reason:summary,metadata:{interaction_id:interactionId,extraction_id:extractionId,detail}});
    }
    await supabase.from("interaction_extractions").update({detail}).eq("id",extractionId);
   }
   const remaining=await supabase.from("interaction_extractions").select("status").eq("interaction_id",interactionId);const statuses=(remaining.data??[]).map(row=>row.status);const verification=statuses.length&&statuses.every(s=>["confirmed","edited","rejected"].includes(s))?"confirmed":"partially_confirmed";await supabase.from("legal_interactions").update({verification_status:verification,reviewed_by:scope.actorLawyerId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",interactionId);
   return NextResponse.json({success:true,extraction:{...reviewed.data,detail}});
  }
  return NextResponse.json({success:false,error:"Unsupported interaction action."},{status:400});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to process interaction."},{status:403})}
}
