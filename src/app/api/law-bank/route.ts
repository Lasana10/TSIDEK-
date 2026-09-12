import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request:Request){
 try{
  const scope=await resolveRequestScope(request);await assertFirmPermission({scope,permission:"openMatters"});if(!scope.firmId)throw new Error("Authenticated firm context is required.");
  const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
  const url=new URL(request.url);const q=(url.searchParams.get("q")||"").trim();const jurisdiction=(url.searchParams.get("jurisdiction")||"").trim();const type=(url.searchParams.get("type")||"").trim();
  let docs=supabase.from("legal_source_documents").select("id,firm_id,source_scope,publisher,jurisdiction,document_type,title,canonical_uri,source_url,language,version_label,valid_from,valid_until,ingestion_status,provenance,created_at").or(`firm_id.eq.${scope.firmId},source_scope.eq.public`).order("created_at",{ascending:false}).limit(80);
  let auth=supabase.from("legal_authorities").select("id,jurisdiction,authority_type,title,citation,issuing_body,decision_or_issue_date,source_url,official_source,language,verification_status,valid_from,valid_until,version_label,provision_path,canonical_uri,metadata").eq("firm_id",scope.firmId).order("decision_or_issue_date",{ascending:false}).limit(80);
  let cases=supabase.from("jurisprudence_entries").select("id,title,forum,jurisdiction,decision_date,legal_topics,holding_summary,citation,source_type,source_url,relevance_label,matter_id").eq("firm_id",scope.firmId).order("decision_date",{ascending:false}).limit(80);
  if(jurisdiction){docs=docs.ilike("jurisdiction",`%${jurisdiction}%`);auth=auth.ilike("jurisdiction",`%${jurisdiction}%`);cases=cases.ilike("jurisdiction",`%${jurisdiction}%`);}if(type){docs=docs.ilike("document_type",`%${type}%`);auth=auth.ilike("authority_type",`%${type}%`);}if(q){docs=docs.or(`title.ilike.%${q}%,publisher.ilike.%${q}%,jurisdiction.ilike.%${q}%`);auth=auth.or(`title.ilike.%${q}%,citation.ilike.%${q}%,issuing_body.ilike.%${q}%`);cases=cases.or(`title.ilike.%${q}%,holding_summary.ilike.%${q}%,citation.ilike.%${q}%`);}
  const [d,a,c,parameters]=await Promise.all([docs,auth,cases,supabase.from("firm_legal_parameters").select("parameter_type,parameter_key,label_en,label_fr,configuration").eq("firm_id",scope.firmId).eq("active",true).in("parameter_type",["jurisdiction","matter_type","procedure_track","court_authority"]).order("sort_order")]);for(const r of[d,a,c,parameters])if(r.error)throw new Error(r.error.message);
  return NextResponse.json({success:true,documents:d.data??[],authorities:a.data??[],jurisprudence:c.data??[],parameters:parameters.data??[]});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load Law Bank."},{status:403});}
}
