import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getFirmIntegrationConnection, verifyFirmProvider, type TenantProvider } from "@/lib/tenant-integrations.server";

const supported = new Set<TenantProvider>(["nextcloud", "firebase", "meta_whatsapp", "openrouter", "pawapay"]);

export async function POST(request: Request) {
  const scope = await resolveRequestScope(request);
  let provider = "";
  try {
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json().catch(() => ({}));
    provider = String(body.provider || "").toLowerCase();
    if (!supported.has(provider as TenantProvider)) {
      return NextResponse.json({ success: false, error: "Unsupported verification provider." }, { status: 400 });
    }

    const current = await getFirmIntegrationConnection(scope.firmId, provider);
    const credentialMode = current?.credential_mode || "platform_env";
    const detail = await verifyFirmProvider(scope.firmId, provider as TenantProvider);
    const verifiedAt = new Date().toISOString();
    const supabase = createServerSupabaseClient();
    if (supabase) {
      const result = await supabase.from("firm_integration_connections").upsert({
        firm_id: scope.firmId,
        provider,
        status: "verified",
        credential_mode: credentialMode,
        credential_ref: current?.credential_ref ?? null,
        configuration: current?.configuration ?? {},
        last_verified_at: verifiedAt,
        last_error: null,
        updated_by: scope.actorLawyerId,
        created_by: scope.actorLawyerId,
        updated_at: verifiedAt,
      }, { onConflict: "firm_id,provider" });
      if (result.error) throw new Error(result.error.message);
    }
    return NextResponse.json({ success: true, provider, credentialMode, verifiedAt, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration verification failed.";
    if (scope.firmId && scope.actorLawyerId && provider && supported.has(provider as TenantProvider)) {
      const supabase = createServerSupabaseClient();
      if (supabase) {
        const current = await getFirmIntegrationConnection(scope.firmId, provider).catch(() => null);
        await supabase.from("firm_integration_connections").upsert({
          firm_id: scope.firmId,
          provider,
          status: "degraded",
          credential_mode: current?.credential_mode || "platform_env",
          credential_ref: current?.credential_ref ?? null,
          configuration: current?.configuration ?? {},
          last_error: message.slice(0, 500),
          updated_by: scope.actorLawyerId,
          created_by: scope.actorLawyerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "firm_id,provider" });
      }
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
