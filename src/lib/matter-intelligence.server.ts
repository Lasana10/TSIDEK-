import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";

export async function getMatterIntelligence(input:{matterId:string;scope:RequestScope}){
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 await assertMatterPermission({scope:input.scope,matterId:input.matterId,allowAnyMember:true});
 const [claims,communications,matter]=await Promise.all([
  supabase.from("matter_legal_claims").select("id,claim_type,statement,source_kind,source_reference,jurisdiction,confidence,verification_status,verified_at,created_at").eq("matter_id",input.matterId).order("created_at",{ascending:false}),
  supabase.from("matter_communication_ingest").select("id,channel,direction,sender,subject,body_text,occurred_at,instruction_candidate,evidence_candidate,processing_status").eq("matter_id",input.matterId).order("occurred_at",{ascending:false}).limit(50),
  supabase.from("matters").select("firm_id,jurisdiction,practice_area").eq("id",input.matterId).single(),
 ]);
 for(const r of[claims,communications,matter])if(r.error)throw new Error(r.error.message);
 const jurisdiction=String(matter.data?.jurisdiction??"").trim();
 const [packs,knowledge]=await Promise.all([
  jurisdiction?supabase.from("jurisdiction_packs").select("id,jurisdiction_key,system_label,version,status,coverage,source_register,effective_from,effective_to").eq("status","active").ilike("jurisdiction_key",`%${jurisdiction}%`).limit(5):Promise.resolve({data:[],error:null}),
  supabase.from("firm_knowledge_entries").select("id,knowledge_type,title,summary,practice_area,jurisdiction,confidentiality,status,created_at").eq("firm_id",matter.data.firm_id).eq("status","approved").limit(20),
 ]);
 if(packs.error)throw new Error(packs.error.message);if(knowledge.error)throw new Error(knowledge.error.message);
 const verifiedClaims=(claims.data??[]).filter(x=>["verified","corroborated"].includes(x.verification_status));
 const disputedClaims=(claims.data??[]).filter(x=>x.verification_status==="disputed");
 const reviewCommunications=(communications.data??[]).filter(x=>x.processing_status==="review_required"||x.instruction_candidate||x.evidence_candidate);
 return {claims:claims.data??[],verifiedClaims,disputedClaims,communications:communications.data??[],reviewCommunications,jurisdictionPacks:packs.data??[],knowledge:knowledge.data??[]};
}

export async function promoteOutcomeToKnowledge(input:{scope:RequestScope;matterId:string;outcomeId:string}){
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 await assertMatterPermission({scope:input.scope,matterId:input.matterId,permission:"approveAIWork"});
 if(!input.scope.firmId)throw new Error("Authenticated firm context is required.");
 const [outcome,matter]=await Promise.all([
  supabase.from("matter_outcomes").select("id,title,result_summary,reusable_lesson,knowledge_status").eq("id",input.outcomeId).eq("matter_id",input.matterId).single(),
  supabase.from("matters").select("practice_area,jurisdiction").eq("id",input.matterId).single(),
 ]);
 if(outcome.error)throw new Error(outcome.error.message);if(matter.error)throw new Error(matter.error.message);
 if(outcome.data.knowledge_status!=="approved_internal")throw new Error("Outcome must be approved for internal knowledge first.");
 const result=await supabase.from("firm_knowledge_entries").insert({firm_id:input.scope.firmId,source_matter_id:input.matterId,source_outcome_id:outcome.data.id,title:outcome.data.title,summary:outcome.data.reusable_lesson||outcome.data.result_summary,practice_area:matter.data.practice_area||null,jurisdiction:matter.data.jurisdiction||null,status:"approved",approved_by:input.scope.actorLawyerId??null,approved_at:new Date().toISOString()}).select("*").single();
 if(result.error)throw new Error(result.error.message);return result.data;
}
