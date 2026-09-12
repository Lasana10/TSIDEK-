import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{matterId:string}>};

type Activity={id:string;kind:string;title:string;detail?:string|null;at:string;status?:string|null;sourceId?:string|null};

export async function GET(request:Request,context:Context){
 try{
  const {matterId}=await context.params;const scope=await resolveRequestScope(request);await assertMatterPermission({scope,matterId,allowAnyMember:true});
  if(!scope.firmId)throw new Error("Authenticated firm context is required.");const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const [events,interactions,tasks,documents,updates,ledger,commitments]=await Promise.all([
   supabase.from("matter_events").select("id,event_type,title,details,created_at").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
   supabase.from("legal_interactions").select("id,interaction_type,subject,raw_note,verification_status,occurred_at").eq("matter_id",matterId).order("occurred_at",{ascending:false}).limit(80),
   supabase.from("tasks").select("id,title,description,status,created_at,deadline").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
   supabase.from("documents").select("id,title,document_type,status,review_status,created_at").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
   supabase.from("matter_client_updates").select("id,title,body,status,delivery_status,created_at").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
   supabase.from("finance_ledger_entries").select("id,entry_type,description,status,amount_xaf,created_at").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
   supabase.from("matter_commitments").select("id,description,status,due_at,created_at").eq("matter_id",matterId).order("created_at",{ascending:false}).limit(80),
  ]);
  for(const result of [events,interactions,tasks,documents,updates,ledger,commitments])if(result.error)throw new Error(result.error.message);
  const activity:Activity[]=[
   ...(events.data??[]).map(row=>({id:`event:${row.id}`,kind:"event",title:row.title,detail:row.details,at:row.created_at,status:row.event_type,sourceId:row.id})),
   ...(interactions.data??[]).map(row=>({id:`interaction:${row.id}`,kind:"interaction",title:row.subject||row.interaction_type.replaceAll("_"," "),detail:row.raw_note,at:row.occurred_at,status:row.verification_status,sourceId:row.id})),
   ...(tasks.data??[]).map(row=>({id:`task:${row.id}`,kind:"task",title:row.title,detail:row.description,at:row.created_at,status:row.status,sourceId:row.id})),
   ...(documents.data??[]).map(row=>({id:`document:${row.id}`,kind:"document",title:row.title,detail:row.document_type,at:row.created_at,status:row.review_status||row.status,sourceId:row.id})),
   ...(updates.data??[]).map(row=>({id:`client:${row.id}`,kind:"client_update",title:row.title,detail:row.body,at:row.created_at,status:row.delivery_status||row.status,sourceId:row.id})),
   ...(ledger.data??[]).map(row=>({id:`finance:${row.id}`,kind:"finance",title:row.description||row.entry_type,detail:`${Number(row.amount_xaf||0).toLocaleString("fr-CM")} XAF`,at:row.created_at,status:row.status,sourceId:row.id})),
   ...(commitments.data??[]).map(row=>({id:`commitment:${row.id}`,kind:"commitment",title:row.description,detail:row.due_at?`Due ${new Date(row.due_at).toLocaleString()}`:null,at:row.created_at,status:row.status,sourceId:row.id})),
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,120);
  return NextResponse.json({success:true,activity});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load matter activity."},{status:403});}
}
