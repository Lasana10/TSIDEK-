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
  jurisdiction?supabase.from("jurisdiction_packs").select("id,jurisdiction_key,system_label,version,status,coverage,source_register,effective_from,effective_to,source_scope,firm_id").eq("status","active").ilike("jurisdiction_key",`%${jurisdiction}%`).limit(5):Promise.resolve({data:[],error:null}),
  supabase.from("firm_knowledge_entries").select("id,knowledge_type,title,summary,practice_area,jurisdiction,confidentiality,status,created_at").eq("firm_id",matter.data.firm_id).eq("status","approved").limit(20),
 ]);
 if(packs.error)throw new Error(packs.error.message);if(knowledge.error)throw new Error(knowledge.error.message);
 const verifiedClaims=(claims.data??[]).filter(x=>["verified","corroborated"].includes(x.verification_status));
 const disputedClaims=(claims.data??[]).filter(x=>x.verification_status==="disputed");
 const reviewCommunications=(communications.data??[]).filter(x=>x.processing_status==="review_required"||x.instruction_candidate||x.evidence_candidate);
 return {matter:{jurisdiction,practiceArea:matter.data?.practice_area??null},claims:claims.data??[],verifiedClaims,disputedClaims,communications:communications.data??[],reviewCommunications,jurisdictionPacks:packs.data??[],knowledge:knowledge.data??[]};
}

export async function refreshFirmJurisdictionPack(input:{scope:RequestScope;matterId:string}){
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 await assertMatterPermission({scope:input.scope,matterId:input.matterId,permission:"approveAIWork"});
 if(!input.scope.firmId)throw new Error("Authenticated firm context is required.");
 const matter=await supabase.from("matters").select("jurisdiction").eq("id",input.matterId).single();if(matter.error)throw new Error(matter.error.message);
 const jurisdiction=String(matter.data.jurisdiction??"").trim();if(!jurisdiction)throw new Error("Matter jurisdiction must be identified before a jurisdiction pack can be reviewed.");
 const sources=await supabase.from("legal_source_documents").select("id,publisher,jurisdiction,document_type,title,source_url,canonical_uri,language,version_label,valid_from,valid_until,checksum,ingestion_status").eq("firm_id",input.scope.firmId).eq("ingestion_status","ready").ilike("jurisdiction",`%${jurisdiction}%`).order("created_at",{ascending:false}).limit(200);
 if(sources.error)throw new Error(sources.error.message);if(!(sources.data??[]).length)throw new Error(`No ready firm-controlled legal sources match ${jurisdiction}. Ingest and review legal sources before activating a jurisdiction pack.`);
 const sourceRegister=(sources.data??[]).map(source=>({id:source.id,title:source.title,publisher:source.publisher,documentType:source.document_type,sourceUrl:source.source_url,canonicalUri:source.canonical_uri,versionLabel:source.version_label,validFrom:source.valid_from,validUntil:source.valid_until,checksum:source.checksum}));
 const coverage={sourceCount:sourceRegister.length,documentTypes:[...new Set((sources.data??[]).map(x=>x.document_type))],languages:[...new Set((sources.data??[]).map(x=>x.language).filter(Boolean))],reviewedFromFirmCorpus:true,noAutomaticLegalConclusions:true};
 const existing=await supabase.from("jurisdiction_packs").select("id").eq("source_scope","firm").eq("firm_id",input.scope.firmId).eq("jurisdiction_key",jurisdiction).eq("status","active").order("updated_at",{ascending:false}).limit(1).maybeSingle();if(existing.error)throw new Error(existing.error.message);
 const payload={firm_id:input.scope.firmId,source_scope:"firm",jurisdiction_key:jurisdiction,system_label:`${jurisdiction} — firm reviewed legal-source pack`,status:"active",coverage,source_register:sourceRegister,reviewed_by:input.scope.actorLawyerId??null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const result=existing.data?await supabase.from("jurisdiction_packs").update(payload).eq("id",existing.data.id).select("*").single():await supabase.from("jurisdiction_packs").insert({...payload,version:`firm-${Date.now()}`}).select("*").single();
 if(result.error)throw new Error(result.error.message);return result.data;
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
 const existing=await supabase.from("firm_knowledge_entries").select("id").eq("firm_id",input.scope.firmId).eq("source_outcome_id",outcome.data.id).maybeSingle();if(existing.error)throw new Error(existing.error.message);if(existing.data)return existing.data;
 const result=await supabase.from("firm_knowledge_entries").insert({firm_id:input.scope.firmId,source_matter_id:input.matterId,source_outcome_id:outcome.data.id,title:outcome.data.title,summary:outcome.data.reusable_lesson||outcome.data.result_summary,practice_area:matter.data.practice_area||null,jurisdiction:matter.data.jurisdiction||null,status:"approved",approved_by:input.scope.actorLawyerId??null,approved_at:new Date().toISOString()}).select("*").single();
 if(result.error)throw new Error(result.error.message);return result.data;
}
