import {NextResponse} from "next/server";
import {resolveRequestScope} from "@/lib/request-scope";
import {assertFirmPermission,assertMatterPermission} from "@/lib/authorization";
import {createServerSupabaseClient} from "@/lib/supabase-server";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(error:unknown){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Source operation failed"},{status:403});}
export async function POST(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)
   return NextResponse.json({success:false,error:"Authenticated firm member required"},{status:401});
  const body=await request.json() as Record<string,unknown>,action=String(body.action??"");
  const db=createServerSupabaseClient();if(!db)throw new Error("Supabase private client unavailable");
  if(action==="review"){
   await assertFirmPermission({scope,permission:"manageEvidence"});
   const id=String(body.sourceId??""),classification=String(body.sourceClass??"unclassified");
   if(!uuid.test(id))return NextResponse.json({success:false,error:"Invalid legal source"},{status:400});
   if(!["verify","reject","revoke"].includes(String(body.decision))||!["official","secondary","internal","unclassified"].includes(classification))
    return NextResponse.json({success:false,error:"Invalid source review choice"},{status:400});
   const result=await db.rpc("tsidek_review_legal_source",{
    p_firm_id:scope.firmId,p_reviewer_id:scope.actorLawyerId,p_source_id:id,
    p_action:String(body.decision),p_source_class:classification,
    p_note:String(body.reviewNote??""),p_rights_attestation:String(body.rightsAttestation??"")
   });
   if(result.error)throw new Error(result.error.message);
   return NextResponse.json({success:true,result:result.data});
  }
  if(action==="cite"){
   const matterId=String(body.matterId??""),chunkId=String(body.chunkId??"");
   if(!uuid.test(matterId)||!uuid.test(chunkId))return NextResponse.json({success:false,error:"Valid matter and passage required"},{status:400});
   await assertMatterPermission({scope,matterId,allowAnyMember:true});
   const result=await db.rpc("tsidek_save_matter_source_citation",{
    p_firm_id:scope.firmId,p_matter_id:matterId,p_author_id:scope.actorLawyerId,
    p_chunk_id:chunkId,p_note:String(body.note??"")
   });
   if(result.error)throw new Error(result.error.message);
   return NextResponse.json({success:true,result:result.data});
  }
  return NextResponse.json({success:false,error:"Unsupported action"},{status:400});
 }catch(error){return response(error);}
}
export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId)
   return NextResponse.json({success:false,error:"Authenticated firm required"},{status:401});
  const db=createServerSupabaseClient();if(!db)throw new Error("Database unavailable");
  const matterId=new URL(request.url).searchParams.get("matterId");
  if(matterId){
   if(!uuid.test(matterId))return NextResponse.json({success:false,error:"Invalid matter"},{status:400});
   await assertMatterPermission({scope,matterId,allowAnyMember:true});
   const {data,error}=await db.from("tsidek_matter_source_citations")
    .select("id,source_title,source_checksum,source_version,quoted_excerpt,verified_at_snapshot,cited_at,citation_note")
    .eq("firm_id",scope.firmId).eq("matter_id",matterId).order("cited_at",{ascending:false}).limit(100);
   if(error)throw new Error(error.message);
   return NextResponse.json({success:true,citations:data},{headers:{"Cache-Control":"private, no-store"}});
  }
  await assertFirmPermission({scope,permission:"manageEvidence"});
  const {data,error}=await db.from("legal_source_documents")
   .select("id,title,publisher,jurisdiction,source_url,canonical_uri,version_label,ingestion_status,verification_status,source_class,verified_at,review_note,rights_attestation")
   .eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(100);
  if(error)throw new Error(error.message);
  return NextResponse.json({success:true,sources:data},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return response(error);}
}
