import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{matterId:string}>};
export async function GET(request:Request,context:Context){
 try{
  const{matterId}=await context.params;const scope=await resolveRequestScope(request);await assertMatterPermission({scope,matterId,allowAnyMember:true});if(!scope.firmId)throw new Error("Authenticated firm context is required.");const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const matter=await supabase.from("matters").select("id,title,matter_type,jurisdiction,procedural_stage,primary_track,risk_level").eq("id",matterId).eq("firm_id",scope.firmId).single();if(matter.error)throw new Error(matter.error.message);
  const params=await supabase.from("firm_legal_parameters").select("id,parameter_type,parameter_key,label_en,label_fr,description,configuration").eq("firm_id",scope.firmId).eq("parameter_type","procedure_track").eq("active",true).order("sort_order");if(params.error)throw new Error(params.error.message);
  const tracks=(params.data??[]).filter((p:any)=>{const c=p.configuration||{};const matterTypes=Array.isArray(c.matter_types)?c.matter_types.map((x:any)=>String(x).toLowerCase()):[];const jurisdictions=Array.isArray(c.jurisdictions)?c.jurisdictions.map((x:any)=>String(x).toLowerCase()):[];const mt=String(matter.data.matter_type||'').toLowerCase(),j=String(matter.data.jurisdiction||'').toLowerCase();return(!matterTypes.length||matterTypes.some((x:string)=>mt.includes(x)||x.includes(mt)))&&(!jurisdictions.length||jurisdictions.some((x:string)=>j.includes(x)||x.includes(j)));});
  const auth=await supabase.from("legal_authorities").select("id,title,citation,authority_type,issuing_body,jurisdiction,verification_status,valid_from,valid_until,source_url,provision_path").eq("firm_id",scope.firmId).ilike("jurisdiction",`%${matter.data.jurisdiction||''}%`).order("decision_or_issue_date",{ascending:false}).limit(20);if(auth.error)throw new Error(auth.error.message);
  const checklists=await supabase.from("compliance_checklists").select("id,title,checklist_type,overall_status,compliance_checklist_items(id,label,owner_name,due_date,status,evidence_note)").eq("matter_id",matterId).eq("firm_id",scope.firmId).order("created_at",{ascending:false});if(checklists.error)throw new Error(checklists.error.message);
  return NextResponse.json({success:true,matter:matter.data,procedureTracks:tracks,authorities:auth.data??[],compliance:checklists.data??[]});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load procedure guidance."},{status:403});}
}
