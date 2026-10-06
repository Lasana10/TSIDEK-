import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request);
  if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const mattersResult=await supabase.from("matters").select("id,title,client_name,status,risk_level,lead_lawyer_id,engagement_nature,plan_label,confidentiality_level").eq("firm_id",scope.firmId).eq("record_state","active").order("updated_at",{ascending:false}).limit(300);
  if(mattersResult.error)throw new Error(mattersResult.error.message);
  const candidateIds=(mattersResult.data??[]).map(m=>m.id);
  if(!candidateIds.length)return NextResponse.json({success:true,matters:[],decisions:[],executions:[],instructions:[],handoffs:[],milestones:[]});
  const now=new Date().toISOString();
  const[memberships,overrides,firmMembership]=await Promise.all([
   supabase.from("matter_members").select("matter_id").eq("lawyer_id",scope.actorLawyerId).in("matter_id",candidateIds),
   supabase.from("matter_access_overrides").select("matter_id,access_type,expires_at,created_at").eq("lawyer_id",scope.actorLawyerId).in("matter_id",candidateIds).or(`expires_at.is.null,expires_at.gt.${now}`).order("created_at",{ascending:false}),
   supabase.from("firm_memberships").select("role_key,governance_role_key,status").eq("firm_id",scope.firmId).eq("user_id",scope.actorLawyerId).eq("status","active").maybeSingle(),
  ]);
  for(const result of[memberships,overrides,firmMembership])if(result.error)throw new Error(result.error.message);
  const memberIds=new Set((memberships.data??[]).map(x=>x.matter_id));
  const overrideByMatter=new Map<string,{access_type:string}>();for(const item of overrides.data??[])if(!overrideByMatter.has(item.matter_id))overrideByMatter.set(item.matter_id,item);
  const professionalRole=firmMembership.data?.role_key??"";const governanceRole=firmMembership.data?.governance_role_key??"member";
  const governor=["founder","firm_head","managing_partner","administrator"].includes(governanceRole)||["owner","managing_partner","partner","administrator"].includes(professionalRole);
  const matters=(mattersResult.data??[]).filter(matter=>{
   const override=overrideByMatter.get(matter.id);if(override?.access_type==="deny")return false;
   const explicitAllow=override?.access_type==="allow";const isLead=matter.lead_lawyer_id===scope.actorLawyerId;const isMember=memberIds.has(matter.id)||isLead||explicitAllow;if(!isMember)return false;
   const restricted=["partner-only","restricted"].includes(String(matter.confidentiality_level??"").toLowerCase());if(restricted&&!isLead&&!governor&&!explicitAllow)return false;
   return true;
  });
  const matterIds=matters.map(m=>m.id);if(!matterIds.length)return NextResponse.json({success:true,matters:[],decisions:[],executions:[],instructions:[],handoffs:[],milestones:[]});
  const[decisions,executions,instructions,handoffs,milestones]=await Promise.all([
   supabase.from("matter_decisions").select("id,matter_id,title,decision,status,authority_level,created_at").in("matter_id",matterIds).order("created_at",{ascending:false}).limit(300),
   supabase.from("matter_execution_actions").select("id,matter_id,title,status,execution_mode,target_system,due_at,created_at").in("matter_id",matterIds).order("created_at",{ascending:false}).limit(300),
   supabase.from("matter_client_instructions").select("id,matter_id,instruction,confirmation_status,received_at").in("matter_id",matterIds).order("received_at",{ascending:false}).limit(300),
   supabase.from("matter_handoffs").select("id,matter_id,purpose,status,external_professional,created_at").in("matter_id",matterIds).order("created_at",{ascending:false}).limit(300),
   supabase.from("matter_milestones").select("id,matter_id,title,status,due_at,sequence_no").in("matter_id",matterIds).order("sequence_no",{ascending:true}).limit(500),
  ]);for(const result of[decisions,executions,instructions,handoffs,milestones])if(result.error)throw new Error(result.error.message);
  return NextResponse.json({success:true,matters,decisions:decisions.data??[],executions:executions.data??[],instructions:instructions.data??[],handoffs:handoffs.data??[],milestones:milestones.data??[]});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load governed Workroom context."},{status:403});}
}
