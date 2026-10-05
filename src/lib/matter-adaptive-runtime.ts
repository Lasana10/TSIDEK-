import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { MatterWorkspaceData } from "@/lib/matters";
import type { RequestScope } from "@/lib/request-scope";

export type AdaptiveRoomKind="War Room"|"Closing Room"|"Filing Room"|"Review Room"|"Advisory Room"|"Compliance Room"|"Matter Room";
export function resolveAdaptiveRoom(matter:MatterWorkspaceData):{kind:AdaptiveRoomKind;purpose:string}{
 switch(matter.engagementNature){
  case"contentious":return{kind:"War Room",purpose:"Theory of case, evidence, procedure, negotiation and enforcement."};
  case"transactional":return{kind:"Closing Room",purpose:"Diligence, negotiation, approvals, conditions, signing and closing."};
  case"registration":return{kind:"Filing Room",purpose:"Requirements, dossier, authority filing, examination and registration evidence."};
  case"diligence":return{kind:"Review Room",purpose:"Request coverage, verification, findings, risk and final report."};
  case"advisory":return{kind:"Advisory Room",purpose:"Question, authorities, analysis, options, professional review and delivery."};
  case"compliance":return{kind:"Compliance Room",purpose:"Obligations, evidence gaps, filings, remediation and recurring monitoring."};
  default:return{kind:"Matter Room",purpose:"Facts, legal analysis, decisions, execution and closure."};
 }
}

export async function getMatterAdaptiveRuntime(input:{matterId:string;scope:RequestScope}){
 const supabase=createServerSupabaseClient(); if(!supabase)throw new Error("Supabase persistence is required.");
 const matter=await supabase.from("matters").select("id,firm_id").eq("id",input.matterId).maybeSingle();
 if(matter.error)throw new Error(matter.error.message); if(!matter.data)throw new Error("Matter not found.");
 if(input.scope.firmId&&matter.data.firm_id!==input.scope.firmId)throw new Error("Matter access denied for the current firm scope.");
 const [decisions,instructions,evidence,handoffs]=await Promise.all([
  supabase.from("matter_decisions").select("id,decision_type,title,question,decision,status,authority_level,rationale,decided_at,created_at").eq("matter_id",input.matterId).order("created_at",{ascending:false}).limit(20),
  supabase.from("matter_client_instructions").select("id,instruction,channel,received_at,confirmation_status,source_reference,decision_id").eq("matter_id",input.matterId).order("received_at",{ascending:false}).limit(20),
  supabase.from("matter_evidence_provenance").select("id,evidence_type,title,source_kind,source_reference,assertion,verification_status,reliability_note,verified_at,created_at").eq("matter_id",input.matterId).order("created_at",{ascending:false}).limit(30),
  supabase.from("matter_handoffs").select("id,handoff_type,external_professional,purpose,status,scope_note,authority_note,accepted_at,completed_at,created_at").eq("matter_id",input.matterId).order("created_at",{ascending:false}).limit(20)
 ]);
 for(const result of[decisions,instructions,evidence,handoffs])if(result.error)throw new Error(result.error.message);
 return{decisions:decisions.data??[],instructions:instructions.data??[],evidence:evidence.data??[],handoffs:handoffs.data??[]};
}