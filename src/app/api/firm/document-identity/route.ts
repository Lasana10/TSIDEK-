import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const allowedKinds=new Set(["formal_correspondence","court_document","client_report","invoice","receipt","internal_memo","external_review","case_label"]);
const allowedHeaders=new Set(["full","compact","none"]);
const allowedFooters=new Set(["legal","compact","none"]);
const allowedSignatures=new Set(["lawyer","firm","none"]);

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient();
    if(!supabase) throw new Error("Supabase server configuration is required.");
    const [brandResult,stylesResult]=await Promise.all([
      supabase.from("firm_brand_profiles").select("display_name,legal_name,short_name,motto,logo_asset_path,logo_url,primary_color,secondary_color,accent_color,document_header_html,document_footer_html,email_signature_html,document_identity,ui_theme,updated_at").eq("firm_id",scope.firmId).maybeSingle(),
      supabase.from("firm_document_styles").select("id,document_kind,label,header_mode,footer_mode,show_logo,show_matter_reference,show_confidentiality,signature_mode,configuration,updated_at").eq("firm_id",scope.firmId).order("label")
    ]);
    if(brandResult.error) throw new Error(brandResult.error.message);if(stylesResult.error) throw new Error(stylesResult.error.message);
    const brand=brandResult.data?{...brandResult.data,logo_display_url:brandResult.data.logo_asset_path?`/api/firm/studio/logo?v=${encodeURIComponent(brandResult.data.updated_at||"1")}`:brandResult.data.logo_url}:null;
    return NextResponse.json({success:true,brand,styles:stylesResult.data??[]});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load document identity."},{status:403});}
}

export async function PATCH(request:Request){
  try{
    const scope=await resolveRequestScope(request);await assertFirmPermission({scope,permission:"manageFirm"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body=await request.json();const supabase=createServerSupabaseClient();if(!supabase) throw new Error("Supabase server configuration is required.");

    if(body.kind==="brand"){
      const patch={
        document_header_html:typeof body.documentHeaderHtml==="string"?body.documentHeaderHtml:null,
        document_footer_html:typeof body.documentFooterHtml==="string"?body.documentFooterHtml:null,
        email_signature_html:typeof body.emailSignatureHtml==="string"?body.emailSignatureHtml:null,
        document_identity:body.documentIdentity&&typeof body.documentIdentity==="object"?body.documentIdentity:{},
        updated_by:scope.actorLawyerId,updated_at:new Date().toISOString(),
      };
      const result=await supabase.from("firm_brand_profiles").update(patch).eq("firm_id",scope.firmId).select("firm_id,document_header_html,document_footer_html,email_signature_html,document_identity").single();
      if(result.error) throw new Error(result.error.message);return NextResponse.json({success:true,brand:result.data});
    }

    const documentKind=String(body.documentKind??"");if(!allowedKinds.has(documentKind)) return NextResponse.json({success:false,error:"Unsupported document identity type."},{status:400});
    const headerMode=String(body.headerMode??"full"),footerMode=String(body.footerMode??"legal"),signatureMode=String(body.signatureMode??"lawyer");
    if(!allowedHeaders.has(headerMode)||!allowedFooters.has(footerMode)||!allowedSignatures.has(signatureMode)) return NextResponse.json({success:false,error:"Invalid document identity configuration."},{status:400});
    const result=await supabase.from("firm_document_styles").update({header_mode:headerMode,footer_mode:footerMode,show_logo:Boolean(body.showLogo),show_matter_reference:Boolean(body.showMatterReference),show_confidentiality:Boolean(body.showConfidentiality),signature_mode:signatureMode,configuration:body.configuration&&typeof body.configuration==="object"?body.configuration:{},updated_by:scope.actorLawyerId,updated_at:new Date().toISOString()}).eq("firm_id",scope.firmId).eq("document_kind",documentKind).select("*").single();
    if(result.error) throw new Error(result.error.message);return NextResponse.json({success:true,style:result.data});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update document identity."},{status:403});}
}
