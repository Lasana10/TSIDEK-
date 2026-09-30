import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { persistUploadedFile } from "@/lib/file-vault";

type Ctx={params:Promise<{token:string}>};
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

async function resolveReview(token:string){
  const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
  const review=await supabase.from("workroom_external_reviews").select("*").eq("token_hash",hash(token)).maybeSingle();
  if(review.error) throw new Error(review.error.message);
  if(!review.data) throw new Error("Review link is invalid.");
  if(review.data.revoked_at) throw new Error("Review link has been revoked.");
  if(new Date(review.data.expires_at).getTime()<Date.now()) throw new Error("Review link has expired.");
  return {supabase,review:review.data};
}

export async function GET(_:Request,context:Ctx){
  try{
    const {token}=await context.params; const {supabase,review}=await resolveReview(token);
    const thread=await supabase.from("workroom_threads").select("id,title,description,thread_type").eq("id",review.thread_id).eq("firm_id",review.firm_id).maybeSingle();
    if(thread.error) throw new Error(thread.error.message); if(!thread.data) throw new Error("Conversation no longer exists.");
    let messagesQuery=supabase.from("workroom_messages").select("id,body,message_type,created_at,created_by,metadata").eq("thread_id",review.thread_id).eq("firm_id",review.firm_id).order("created_at",{ascending:true}).limit(200);
    const selected=Array.isArray(review.selected_message_ids)?review.selected_message_ids.map(String):[];
    if(selected.length) messagesQuery=messagesQuery.in("id",selected);
    const [messages,events]=await Promise.all([
      messagesQuery,
      supabase.from("workroom_external_review_events").select("id,event_type,author_label,body,metadata,created_at").eq("review_id",review.id).order("created_at",{ascending:true}).limit(300)
    ]);
    if(messages.error) throw new Error(messages.error.message); if(events.error) throw new Error(events.error.message);
    await supabase.from("workroom_external_review_events").insert({review_id:review.id,firm_id:review.firm_id,thread_id:review.thread_id,event_type:"opened",author_label:review.reviewer_label,metadata:{}});
    return NextResponse.json({success:true,review:{title:review.title,reviewerLabel:review.reviewer_label,accessScope:review.access_scope,allowComment:review.allow_comment,allowUpload:review.allow_upload,allowAiReview:review.allow_ai_review,expiresAt:review.expires_at},thread:thread.data,messages:messages.data??[],events:events.data??[]});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"External review unavailable."},{status:403})}
}

export async function POST(request:Request,context:Ctx){
  try{
    const {token}=await context.params; const {supabase,review}=await resolveReview(token);
    const contentType=request.headers.get("content-type")||"";
    if(contentType.includes("multipart/form-data")){
      if(!review.allow_upload) return NextResponse.json({success:false,error:"Uploads are disabled for this review link."},{status:403});
      const form=await request.formData(); const file=form.get("file");
      if(!(file instanceof File)||file.size<=0) return NextResponse.json({success:false,error:"Choose a file to upload."},{status:400});
      if(file.size>15_000_000) return NextResponse.json({success:false,error:"External review uploads must be 15 MB or smaller."},{status:400});
      const saved=await persistUploadedFile({file,relativeDirectory:`storage/firms/${review.firm_id}/external-reviews/${review.id}`});
      const created=await supabase.from("workroom_external_review_events").insert({
        review_id:review.id,firm_id:review.firm_id,thread_id:review.thread_id,event_type:"upload",author_label:review.reviewer_label,
        body:file.name,metadata:{storage_path:saved.relativePath,storage_provider:saved.provider,mime_type:saved.mimeType,size_bytes:saved.sizeBytes,original_name:file.name}
      }).select("*").single();
      if(created.error) throw new Error(created.error.message);
      return NextResponse.json({success:true,event:created.data},{status:201});
    }
    const body=await request.json(); const action=String(body.action??"comment");
    if(action==="comment"){
      if(!review.allow_comment) return NextResponse.json({success:false,error:"Comments are disabled for this review link."},{status:403});
      const text=String(body.body??"").trim(); if(!text) return NextResponse.json({success:false,error:"Comment is required."},{status:400});
      const created=await supabase.from("workroom_external_review_events").insert({review_id:review.id,firm_id:review.firm_id,thread_id:review.thread_id,event_type:"comment",author_label:String(body.authorLabel??review.reviewer_label??"External reviewer").trim(),body:text,metadata:{}}).select("*").single();
      if(created.error) throw new Error(created.error.message);
      return NextResponse.json({success:true,event:created.data},{status:201});
    }
    if(action==="request_ai_review"){
      if(!review.allow_ai_review) return NextResponse.json({success:false,error:"AI review requests are disabled for this review link."},{status:403});
      const created=await supabase.from("workroom_external_review_events").insert({review_id:review.id,firm_id:review.firm_id,thread_id:review.thread_id,event_type:"ai_review_requested",author_label:review.reviewer_label,body:String(body.instruction??"Review the shared material and flag issues.").trim(),metadata:{status:"pending_internal_authorization"}}).select("*").single();
      if(created.error) throw new Error(created.error.message);
      return NextResponse.json({success:true,event:created.data,message:"AI review request recorded. An authorized firm user must execute the AI review."},{status:201});
    }
    return NextResponse.json({success:false,error:"Unsupported external review action."},{status:400});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"External review action failed."},{status:400})}
}
