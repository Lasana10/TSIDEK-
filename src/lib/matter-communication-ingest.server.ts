import { createServerSupabaseClient } from "@/lib/supabase-server";

type Channel="email"|"whatsapp"|"sms"|"call"|"meeting"|"portal"|"internal"|"other";
type Direction="inbound"|"outbound"|"internal";

export async function recordMatterCommunicationCandidate(input:{
 firmId:string;matterId:string|null|undefined;channel:Channel;direction?:Direction;externalId?:string|null;sender?:string|null;recipients?:string[];subject?:string|null;bodyText?:string|null;occurredAt?:string;instructionCandidate?:boolean;evidenceCandidate?:boolean;metadata?:Record<string,unknown>;
}){
 if(!input.matterId||!input.externalId)return null;
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
 const existing=await supabase.from("matter_communication_ingest").select("id").eq("matter_id",input.matterId).eq("channel",input.channel).eq("external_id",input.externalId).maybeSingle();
 if(existing.error)throw new Error(existing.error.message);if(existing.data)return existing.data;
 const body=String(input.bodyText??"").trim();
 const result=await supabase.from("matter_communication_ingest").insert({
  firm_id:input.firmId,matter_id:input.matterId,channel:input.channel,direction:input.direction??"inbound",external_id:input.externalId,sender:input.sender??null,recipients:input.recipients??[],subject:input.subject??null,body_text:body||null,occurred_at:input.occurredAt??new Date().toISOString(),instruction_candidate:Boolean(input.instructionCandidate),evidence_candidate:Boolean(input.evidenceCandidate),processing_status:(input.instructionCandidate||input.evidenceCandidate)?"review_required":"recorded",metadata:input.metadata??{}
 }).select("id").single();
 if(result.error)throw new Error(result.error.message);return result.data;
}
