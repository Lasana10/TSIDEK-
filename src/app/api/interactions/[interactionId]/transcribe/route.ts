import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { transcribeVaultRecording } from "@/lib/transcription.server";

type Context={params:Promise<{interactionId:string}>};
export async function POST(request:Request,context:Context){
 try{
  const{interactionId}=await context.params;const scope=await resolveRequestScope(request);if(!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const interaction=await supabase.from("legal_interactions").select("id,firm_id,matter_id,recording_storage_ref,transcript_status,confidentiality_level,consent_recording,metadata").eq("id",interactionId).eq("firm_id",scope.firmId).single();if(interaction.error)throw new Error(interaction.error.message);
  if(interaction.data.matter_id)await assertMatterPermission({scope,matterId:interaction.data.matter_id,allowAnyMember:true});
  const policy=await supabase.from("firm_interaction_policies").select("transcription_enabled,ai_extraction_enabled").eq("firm_id",scope.firmId).single();if(policy.error)throw new Error(policy.error.message);
  if(!policy.data.transcription_enabled)return NextResponse.json({success:false,error:"Transcription is disabled by firm policy."},{status:409});
  if(interaction.data.consent_recording!==true)return NextResponse.json({success:false,error:"Recording consent is required before transcription."},{status:409});
  if(interaction.data.confidentiality_level==="highly_confidential")return NextResponse.json({success:false,error:"Highly confidential transcription must use a matter-approved local/private processing route."},{status:409});
  if(!interaction.data.recording_storage_ref)return NextResponse.json({success:false,error:"No recording is attached to this interaction."},{status:409});
  await supabase.from("legal_interactions").update({transcript_status:"processing",updated_at:new Date().toISOString()}).eq("id",interactionId);
  try{
    const language=typeof interaction.data.metadata?.language==="string"?interaction.data.metadata.language:null;
    const result=await transcribeVaultRecording({storagePath:interaction.data.recording_storage_ref,language});
    const updated=await supabase.from("legal_interactions").update({transcript_text:result.text,transcript_status:"completed",ai_analysis_status:policy.data.ai_extraction_enabled?"queued":"not_requested",updated_at:new Date().toISOString(),metadata:{...(interaction.data.metadata??{}),transcription:{provider:result.providerLabel,model:result.model,completed_at:new Date().toISOString()}}}).eq("id",interactionId).select("*").single();if(updated.error)throw new Error(updated.error.message);
    return NextResponse.json({success:true,interaction:updated.data,transcriptLength:result.text.length});
  }catch(error){await supabase.from("legal_interactions").update({transcript_status:"failed",updated_at:new Date().toISOString()}).eq("id",interactionId);throw error;}
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to transcribe interaction."},{status:403});}
}
