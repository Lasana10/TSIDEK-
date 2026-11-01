import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
export async function POST(request:Request) {
 try {
  const scope=await resolveRequestScope(request);
  if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)return NextResponse.json({success:false,error:"Authenticated professional identity and firm required"},{status:401});
  await assertFirmPermission({scope,permission:"manageFirm"});
  const input=await request.json() as Record<string,unknown>;
  const sourceId=String(input.sourceId||"");
  if(!/^[0-9a-f-]{36}$/i.test(sourceId))return NextResponse.json({success:false,error:"Valid source ID required"},{status:400});
  const action=String(input.action??"");
  const sourceClass=String(input.sourceClass??"unclassified");
  const note=String(input.note??"").trim(),rights=String(input.rightsAttestation??"").trim();
  if(!["verify","reject","revoke"].includes(action)||!["official","secondary","internal","unclassified"].includes(sourceClass)||note.length<20)
    return NextResponse.json({success:false,error:"Valid review decision, source class and detailed rationale required"},{status:400});
  const db=createServerSupabaseClient();if(!db)throw Error("Source registry unavailable");
  const r=await db.rpc("tsidek_review_legal_source",{p_firm_id:scope.firmId,p_reviewer_id:scope.actorLawyerId,p_source_id:sourceId,
   p_action:action,p_source_class:sourceClass,p_note:note,p_rights_attestation:rights});
  if(r.error)throw Error(r.error.message);
  return NextResponse.json({success:true,result:r.data},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to review source"},{status:403});}
}
