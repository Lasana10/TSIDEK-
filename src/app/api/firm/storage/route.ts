import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getFirmStorageProfile, type FirmStorageProvider } from "@/lib/firm-storage.server";

const providers = new Set<FirmStorageProvider>(["secure_vault", "nextcloud", "onedrive", "local_private"]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const [profile, connections, health] = await Promise.all([
      getFirmStorageProfile(scope.firmId),
      supabase.from("firm_integration_connections").select("provider,display_name,status,last_verified_at,last_error,configuration").eq("firm_id", scope.firmId).in("provider", ["nextcloud", "onedrive"]),
      supabase.from("firm_integration_health_latest").select("provider,status,checked_at,error_message,details").eq("firm_id", scope.firmId).in("provider", ["nextcloud", "onedrive"]),
    ]);
    if (connections.error) throw new Error(connections.error.message);
    if (health.error) throw new Error(health.error.message);
    return NextResponse.json({ success: true, storage: profile, connections: connections.data ?? [], health: health.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load firm storage." }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const provider = String(body.provider || "").toLowerCase() as FirmStorageProvider;
    if (!providers.has(provider)) throw new Error("Unsupported storage provider.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    if (provider === "onedrive" || provider === "nextcloud") {
      const connection = await supabase.from("firm_integration_connections").select("status").eq("firm_id", scope.firmId).eq("provider", provider).maybeSingle();
      if (connection.error) throw new Error(connection.error.message);
      if (!connection.data || !["configured", "verified"].includes(String(connection.data.status))) throw new Error(`${provider === "onedrive" ? "OneDrive" : "Nextcloud"} must be configured for this firm before it can become the active storage profile.`);
    }
    if (provider === "local_private" && !body.configuration?.agentId && !body.configuration?.mountName) throw new Error("Local-private storage requires a registered local agent or mount name.");
    const result = await supabase.from("firm_storage_profiles").upsert({
      firm_id: scope.firmId,
      provider,
      configuration: body.configuration && typeof body.configuration === "object" && !Array.isArray(body.configuration) ? body.configuration : {},
      status: provider === "secure_vault" ? "verified" : "configured",
      last_verified_at: provider === "secure_vault" ? new Date().toISOString() : null,
      last_error: null,
      created_by: scope.actorLawyerId,
      updated_by: scope.actorLawyerId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "firm_id" }).select("firm_id,provider,configuration,status,last_verified_at,last_error,updated_at").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, storage: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save firm storage." }, { status: 400 });
  }
}
