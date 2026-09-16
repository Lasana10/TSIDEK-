import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { sendWhatsAppText } from "@/lib/integrations/meta-whatsapp.server";
import { normalizeE164Phone } from "@/lib/phone";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveFirmProviderCredentials } from "@/lib/tenant-integrations.server";

async function credentials(firmId: string) {
  const tenant = await resolveFirmProviderCredentials(firmId, "meta_whatsapp");
  return tenant ? { accessToken: tenant.accessToken, phoneNumberId: tenant.phoneNumberId, verifyToken: tenant.verifyToken, appSecret: tenant.appSecret, graphVersion: tenant.graphVersion } : undefined;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const [interactions, parties, forms, triggers, integration] = await Promise.all([
      supabase.from("legal_interactions").select("id,primary_party_id,matter_id,direction,occurred_at,subject,raw_note,source_reference,verification_status,metadata").eq("firm_id", scope.firmId).eq("interaction_type", "whatsapp").order("occurred_at", { ascending: false }).limit(150),
      supabase.from("parties").select("id,display_name,phone,email,client_status").eq("firm_id", scope.firmId).order("display_name").limit(400),
      supabase.from("firm_form_definitions").select("id,form_key,name,module,status").eq("firm_id", scope.firmId).eq("status", "published").order("name"),
      supabase.from("firm_whatsapp_triggers").select("id,name,enabled,trigger_kind,trigger_value,action_type,action_config,priority,updated_at").eq("firm_id", scope.firmId).order("priority"),
      supabase.from("firm_integration_connections").select("provider,display_name,status,last_verified_at,last_error,configuration").eq("firm_id", scope.firmId).eq("provider", "meta_whatsapp").maybeSingle(),
    ]);
    for (const result of [interactions, parties, forms, triggers, integration]) if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, interactions: interactions.data ?? [], parties: parties.data ?? [], forms: forms.data ?? [], triggers: triggers.data ?? [], integration: integration.data ?? null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load WhatsApp desk." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const action = String(body.action ?? "send_text");

    if (action === "send_text") {
      const to = normalizeE164Phone(String(body.to ?? ""));
      const message = String(body.message ?? "").trim();
      if (!message) return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
      const sent = await sendWhatsAppText({ to, body: message }, await credentials(scope.firmId));
      const party = await supabase.from("parties").select("id").eq("firm_id", scope.firmId).in("phone", [to, to.replace(/^\+/, "")]).limit(1).maybeSingle();
      const insert = await supabase.from("legal_interactions").insert({ firm_id: scope.firmId, primary_party_id: party.data?.id ?? null, interaction_type: "whatsapp", direction: "outbound", occurred_at: new Date().toISOString(), subject: "WhatsApp message", raw_note: message, source_reference: Array.isArray((sent as any)?.messages) ? String((sent as any).messages[0]?.id ?? "") : null, confidentiality_level: "firm", transcript_status: "not_requested", ai_analysis_status: "not_requested", verification_status: "verified", assigned_to: scope.actorLawyerId, created_by: scope.actorLawyerId, client_cycle_stage: "enquiry", metadata: { normalized_recipient: to } });
      if (insert.error) throw new Error(insert.error.message);
      return NextResponse.json({ success: true, to, sent });
    }

    if (action === "share_form") {
      const to = normalizeE164Phone(String(body.to ?? ""));
      const formId = String(body.formId ?? "").trim();
      if (!formId) return NextResponse.json({ success: false, error: "Select a form to share." }, { status: 400 });
      const form = await supabase.from("firm_form_definitions").select("id,name,status").eq("id", formId).eq("firm_id", scope.firmId).single();
      if (form.error || form.data.status !== "published") throw new Error("Only a published firm form can be shared.");
      const token = randomBytes(24).toString("base64url");
      const link = await supabase.from("form_share_links").insert({ firm_id: scope.firmId, form_definition_id: formId, token, recipient_phone: to, recipient_name: body.recipientName ? String(body.recipientName) : null, status: "active", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: scope.actorLawyerId }).select("id,token").single();
      if (link.error) throw new Error(link.error.message);
      const origin = new URL(request.url).origin;
      const url = `${origin}/public/forms/${token}`;
      const intro = String(body.message ?? `Please complete the secure ${form.data.name} form requested by our firm.`).trim();
      await sendWhatsAppText({ to, body: `${intro}\n\n${url}`, previewUrl: false }, await credentials(scope.firmId));
      return NextResponse.json({ success: true, to, url, expiresInDays: 7 });
    }

    if (action === "save_trigger") {
      await assertFirmPermission({ scope, permission: "manageFirm" });
      const id = body.id ? String(body.id) : null;
      const triggerKind = ["contains", "exact", "starts_with"].includes(String(body.triggerKind)) ? String(body.triggerKind) : "contains";
      const actionType = ["reply_text", "share_form", "route_intake", "notify_staff"].includes(String(body.actionType)) ? String(body.actionType) : "reply_text";
      const row = { firm_id: scope.firmId, name: String(body.name ?? "Trigger").trim(), enabled: body.enabled !== false, trigger_kind: triggerKind, trigger_value: String(body.triggerValue ?? "").trim().toLowerCase(), action_type: actionType, action_config: body.actionConfig && typeof body.actionConfig === "object" ? body.actionConfig : {}, priority: Number(body.priority ?? 100), updated_by: scope.actorLawyerId, created_by: scope.actorLawyerId, updated_at: new Date().toISOString() };
      if (!row.trigger_value) return NextResponse.json({ success: false, error: "Trigger phrase is required." }, { status: 400 });
      const result = id ? await supabase.from("firm_whatsapp_triggers").update(row).eq("id", id).eq("firm_id", scope.firmId).select("*").single() : await supabase.from("firm_whatsapp_triggers").insert(row).select("*").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, trigger: result.data });
    }

    return NextResponse.json({ success: false, error: "Unsupported WhatsApp action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to complete WhatsApp action." }, { status: 400 });
  }
}
