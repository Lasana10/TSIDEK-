import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { deleteTenantCredentials, saveTenantCredentials } from "@/lib/tenant-credentials.server";

const allowedFields: Record<string, string[]> = {
  nextcloud: ["baseUrl", "username", "appPassword"],
  firebase: ["projectId", "clientEmail", "privateKey"],
  meta_whatsapp: ["accessToken", "phoneNumberId", "verifyToken", "appSecret", "graphVersion"],
  openrouter: ["apiKey"],
  pawapay: ["apiToken", "apiKey", "environment", "apiUrl"],
  resend: ["apiKey", "fromEmail"],
  transcription: ["apiUrl", "apiKey", "model"],
};

function cleanCredentials(provider: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Credentials must be an object.");
  const allowed = allowedFields[provider];
  if (!allowed) throw new Error("Unsupported credential provider.");
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => allowed.includes(key) && typeof item === "string" && item.trim())
    .map(([key, item]) => [key, String(item).trim()]);
  const credentials = Object.fromEntries(entries);
  if (!Object.keys(credentials).length) throw new Error("No supported credential fields were supplied.");
  return credentials;
}

export async function PUT(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const provider = String(body.provider || "").toLowerCase();
    const credentials = cleanCredentials(provider, body.credentials);
    await saveTenantCredentials({ firmId: scope.firmId, provider, credentials, actorLawyerId: scope.actorLawyerId });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const now = new Date().toISOString();
    const result = await supabase.from("firm_integration_connections").upsert({
      firm_id: scope.firmId,
      provider,
      display_name: body.displayName ? String(body.displayName).slice(0, 120) : null,
      status: "configured",
      credential_mode: "firm_secret_ref",
      credential_ref: `tenant-vault:${provider}`,
      configuration: body.configuration && typeof body.configuration === "object" && !Array.isArray(body.configuration) ? body.configuration : {},
      last_verified_at: null,
      last_error: null,
      created_by: scope.actorLawyerId,
      updated_by: scope.actorLawyerId,
      updated_at: now,
    }, { onConflict: "firm_id,provider" }).select("id,provider,display_name,status,credential_mode,configuration,last_verified_at,last_error,updated_at").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, integration: result.data, secretStored: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to store integration credentials." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const provider = String(new URL(request.url).searchParams.get("provider") || "").toLowerCase();
    if (!allowedFields[provider]) throw new Error("Unsupported credential provider.");
    await deleteTenantCredentials(scope.firmId, provider);
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_integration_connections").update({
      status: "disabled", credential_mode: "platform_env", credential_ref: null, last_verified_at: null,
      last_error: null, updated_by: scope.actorLawyerId, updated_at: new Date().toISOString(),
    }).eq("firm_id", scope.firmId).eq("provider", provider);
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, provider, secretDeleted: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to remove integration credentials." }, { status: 400 });
  }
}
