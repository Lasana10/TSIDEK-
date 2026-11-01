import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
type Context={params:Promise<{matterId:string}>};
async function member(request:Request,matterId:string){
 const scope=await resolveRequestScope(request);
 if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)throw Error("Authenticated firm member required");
 await assertMatterPermission({scope,matterId,allowAnyMember:true});
 const db=createServerSupabaseClient();if(!db)throw Error("Citations unavailable");
 return {scope,db};
}
export async function GET(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db}=await member(request,matterId);
  const r=await db.from("tsidek_matter_source_citations").select("id,source_document_id,chunk_id,source_title,source_checksum,source_version,quoted_excerpt,citation_note,verified_at_snapshot,cited_at")
   .eq("firm_id",scope.firmId).eq("matter_id",matterId).order("cited_at",{ascending:false}).limit(80);
  if(r.error)throw Error(r.error.message);
  return NextResponse.json({success:true,citations:r.data??[]},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to load citations"},{status:403});}
}
export async function POST(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db}=await member(request,matterId);
  await assertMatterPermission({scope,matterId,permission:"manageEvidence"});
  const input=await request.json() as Record<string,unknown>;
  const chunkId=String(input.chunkId??"");
  const note=String(input.note??"");
  if(!/^[0-9a-f-]{36}$/i.test(chunkId)||note.length>1000)return NextResponse.json({success:false,error:"Invalid cited passage or note"},{status:400});
  const r=await db.rpc("tsidek_save_matter_source_citation",{p_firm_id:scope.firmId,p_matter_id:matterId,p_author_id:scope.actorLawyerId,p_chunk_id:chunkId,p_note:note});
  if(r.error)throw Error(r.error.message);
  return NextResponse.json({success:true,citation:r.data},{status:201,headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to cite source"},{status:403});}
}
