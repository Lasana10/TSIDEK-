import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission,assertFirmModule } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";
type Context={params:Promise<{matterId:string}>};
async function runtime(request:Request,matterId:string){
 const scope=await resolveRequestScope(request);
 if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated professional session required.");
 await assertMatterPermission({scope,matterId,allowAnyMember:true});
 await assertFirmModule({scope,module:"client_portal"});
 const db=createServerSupabaseClient();if(!db)throw new Error("Supabase configuration required.");
 const m=await db.from("matters").select("id,firm_id,status").eq("id",matterId).eq("firm_id",scope.firmId).maybeSingle();
 if(m.error)throw new Error(m.error.message);if(!m.data)throw new Error("Matter unavailable in current firm.");
 return {scope,db,matter:m.data};
}
export async function GET(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db}=await runtime(request,matterId);
  const [updates,grants,pubs,acks]=await Promise.all([
   db.from("matter_client_updates").select("id,title,body,status,channel,approved_at,created_at,client_acknowledged_at").eq("firm_id",scope.firmId).eq("matter_id",matterId).order("created_at",{ascending:false}).limit(60),
   db.from("client_portal_grants").select("id,client_email,grant_status,can_view_updates,revoked_at").eq("firm_id",scope.firmId).eq("matter_id",matterId).eq("grant_status","ACTIVE").is("revoked_at",null),
   db.from("tsidek_client_update_publications").select("id,update_id,grant_id,client_email,published_at").eq("firm_id",scope.firmId).eq("matter_id",matterId),
   db.from("tsidek_client_update_acknowledgements").select("id,publication_id,update_id,client_email,acknowledged_at").eq("firm_id",scope.firmId).eq("matter_id",matterId)
  ]);
  for(const r of [updates,grants,pubs,acks])if(r.error)throw new Error(r.error.message);
  return NextResponse.json({success:true,updates:updates.data,grants:(grants.data||[]).filter(g=>g.can_view_updates),publications:pubs.data,acknowledgements:acks.data},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load client delivery."},{status:statusForApiError(error)});}
}
export async function POST(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db,matter}=await runtime(request,matterId);
  if(matter.status==="Closed")return NextResponse.json({success:false,error:"Closed matter cannot issue new client updates."},{status:409});
  const body=await request.json() as {action?:string;updateId?:string;grantId?:string;title?:string;message?:string};
  const action=String(body.action||"");
  if(action==="draft"){
   await assertMatterPermission({scope,matterId,permission:"assignWork"});
   const title=String(body.title||"").trim(),message=String(body.message||"").trim();
   if(title.length<4||title.length>180||message.length<10||message.length>10000)return NextResponse.json({success:false,error:"Title and message must be complete and within length limits."},{status:400});
   const r=await db.from("matter_client_updates").insert({firm_id:scope.firmId,matter_id:matterId,title,body:message,message,channel:"In-app",status:"Draft",created_by:scope.actorLawyerId,drafted_by:scope.actorLawyerId}).select("id,title,status").single();
   if(r.error)throw new Error(r.error.message);
   return NextResponse.json({success:true,update:r.data},{status:201});
  }
  if(action!=="approve"&&action!=="publish")return NextResponse.json({success:false,error:"Unsupported action."},{status:400});
  await assertMatterPermission({scope,matterId,permission:"approveFilings"});
  const updateId=String(body.updateId||"");
  const grantId=action==="publish"?String(body.grantId||""):null;
  if(!/^[0-9a-f-]{36}$/i.test(updateId)||(grantId&&!/^[0-9a-f-]{36}$/i.test(grantId)))return NextResponse.json({success:false,error:"Valid update and grant identifiers required."},{status:400});
  const r=await db.rpc("tsidek_client_update_author_action",{
   p_firm_id:scope.firmId,p_matter_id:matterId,p_actor_id:scope.actorLawyerId,
   p_action:action,p_update_id:updateId,p_grant_id:grantId
  });
  if(r.error)throw new Error(r.error.message);
  return NextResponse.json({success:true,result:r.data});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Client delivery action failed."},{status:statusForApiError(error)});}
}
