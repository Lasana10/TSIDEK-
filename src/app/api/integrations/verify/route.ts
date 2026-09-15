import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { verifyFirebaseCredentials } from "@/lib/integrations/firebase.server";
import { verifyWhatsAppCredentials } from "@/lib/integrations/meta-whatsapp.server";
import { nextcloudList } from "@/lib/integrations/nextcloud.server";
import { verifyOpenRouter } from "@/lib/integrations/openrouter.server";
import { verifyPawaPay } from "@/lib/integrations/pawapay.server";

const supported = new Set(["nextcloud", "firebase", "meta_whatsapp", "openrouter", "pawapay"]);

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    const body = await request.json().catch(() => ({}));
    const provider = String(body.provider || "").toLowerCase();
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

    return NextResponse.json({ success: true, provider, verifiedAt: new Date().toISOString(), detail });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Integration verification failed." },
      { status: 400 },
    );
  }
}
