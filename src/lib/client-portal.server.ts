import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { recordMatterEvent } from "@/lib/matter-events.server";

export async function setClientGrant(input: {
  matterId: string; scope: RequestScope; clientEmail: string;
  canViewDocuments?: boolean; canViewFinance?: boolean; canViewUpdates?: boolean; canUploadDocuments?: boolean;
}) {
  const s = createServerSupabaseClient();
  if (!s) throw new Error("Supabase configuration is required.");
  const m = await s.from("matters").select("firm_id").eq("id", input.matterId).maybeSingle();
  if (m.error) throw new Error(m.error.message);
  if (!m.data) throw new Error("Matter not found.");
  if (input.scope.firmId && input.scope.firmId !== m.data.firm_id) throw new Error("Cross-firm access denied.");

  const r = await s.from("client_portal_grants").upsert({
    firm_id: m.data.firm_id,
    matter_id: input.matterId,
    client_email: input.clientEmail.trim().toLowerCase(),
    grant_status: "ACTIVE",
    can_view_documents: input.canViewDocuments !== false,
    can_view_finance: input.canViewFinance !== false,
    can_view_updates: input.canViewUpdates !== false,
    can_upload_documents: Boolean(input.canUploadDocuments),
    granted_by: input.scope.actorLawyerId,
    granted_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "matter_id,client_email" }).select("*").single();
  if (r.error) throw new Error(r.error.message);
  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: "CLIENT_PORTAL_ACCESS_GRANTED",
    metadata: { grantId: r.data.id },
  });
  return r.data;
}

export async function revokeClientGrant(input: { matterId: string; scope: RequestScope; grantId: string }) {
  const s = createServerSupabaseClient();
  if (!s) throw new Error("Supabase configuration is required.");
  const r = await s.from("client_portal_grants").update({
    grant_status: "REVOKED", revoked_at: new Date().toISOString(),
  }).eq("id", input.grantId).eq("matter_id", input.matterId).select("*").single();
  if (r.error) throw new Error(r.error.message);
  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: "CLIENT_PORTAL_ACCESS_REVOKED",
    metadata: { grantId: input.grantId },
  });
  return r.data;
}
