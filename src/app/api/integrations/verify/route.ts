import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyFirebaseCredentials } from "@/lib/integrations/firebase.server";
import { verifyWhatsAppCredentials } from "@/lib/integrations/meta-whatsapp.server";
import { nextcloudList } from "@/lib/integrations/nextcloud.server";
import { verifyOpenRouter } from "@/lib/integrations/openrouter.server";
import { verifyPawaPay } from "@/lib/integrations/pawapay.server";

const supported = new Set(["nextcloud", "firebase", "meta_whatsapp", "openrouter", "pawapay"]);

export async function POST(request: Request) {
  const scope = await resolveRequestScope(request);
  let provider = "";
  try {
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json().catch(() => ({}));
    provider = String(body.provider || "").toLowerCase();
    if (!supported.has(provider)) {
      return NextResponse.json({ success: false, error: "Unsupported verification provider." }, { status: 400 });
    }

    let detail: unknown;
    if (provider === "nextcloud") {
      const xml = await nextcloudList("/");
      detail = { ok: true, rootAccessible: xml.includes("multistatus") || xml.includes("response") };
    } else if (provider === "firebase") {
      detail = await verifyFirebaseCredentials();
    } else if (provider === "meta_whatsapp") {
      detail = await verifyWhatsAppCredentials();
    } else if (provider === "openrouter") {
      detail = await verifyOpenRouter();
    } else {
      detail = await verifyPawaPay();
    }

    const verifiedAt = new Date().toISOString();
    const supabase = createServerSupabaseClient();
    if (supabase) {
      await supabase.from("firm_integration_connections").upsert({
        firm_id:scope.firmId,provider,status:"verified",credential_mode:"platform_env",configuration:{},
        last_verified_at:verifiedAt,last_error:null,updated_by:scope.actorLawyerId,created_by:scope.actorLawyerId,updated_at:verifiedAt,
      },{onConflict:"firm_id,provider"});
    }
    return NextResponse.json({ success: true, provider, verifiedAt, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration verification failed.";
    if (scope.firmId && scope.actorLawyerId && provider && supported.has(provider)) {
      const supabase = createServerSupabaseClient();
      if (supabase) await supabase.from("firm_integration_connections").upsert({
        firm_id:scope.firmId,provider,status:"degraded",credential_mode:"platform_env",configuration:{},
        last_error:message.slice(0,500),updated_by:scope.actorLawyerId,created_by:scope.actorLawyerId,updated_at:new Date().toISOString(),
      },{onConflict:"firm_id,provider"});
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
