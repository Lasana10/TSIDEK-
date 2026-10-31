import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";
type Context={params:Promise<{matterId:string}>};
async function ctx(request:Request,matterId:string){
 const scope=await resolveRequestScope(request);
 if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm professional required");
 await assertMatterPermission({scope,matterId,allowAnyMember:true});
 const db=createServerSupabaseClient();if(!db)throw new Error("Private document store unavailable");
 return {scope,db};
}
export async function GET(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db}=await ctx(request,matterId);
  const docs=await db.from("documents").select("id,title,document_type,status,review_status,sharing_policy,storage_path,created_at,updated_at,review_note")
   .eq("matter_id",matterId).order("created_at",{ascending:false}).limit(100);
  if(docs.error)throw new Error(docs.error.message);
  // Restrict views to their matter and keep private paths off the browser response.
  return NextResponse.json({success:true,documents:(docs.data??[]).map(({storage_path,...d})=>({...d,originalStored:Boolean(storage_path)})),firmId:scope.firmId},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to load documents"},{status:statusForApiError(e)});}
}
export async function POST(request:Request,{params}:Context){
 try{
  const {matterId}=await params;const {scope,db}=await ctx(request,matterId);
  const body=await request.json() as {action?:string;documentId?:string;note?:string};
  const action=String(body.action??"");
  if(!["submit","approve","return","file","archive","share","unshare"].includes(action))
   return NextResponse.json({success:false,error:"Unsupported document action"},{status:400});
  const id=String(body.documentId??"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({success:false,error:"Document identifier required"},{status:400});
  await assertMatterPermission({scope,matterId,permission:["approve","return","file","archive","share","unshare"].includes(action)?"approveFilings":"manageEvidence"});
  const result=await db.rpc("tsidek_transition_document_review",{
   p_firm_id:scope.firmId,p_matter_id:matterId,p_actor_id:scope.actorLawyerId,
   p_document_id:id,p_action:action,p_note:String(body.note??"")
  });
  if(result.error)throw new Error(result.error.message);
  return NextResponse.json({success:true,result:result.data});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to update document"},{status:statusForApiError(e)});}
}
