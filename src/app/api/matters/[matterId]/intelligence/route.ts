import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { promoteOutcomeToKnowledge, refreshFirmJurisdictionPack } from "@/lib/matter-intelligence.server";
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
   const channel=String(body.channel??"other");if(!["email","whatsapp","sms","call","meeting","portal","internal","other"].includes(channel))throw new Error("Unsupported communication channel.");
   const direction=String(body.direction??"inbound");if(!["inbound","outbound","internal"].includes(direction))throw new Error("Unsupported communication direction.");
   const result=await supabase.from("matter_communication_ingest").insert({firm_id:scope.firmId,matter_id:matterId,channel,direction,sender:String(body.sender??"").trim()||null,subject:String(body.subject??"").trim()||null,body_text:bodyText,instruction_candidate:Boolean(body.instructionCandidate),evidence_candidate:Boolean(body.evidenceCandidate),processing_status:(body.instructionCandidate||body.evidenceCandidate)?"review_required":"recorded"}).select("*").single();if(result.error)throw new Error(result.error.message);record=result.data;eventType="MATTER_COMMUNICATION_INGESTED";
  }else if(action==="review_communication"){
   await assertMatterPermission({scope,matterId,permission:"manageClientAccess"});
   const id=String(body.id??"");const status=String(body.status??"");if(!id||!["promoted","ignored"].includes(status))throw new Error("Valid communication review status is required.");
   const communication=await supabase.from("matter_communication_ingest").select("id,channel,direction,sender,subject,body_text,occurred_at,instruction_candidate,evidence_candidate,processing_status,metadata").eq("id",id).eq("matter_id",matterId).single();if(communication.error)throw new Error(communication.error.message);
   const sourceReference=`communication_ingest:${id}`;
   const promoted:{instructionId?:string;evidenceId?:string}={};
   if(status==="promoted"){
    if(communication.data.instruction_candidate){
      const existing=await supabase.from("matter_client_instructions").select("id").eq("matter_id",matterId).eq("source_reference",sourceReference).maybeSingle();if(existing.error)throw new Error(existing.error.message);
      if(existing.data)promoted.instructionId=existing.data.id;else{
       const instruction=await supabase.from("matter_client_instructions").insert({firm_id:scope.firmId,matter_id:matterId,instruction:String(communication.data.body_text??communication.data.subject??"Client communication").trim(),channel:communication.data.channel,received_at:communication.data.occurred_at,recorded_by:scope.actorLawyerId??null,confirmation_status:"recorded",source_reference:sourceReference,metadata:{communicationIngestId:id,promotionReviewedBy:scope.actorLawyerId}}).select("id").single();if(instruction.error)throw new Error(instruction.error.message);promoted.instructionId=instruction.data.id;
      }
    }
    if(communication.data.evidence_candidate){
      await assertMatterPermission({scope,matterId,permission:"manageEvidence"});
      const existing=await supabase.from("matter_evidence_provenance").select("id").eq("matter_id",matterId).eq("source_reference",sourceReference).maybeSingle();if(existing.error)throw new Error(existing.error.message);
      if(existing.data)promoted.evidenceId=existing.data.id;else{
       const evidence=await supabase.from("matter_evidence_provenance").insert({firm_id:scope.firmId,matter_id:matterId,evidence_type:"communication",title:communication.data.subject||`${communication.data.channel} communication`,source_kind:"communication",source_reference:sourceReference,assertion:String(communication.data.body_text??"").trim()||null,verification_status:"unverified",reliability_note:"Promoted from a reviewed communication; substantive content still requires professional verification.",metadata:{communicationIngestId:id,channel:communication.data.channel,sender:communication.data.sender}}).select("id").single();if(evidence.error)throw new Error(evidence.error.message);promoted.evidenceId=evidence.data.id;
      }
    }
   }
   const existingMetadata=communication.data.metadata&&typeof communication.data.metadata==="object"?communication.data.metadata as Record<string,unknown>:{};
   const result=await supabase.from("matter_communication_ingest").update({processing_status:status,metadata:{...existingMetadata,promotion:promoted,reviewedBy:scope.actorLawyerId,reviewedAt:new Date().toISOString()}}).eq("id",id).eq("matter_id",matterId).select("*").single();if(result.error)throw new Error(result.error.message);record={communication:result.data,...promoted};eventType=`MATTER_COMMUNICATION_${status.toUpperCase()}`;
  }else if(action==="refresh_jurisdiction_pack"){
   record=await refreshFirmJurisdictionPack({scope,matterId});eventType="MATTER_JURISDICTION_PACK_REVIEWED";
  }else if(action==="promote_outcome"){
   const outcomeId=String(body.outcomeId??"");if(!outcomeId)throw new Error("Outcome is required.");record=await promoteOutcomeToKnowledge({scope,matterId,outcomeId});eventType="MATTER_OUTCOME_PROMOTED_TO_KNOWLEDGE";
  }else return NextResponse.json({success:false,error:"Unsupported matter intelligence action."},{status:400});
  const event=await supabase.from("matter_events").insert({matter_id:matterId,event_type:eventType,actor_name:scope.actorName,metadata:{intelligenceAction:action,record}});if(event.error)throw new Error(event.error.message);
  return NextResponse.json({success:true,record});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update matter intelligence."},{status:statusForApiError(error)});}
}
