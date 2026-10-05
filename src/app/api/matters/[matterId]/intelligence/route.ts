import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { promoteOutcomeToKnowledge } from "@/lib/matter-intelligence.server";
import { statusForApiError } from "@/lib/api-errors";

export async function POST(request:Request,{params}:{params:Promise<{matterId:string}>}){
 try{
  const{matterId}=await params;const scope=await resolveRequestScope(request);const body=await request.json();const action=String(body.action??"");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");if(!scope.firmId)throw new Error("Authenticated firm context is required.");
  let record:unknown=null;let eventType="";
  if(action==="record_claim"){
   await assertMatterPermission({scope,matterId,permission:"manageEvidence"});
   const statement=String(body.statement??"").trim();const claimType=String(body.claimType??"fact");if(!statement)throw new Error("Claim statement is required.");
   if(!["fact","issue","law","authority","evidence","analysis","option","recommendation"].includes(claimType))throw new Error("Unsupported legal claim type.");
   const result=await supabase.from("matter_legal_claims").insert({firm_id:scope.firmId,matter_id:matterId,claim_type:claimType,statement,source_kind:String(body.sourceKind??"matter_record"),source_reference:String(body.sourceReference??"").trim()||null,jurisdiction:String(body.jurisdiction??"").trim()||null,confidence:body.confidence??null}).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_LEGAL_CLAIM_RECORDED";
  }else if(action==="verify_claim"){
   await assertMatterPermission({scope,matterId,permission:"approveAIWork"});
   const id=String(body.id??"");const status=String(body.status??"");if(!id||!["corroborated","verified","disputed","superseded"].includes(status))throw new Error("Valid claim and verification status are required.");
   const result=await supabase.from("matter_legal_claims").update({verification_status:status,verified_by:scope.actorLawyerId??null,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType=`MATTER_LEGAL_CLAIM_${status.toUpperCase()}`;
  }else if(action==="record_communication"){
   await assertMatterPermission({scope,matterId,permission:"manageClientAccess"});
   const bodyText=String(body.bodyText??"").trim();if(!bodyText)throw new Error("Communication content is required.");
   const result=await supabase.from("matter_communication_ingest").insert({firm_id:scope.firmId,matter_id:matterId,channel:String(body.channel??"other"),direction:String(body.direction??"inbound"),sender:String(body.sender??"").trim()||null,subject:String(body.subject??"").trim()||null,body_text:bodyText,instruction_candidate:Boolean(body.instructionCandidate),evidence_candidate:Boolean(body.evidenceCandidate),processing_status:(body.instructionCandidate||body.evidenceCandidate)?"review_required":"recorded"}).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_COMMUNICATION_INGESTED";
  }else if(action==="review_communication"){
   await assertMatterPermission({scope,matterId,permission:"manageClientAccess"});
   const id=String(body.id??"");const status=String(body.status??"");if(!id||!["promoted","ignored"].includes(status))throw new Error("Valid communication review status is required.");
   const result=await supabase.from("matter_communication_ingest").update({processing_status:status}).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType=`MATTER_COMMUNICATION_${status.toUpperCase()}`;
  }else if(action==="promote_outcome"){
   const outcomeId=String(body.outcomeId??"");if(!outcomeId)throw new Error("Outcome is required.");record=await promoteOutcomeToKnowledge({scope,matterId,outcomeId});eventType="MATTER_OUTCOME_PROMOTED_TO_KNOWLEDGE";
  }else return NextResponse.json({success:false,error:"Unsupported matter intelligence action."},{status:400});
  await supabase.from("matter_events").insert({matter_id:matterId,event_type:eventType,actor_name:scope.actorName,metadata:{intelligenceAction:action,record}});
  return NextResponse.json({success:true,record});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update matter intelligence."},{status:statusForApiError(error)});}
}
