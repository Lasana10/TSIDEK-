import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"manageClientAccess"});
    if(!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const threadId=new URL(request.url).searchParams.get("threadId");
    let query=supabase.from("workroom_external_reviews").select("id,thread_id,matter_id,reviewer_label,reviewer_email,access_scope,allow_comment,allow_upload,allow_ai_review,selected_message_ids,title,expires_at,revoked_at,created_at").eq("firm_id",scope.firmId).order("created_at",{ascending:false});
    if(threadId) query=query.eq("thread_id",threadId);
    const reviews=await query.limit(200); if(reviews.error) throw new Error(reviews.error.message);
    return NextResponse.json({success:true,reviews:reviews.data??[]});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load external reviews."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"manageClientAccess"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body=await request.json(); const action=String(body.action??"create");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    if(action==="revoke"){
      const updated=await supabase.from("workroom_external_reviews").update({revoked_at:new Date().toISOString()}).eq("id",String(body.id??"")).eq("firm_id",scope.firmId).select("id,revoked_at").single();
      if(updated.error) throw new Error(updated.error.message); return NextResponse.json({success:true,review:updated.data});
    }
    const threadId=String(body.threadId??"").trim(); if(!threadId) return NextResponse.json({success:false,error:"Thread is required."},{status:400});
    const thread=await supabase.from("workroom_threads").select("id,matter_id,title").eq("id",threadId).eq("firm_id",scope.firmId).maybeSingle();
    if(thread.error) throw new Error(thread.error.message); if(!thread.data) return NextResponse.json({success:false,error:"Conversation not found."},{status:404});
    if(thread.data.matter_id) await assertMatterPermission({scope,matterId:thread.data.matter_id,permission:"manageClientAccess"});
    const token=randomBytes(32).toString("base64url");
    const days=Math.min(30,Math.max(1,Number(body.expiresInDays??7)||7));
    const selected=Array.isArray(body.selectedMessageIds)?body.selectedMessageIds.map(String).slice(0,100):[];
    const created=await supabase.from("workroom_external_reviews").insert({
      firm_id:scope.firmId,thread_id:threadId,matter_id:thread.data.matter_id,token_hash:hash(token),
      reviewer_label:String(body.reviewerLabel??"External reviewer").trim()||"External reviewer",
      reviewer_email:String(body.reviewerEmail??"").trim().toLowerCase()||null,
      access_scope:selected.length?"selected_messages":"thread_summary",allow_comment:body.allowComment!==false,
      allow_upload:Boolean(body.allowUpload),allow_ai_review:Boolean(body.allowAiReview),selected_message_ids:selected,
      title:String(body.title??thread.data.title??"External review").trim(),expires_at:new Date(Date.now()+days*86400000).toISOString(),created_by:scope.actorLawyerId
    }).select("id,thread_id,matter_id,reviewer_label,reviewer_email,access_scope,allow_comment,allow_upload,allow_ai_review,selected_message_ids,title,expires_at,created_at").single();
    if(created.error) throw new Error(created.error.message);
    const origin=new URL(request.url).origin;
    return NextResponse.json({success:true,review:created.data,shareUrl:`${origin}/external-review/${token}`},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to create external review."},{status:400})}
}
