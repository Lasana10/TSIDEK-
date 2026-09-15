import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const providers = new Set(["nextcloud","onedrive","meta_whatsapp","firebase","resend","openrouter","pawapay","local_ai","transcription"]);
const statuses = new Set(["configured","verified","degraded","disabled","blocked"]);
const modes = new Set(["platform_env","firm_secret_ref","oauth","local_private"]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission:"manageFirm" });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_integration_connections")
      .select("id,provider,display_name,status,credential_mode,configuration,last_verified_at,last_error,created_at,updated_at")
      .eq("firm_id",scope.firmId).order("provider");
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success:true, integrations:result.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success:false,error:error instanceof Error?error.message:"Unable to load firm integrations." },{status:403});
  }
}

export async function PUT(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission:"manageFirm" });
    const body = await request.json();
    const provider = String(body.provider||"").toLowerCase();
    if (!providers.has(provider)) return NextResponse.json({success:false,error:"Unsupported provider."},{status:400});
    const status = body.status===undefined?"configured":String(body.status);
    if (!statuses.has(status)) return NextResponse.json({success:false,error:"Invalid integration status."},{status:400});
    const credentialMode = body.credentialMode===undefined?"platform_env":String(body.credentialMode);
    if (!modes.has(credentialMode)) return NextResponse.json({success:false,error:"Invalid credential mode."},{status:400});
    if (body.configuration!==undefined && (!body.configuration || typeof body.configuration!=="object" || Array.isArray(body.configuration))) {
      return NextResponse.json({success:false,error:"Integration configuration must be an object."},{status:400});
    }
    if (body.credentialRef && credentialMode==="platform_env") return NextResponse.json({success:false,error:"Platform environment integrations do not accept tenant credential references."},{status:400});

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_integration_connections").upsert({
      firm_id:scope.firmId,provider,display_name:body.displayName?String(body.displayName):null,status,
      credential_mode:credentialMode,credential_ref:body.credentialRef?String(body.credentialRef):null,
      configuration:body.configuration ?? {},updated_by:scope.actorLawyerId,created_by:scope.actorLawyerId,updated_at:new Date().toISOString(),
    },{onConflict:"firm_id,provider"}).select("id,provider,display_name,status,credential_mode,configuration,last_verified_at,last_error,updated_at").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success:true,integration:result.data });
  } catch (error) {
    return NextResponse.json({ success:false,error:error instanceof Error?error.message:"Unable to save firm integration." },{status:403});
  }
}
