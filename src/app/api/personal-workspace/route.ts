import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase-auth";

const HEADERS = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" };
const PROFESSIONS = new Set(["unspecified","lawyer","bailiff","magistrate","clerk","paralegal","student","client","other"]);
const KINDS = new Set(["note","task","research"]);
const STATUSES = new Set(["open","done","archived"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(data:Record<string,unknown>,status=200){return NextResponse.json(data,{status,headers:HEADERS});}
function invalid(error:string){return json({success:false,error},400);}
async function context(){
 const db=await createServerAuthClient();
 if(!db)return null;
 const {data,error}=await db.auth.getUser();
 if(error)throw new Error("Session validation failed.");
 return data.user?{db,user:data.user}:null;
}
function failure(error:unknown){return json({success:false,error:error instanceof Error?error.message:"Personal workspace operation failed."},500);}

export async function GET(){
 try{
  const c=await context();if(!c)return json({success:false,error:"Authentication required."},401);
  const [profile,items,memberships]=await Promise.all([
   c.db.from("tsidek_personal_profiles").select("display_name,profession_claim,preferred_language").eq("user_id",c.user.id).maybeSingle(),
   c.db.from("tsidek_personal_items").select("id,kind,title,body,status,due_at,created_at,updated_at").eq("owner_id",c.user.id).order("updated_at",{ascending:false}).limit(100),
   c.db.from("firm_memberships").select("firm_id,role_key,title").eq("user_id",c.user.id).eq("status","active")
  ]);
  if(profile.error||items.error||memberships.error)throw new Error(profile.error?.message??items.error?.message??memberships.error?.message);
  return json({success:true,email:c.user.email??null,profile:profile.data,items:items.data??[],firmMemberships:memberships.data??[],authorityVerified:false});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const c=await context();if(!c)return json({success:false,error:"Authentication required."},401);
  const body=await request.json() as Record<string,unknown>;
  if(body.action==="profile"){
   const name=String(body.displayName??"").trim(), profession=String(body.profession??"unspecified"),lang=String(body.language??"en");
   if(!name||name.length>120||!PROFESSIONS.has(profession)||!["en","fr"].includes(lang))return invalid("Invalid profile.");
   const existing=await c.db.from("tsidek_personal_profiles").select("user_id").eq("user_id",c.user.id).maybeSingle();
   if(existing.error)throw new Error(existing.error.message);
   const result=existing.data
     ? await c.db.from("tsidek_personal_profiles").update({display_name:name,profession_claim:profession,preferred_language:lang,updated_at:new Date().toISOString()}).eq("user_id",c.user.id).select("display_name,profession_claim,preferred_language").single()
     : await c.db.from("tsidek_personal_profiles").insert({user_id:c.user.id,display_name:name,profession_claim:profession,preferred_language:lang}).select("display_name,profession_claim,preferred_language").single();
   if(result.error)throw new Error(result.error.message);
   return json({success:true,profile:result.data});
  }
  if(body.action==="create_item"){
   const kind=String(body.kind??""),title=String(body.title??"").trim(),text=String(body.body??"");
   if(!KINDS.has(kind)||!title||title.length>180||text.length>20000)return invalid("Invalid personal item.");
   const result=await c.db.from("tsidek_personal_items").insert({owner_id:c.user.id,kind,title,body:text}).select("id,kind,title,body,status").single();
   if(result.error)throw new Error(result.error.message);
   return json({success:true,item:result.data},201);
  }
  return invalid("Unsupported action.");
 }catch(error){return failure(error);}
}
export async function PATCH(request:Request){
 try{
  const c=await context();if(!c)return json({success:false,error:"Authentication required."},401);
  const body=await request.json() as Record<string,unknown>;
  const id=String(body.id??""),status=String(body.status??"");
  if(!UUID.test(id)||!STATUSES.has(status))return invalid("Invalid item status.");
  const result=await c.db.from("tsidek_personal_items").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",c.user.id).select("id,status").maybeSingle();
  if(result.error)throw new Error(result.error.message);
  if(!result.data)return json({success:false,error:"Item not found."},404);
  return json({success:true,item:result.data});
 }catch(error){return failure(error);}
}
export async function DELETE(request:Request){
 try{
  const c=await context();if(!c)return json({success:false,error:"Authentication required."},401);
  const id=new URL(request.url).searchParams.get("id")??"";
  if(!UUID.test(id))return invalid("Invalid item.");
  const result=await c.db.from("tsidek_personal_items").delete().eq("id",id).eq("owner_id",c.user.id).select("id").maybeSingle();
  if(result.error)throw new Error(result.error.message);
  if(!result.data)return json({success:false,error:"Item not found."},404);
  return json({success:true});
 }catch(error){return failure(error);}
}
