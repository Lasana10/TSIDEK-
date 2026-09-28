import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadTenantCredentials } from "@/lib/tenant-credentials.server";
import { persistUploadedFile } from "@/lib/file-vault";

type Context={params:Promise<{firmId:string}>};
type Attachment={filename?:string;mimeType?:string;base64?:string};

function safeEqual(a:string,b:string){
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
function normalizeEmail(value:unknown){return String(value??"").trim().toLowerCase();}
function safeName(value:unknown,email:string){const v=String(value??"").trim();return v||email||"Email enquiry";}

export async function POST(request:Request,context:Context){
  try{
    const {firmId}=await context.params;
    const credentials=await loadTenantCredentials(firmId,"smtp");
    const expected=credentials?.inboundSecret||"";
    const supplied=request.headers.get("x-tsidkenu-inbound-secret")||"";
    if(!expected||!supplied||!safeEqual(expected,supplied)) return NextResponse.json({success:false,error:"Invalid inbound email bridge secret."},{status:401});
    const payload=await request.json() as Record<string,unknown>;
    const from=normalizeEmail(payload.from);
    const fromName=safeName(payload.fromName,from);
    const subject=String(payload.subject??"Inbound email").trim().slice(0,500);
    const text=String(payload.text??payload.body??"").trim();
    const messageId=String(payload.messageId??"").trim()||null;
    if(!from) return NextResponse.json({success:false,error:"Inbound sender email is required."},{status:400});
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");

    const party=await supabase.from("parties").select("id,display_name,email,client_status").eq("firm_id",firmId).eq("email",from).maybeSingle();
    if(party.error) throw new Error(party.error.message);
    let partyId=party.data?.id||null;
    let prospectId:string|null=null;
    if(!partyId){
      const createdParty=await supabase.from("parties").insert({
        firm_id:firmId,party_type:"individual",display_name:fromName,email:from,client_status:"contact",
        preferred_language:"en",communication_preferences:{preferred_channel:"email"},metadata:{source:"inbound_email_bridge"}
      }).select("id").single();
      if(createdParty.error) throw new Error(createdParty.error.message);
      partyId=createdParty.data.id;
      const prospect=await supabase.from("prospects").insert({
        firm_id:firmId,prospect_name:fromName,contact_name:fromName,contact_email:from,source:"email",
        matter_summary:text.slice(0,2000)||subject,status:"new",risk_level:"unreviewed",
        conflict_status:"pending",engagement_status:"not_started",primary_party_id:partyId
      }).select("id").single();
      if(prospect.error) throw new Error(prospect.error.message);
      prospectId=prospect.data.id;
    }else{
      const existingProspect=await supabase.from("prospects").select("id").eq("firm_id",firmId).eq("primary_party_id",partyId).in("status",["new","intake","open"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(!existingProspect.error) prospectId=existingProspect.data?.id||null;
    }

    const matters=await supabase.from("matters").select("id,title,client_name,case_reference,client_party_id,status").eq("firm_id",firmId).order("updated_at",{ascending:false}).limit(600);
    if(matters.error) throw new Error(matters.error.message);
    const lowerSubject=subject.toLowerCase();
    let matter=(matters.data??[]).find(x=>x.case_reference&&lowerSubject.includes(String(x.case_reference).toLowerCase()))||null;
    if(!matter&&partyId){
      const related=(matters.data??[]).filter(x=>x.client_party_id===partyId&&!/closed|archived/i.test(String(x.status||"")));
      if(related.length===1) matter=related[0];
    }

    const attachmentRows:Array<Record<string,unknown>>=[];
    const attachments=Array.isArray(payload.attachments)?payload.attachments as Attachment[]:[];
    for(const attachment of attachments.slice(0,12)){
      const filename=String(attachment.filename??"attachment").replace(/[\\/]/g,"-").slice(0,180);
      const base64=String(attachment.base64??"");
      if(!base64) continue;
      const buffer=Buffer.from(base64,"base64");
      if(!buffer.length||buffer.length>12_000_000) continue;
      const file=new File([buffer],filename,{type:String(attachment.mimeType??"application/octet-stream")});
      const stored=await persistUploadedFile({file,relativeDirectory:`storage/firms/${firmId}/email/${matter?.id||"intake"}/attachments`});
      attachmentRows.push({filename,storagePath:stored.relativePath,mimeType:stored.mimeType,sizeBytes:stored.sizeBytes,provider:stored.provider});
    }

    const interaction=await supabase.from("legal_interactions").insert({
      firm_id:firmId,matter_id:matter?.id||null,prospect_id:prospectId,primary_party_id:partyId,
      interaction_type:"email",direction:"inbound",occurred_at:new Date().toISOString(),subject,raw_note:text||null,
      source_reference:messageId,confidentiality_level:"firm",transcript_status:"not_requested",ai_analysis_status:"not_requested",
      verification_status:"unreviewed",client_cycle_stage:matter?"matter":prospectId?"enquiry":"intake",
      metadata:{source:"inbound_email_bridge",sender:from,sender_name:fromName,attachments:attachmentRows}
    }).select("id,matter_id,prospect_id,primary_party_id").single();
    if(interaction.error) throw new Error(interaction.error.message);
    return NextResponse.json({success:true,interaction:interaction.data,matchedMatter:matter?{id:matter.id,caseReference:matter.case_reference,title:matter.title}:null,newEnquiry:Boolean(prospectId&&!party.data),attachmentsStored:attachmentRows.length},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Inbound email processing failed."},{status:400})}
}
