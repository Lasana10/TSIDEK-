import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/integrations/meta-whatsapp.server";
import { normalizeE164Phone } from "@/lib/phone";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveFirmProviderCredentials } from "@/lib/tenant-integrations.server";

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function resolveFirmByPhoneNumberId(phoneNumberId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const candidates = await supabase.from("firm_integration_connections").select("firm_id").eq("provider", "meta_whatsapp").in("status", ["verified", "configured"]);
  if (candidates.error) throw new Error(candidates.error.message);
  for (const candidate of candidates.data ?? []) {
    const creds = await resolveFirmProviderCredentials(candidate.firm_id, "meta_whatsapp").catch(() => null);
    if (creds?.phoneNumberId && String(creds.phoneNumberId) === phoneNumberId) return { firmId: candidate.firm_id, creds };
  }
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (envPhone && envPhone === phoneNumberId && (candidates.data?.length ?? 0) === 1) {
    const firmId = candidates.data![0].firm_id;
    const creds = await resolveFirmProviderCredentials(firmId, "meta_whatsapp").catch(() => null);
    return { firmId, creds };
  }
  return null;
}

function triggerMatches(kind: string, expected: string, message: string) {
  const left = message.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  if (!right) return false;
  if (kind === "exact") return left === right;
  if (kind === "starts_with") return left.startsWith(right);
  return left.includes(right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ success: false, error: "Invalid webhook signature." }, { status: 401 });
    const payload = JSON.parse(raw) as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string; display_phone_number?: string }; messages?: Array<{ id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }> } }> }> };
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    let created = 0;
    let triggered = 0;

    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? "").trim();
      if (!phoneNumberId) continue;
      const firm = await resolveFirmByPhoneNumberId(phoneNumberId);
      if (!firm) continue;
      const policy = await supabase.from("firm_interaction_policies").select("whatsapp_enabled,ai_extraction_enabled,automatic_matter_matching").eq("firm_id", firm.firmId).maybeSingle();
      if (policy.error) throw new Error(policy.error.message);
      if (!policy.data?.whatsapp_enabled) continue;

      for (const message of value.messages ?? []) {
        const rawPhone = String(message.from ?? "").trim();
        if (!rawPhone) continue;
        let phone: string;
        try { phone = normalizeE164Phone(rawPhone); } catch { continue; }
        let party = await supabase.from("parties").select("id,firm_id,display_name").eq("firm_id", firm.firmId).in("phone", [phone, phone.replace(/^\+/, ""), rawPhone]).limit(1).maybeSingle();
        if (party.error) throw new Error(party.error.message);
        if (!party.data) {
          const createdParty = await supabase.from("parties").insert({ firm_id: firm.firmId, party_type: "individual", display_name: `WhatsApp ${phone}`, phone, client_status: "contact", preferred_language: "en" }).select("id,firm_id,display_name").single();
          if (createdParty.error) throw new Error(createdParty.error.message);
          party = { data: createdParty.data, error: null } as typeof party;
        }

        const messageBody = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? `WhatsApp ${message.type || "message"} received`;
        const existingMatter = await supabase.from("matter_parties").select("matter_id").eq("firm_id", firm.firmId).eq("party_id", party.data!.id).eq("is_primary", true).limit(2);
        if (existingMatter.error) throw new Error(existingMatter.error.message);
        const matches = existingMatter.data ?? [];
        const matterId = policy.data.automatic_matter_matching && matches.length === 1 ? matches[0].matter_id : null;
        const insert = await supabase.from("legal_interactions").insert({ firm_id: firm.firmId, matter_id: matterId, primary_party_id: party.data!.id, interaction_type: "whatsapp", direction: "inbound", occurred_at: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(), subject: "WhatsApp message", raw_note: String(messageBody), source_reference: String(message.id || ""), confidentiality_level: "firm", transcript_status: "not_requested", ai_analysis_status: policy.data.ai_extraction_enabled ? "queued" : "not_requested", verification_status: "unreviewed", client_cycle_stage: matterId ? "matter" : "enquiry", metadata: { whatsapp_message_type: message.type, phone_number_id: phoneNumberId, display_phone_number: value.metadata?.display_phone_number, normalized_sender: phone } });
        if (insert.error) throw new Error(insert.error.message);
        created += 1;

        const triggerResult = await supabase.from("firm_whatsapp_triggers").select("id,trigger_kind,trigger_value,action_type,action_config").eq("firm_id", firm.firmId).eq("enabled", true).order("priority").limit(50);
        if (triggerResult.error) throw new Error(triggerResult.error.message);
        const trigger = (triggerResult.data ?? []).find(t => triggerMatches(t.trigger_kind, t.trigger_value, String(messageBody)));
        if (!trigger) continue;
        const config = trigger.action_config && typeof trigger.action_config === "object" ? trigger.action_config as Record<string, unknown> : {};
        if (trigger.action_type === "reply_text") {
          const reply = String(config.message ?? "Thank you. Your message has been received.").trim();
          if (reply) await sendWhatsAppText({ to: phone, body: reply }, firm.creds ?? undefined);
          triggered += 1;
        } else if (trigger.action_type === "share_form") {
          const formKey = String(config.form_key ?? "new_client_enquiry");
          const form = await supabase.from("firm_form_definitions").select("id,name").eq("firm_id", firm.firmId).eq("form_key", formKey).eq("status", "published").maybeSingle();
          if (form.data) {
            const token = randomBytes(24).toString("base64url");
            await supabase.from("form_share_links").insert({ firm_id: firm.firmId, form_definition_id: form.data.id, token, recipient_phone: phone, recipient_name: party.data!.display_name, status: "active", expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
            const origin = new URL(request.url).origin;
            const intro = String(config.message ?? `Please complete our secure ${form.data.name} form.`);
            await sendWhatsAppText({ to: phone, body: `${intro}\n\n${origin}/public/forms/${token}` }, firm.creds ?? undefined);
            triggered += 1;
          }
        } else if (trigger.action_type === "route_intake") {
          const reply = String(config.reply ?? "Thank you. Your message has been placed in the legal intake queue for staff review.");
          await sendWhatsAppText({ to: phone, body: reply }, firm.creds ?? undefined);
          triggered += 1;
        }
      }
    }
    return NextResponse.json({ success: true, created, triggered });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to process WhatsApp webhook." }, { status: 400 });
  }
}
