import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createVaultSignedReadUrl,getMatterDocumentRelativeDirectory,defaultVaultBucket } from "@/lib/file-vault";
export async function GET(_request:Request,{params}:{params:Promise<{documentId:string}>}){
 try{
  const identity=await getAuthenticatedUser();
  if(!identity?.user?.email)return NextResponse.json({success:false,error:"Sign in as an authorized client."},{status:401});
  const email=identity.user.email.trim().toLowerCase();
  const {documentId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(documentId))return NextResponse.json({success:false,error:"Document not found"},{status:404});
  const db=createServerSupabaseClient();if(!db)throw new Error("Private vault unavailable");
  const doc=await db.from("documents").select("id,matter_id,storage_path,status,review_status,sharing_policy").eq("id",documentId).maybeSingle();
  if(doc.error||!doc.data)return NextResponse.json({success:false,error:"Document not found"},{status:404});
  if(doc.data.sharing_policy!=="Client-share ready" || doc.data.review_status!=="Approved" || !["filed","archived"].includes(String(doc.data.status).toLowerCase()))
   return NextResponse.json({success:false,error:"This document has not been approved for client access."},{status:403});
  const grant=await db.from("client_portal_grants").select("id,firm_id").eq("matter_id",doc.data.matter_id)
   .eq("client_email",email).eq("grant_status","ACTIVE").eq("can_view_documents",true).is("revoked_at",null).limit(1).maybeSingle();
  if(grant.error||!grant.data)return NextResponse.json({success:false,error:"No active client document grant."},{status:403});
  const stored=String(doc.data.storage_path??"");
  const ownedPrefix=getMatterDocumentRelativeDirectory(doc.data.matter_id)+"/";
  if(!stored.startsWith(ownedPrefix) || stored.includes("..") || stored.includes("\\") || stored.startsWith("/"))
   return NextResponse.json({success:false,error:"Governed document original is unavailable."},{status:404});
  // The object is stored privately: signed links expire rapidly and are issued only
  // after checking both approved document state and the signed-in client's grant.
  const found=await db.storage.from(defaultVaultBucket).list(getMatterDocumentRelativeDirectory(doc.data.matter_id),{search:stored.slice(ownedPrefix.length),limit:20});
  if(found.error||!(found.data??[]).some(o=>o.name===stored.slice(ownedPrefix.length)))return NextResponse.json({success:false,error:"Approved document original not present in private vault."},{status:404});
  const signed=await createVaultSignedReadUrl(stored,90);
  return NextResponse.redirect(signed,{status:302,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to open client document"},{status:403});}
}
