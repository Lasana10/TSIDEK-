import { NextResponse } from "next/server";
import { assertMatterPermission } from "@/lib/authorization";
import { runGovernedAi, type AiUserMode } from "@/lib/ai-runtime.server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{interactionId:string}>};
const types=new Set(["fact","changed_fact","contradiction","instruction","commitment","deadline","document","person","organisation","risk","research_question","task","payment","conflict_name","client_update"]);

function extractJson(value:string){
 const fenced=value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
 const source=fenced||value.trim();
 try{return JSON.parse(source)}catch{
  const start=source.indexOf("[");const end=source.lastIndexOf("]");
  if(start>=0&&end>start)return JSON.parse(source.slice(start,end+1));
  throw new Error("AI analysis did not return valid structured suggestions.");
 }
}

export async function POST(request:Request,context:Context){
 try{
  const scope=await resolveRequestScope(request);
  if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const {interactionId}=await context.params;
  const interactionResult=await supabase.from("legal_interactions").select("*").eq("id",interactionId).eq("firm_id",scope.firmId).maybeSingle();
  if(interactionResult.error)throw new Error(interactionResult.error.message);if(!interactionResult.data)throw new Error("Interaction not found.");
  const interaction=interactionResult.data;
  if(interaction.matter_id)await assertMatterPermission({scope,matterId:interaction.matter_id,allowAnyMember:true});
  const policyResult=await supabase.from("firm_interaction_policies").select("ai_extraction_enabled,transcription_enabled,default_ai_mode").eq("firm_id",scope.firmId).maybeSingle();
  if(policyResult.error)throw new Error(policyResult.error.message);
  if(policyResult.data?.ai_extraction_enabled===false)return NextResponse.json({success:false,error:"AI interaction extraction is disabled by firm policy."},{status:409});
  const source=[interaction.subject?`Subject: ${interaction.subject}`:"",interaction.raw_note?`Staff note:\n${interaction.raw_note}`:"",interaction.transcript_text?`Transcript:\n${interaction.transcript_text}`:""].filter(Boolean).join("\n\n");
  if(!source.trim())return NextResponse.json({success:false,error:"Add a note or authorised transcript before requesting analysis."},{status:400});
  await supabase.from("legal_interactions").update({ai_analysis_status:"processing",updated_at:new Date().toISOString()}).eq("id",interactionId);
  const prompt=`You are TSIDKENU's legal interaction extraction assistant. Extract only information supported by the supplied interaction. Do not give legal advice and do not infer missing facts. Return ONLY a JSON array. Each object must contain: extraction_type, summary, detail. Allowed extraction_type values: fact, changed_fact, contradiction, instruction, commitment, deadline, document, person, organisation, risk, research_question, task, payment, conflict_name, client_update. For deadlines and commitments, put any clearly stated date/time in detail.due_at using ISO format only if the source supports it. For commitments, include detail.commitment_by and optional detail.commitment_to. For client updates, include detail.title if helpful. Mark uncertainty in detail.notes instead of inventing certainty.\n\nINTERACTION:\n${source}`;
  const mode=String(policyResult.data?.default_ai_mode||"standard") as AiUserMode;
  const result=await runGovernedAi({scope,matterId:interaction.matter_id,interactionId,taskType:"interaction_extraction",prompt,userMode:mode});
  const parsed=extractJson(result.output);
  const suggestions=Array.isArray(parsed)?parsed:[];
  const rows=suggestions.map((item:unknown)=>{
   const value=item&&typeof item==="object"?item as Record<string,unknown>:{};
   const extractionType=String(value.extraction_type??"");
   const summary=String(value.summary??"").trim();
   if(!types.has(extractionType)||!summary)return null;
   return {firm_id:scope.firmId,interaction_id:interactionId,extraction_type:extractionType,summary,detail:value.detail&&typeof value.detail==="object"?value.detail:{},status:"suggested"};
  }).filter(Boolean);
  if(rows.length){const inserted=await supabase.from("interaction_extractions").insert(rows);if(inserted.error)throw new Error(inserted.error.message);}
  const update=await supabase.from("legal_interactions").update({ai_analysis_status:"review_required",ai_suggestions:{count:rows.length,run_id:result.runId,generated_at:result.generatedAt},updated_at:new Date().toISOString()}).eq("id",interactionId);if(update.error)throw new Error(update.error.message);
  return NextResponse.json({success:true,suggestionCount:rows.length,status:"review_required"});
 }catch(error){
  try{const {interactionId}=await context.params;const supabase=createServerSupabaseClient();if(supabase)await supabase.from("legal_interactions").update({ai_analysis_status:"failed",updated_at:new Date().toISOString()}).eq("id",interactionId);}catch{}
  return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to analyse interaction."},{status:403});
 }
}
