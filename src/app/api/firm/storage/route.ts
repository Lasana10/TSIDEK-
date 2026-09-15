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
    return NextResponse.json({ success: true, storage: await getFirmStorageProfile(scope.firmId) });
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
    if (provider === "onedrive") throw new Error("OneDrive selection is available after the firm completes Microsoft authorization.");
    if (provider === "local_private" && !body.configuration?.agentId && !body.configuration?.mountName) {
      throw new Error("Local-private storage requires a registered local agent or mount name.");
    }
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
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
