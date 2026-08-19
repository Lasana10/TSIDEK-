import { NextResponse } from "next/server";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revokeClientGrant, setClientGrant } from "@/lib/client-portal.server";

export async function GET(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, permission: "inviteCollaborators" });
    const s = createServerSupabaseClient();
    if (!s) throw new Error("Supabase configuration is required.");
    const r = await s.from("client_portal_grants").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return NextResponse.json({ success: true, grants: r.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load client access." }, { status: statusForApiError(error) });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, permission: "inviteCollaborators" });
    const b = await request.json();

    if (b.action === "grant") {
      const email = String(b.clientEmail ?? "").trim();
      if (!email.includes("@")) return NextResponse.json({ success: false, error: "Valid client email required." }, { status: 400 });
      return NextResponse.json({ success: true, grant: await setClientGrant({
        matterId, scope, clientEmail: email,
        canViewDocuments: b.canViewDocuments, canViewFinance: b.canViewFinance,
        canViewUpdates: b.canViewUpdates, canUploadDocuments: b.canUploadDocuments,
      })});
    }
    if (b.action === "revoke") {
      return NextResponse.json({ success: true, grant: await revokeClientGrant({
        matterId, scope, grantId: String(b.grantId),
      })});
    }
    return NextResponse.json({ success: false, error: "Unsupported client portal action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update client access." }, { status: statusForApiError(error) });
  }
}
