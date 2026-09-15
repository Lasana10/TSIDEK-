import { envHealth } from "./types";

export const metaWhatsAppHealth = () =>
  envHealth(
    "meta_whatsapp",
    "messaging",
    ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
    "cloud",
  );

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
}

export async function verifyWhatsAppCredentials() {
  const health = metaWhatsAppHealth();
  if (!health.configured) throw new Error(`WhatsApp not configured: ${health.missing.join(", ")}`);
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      cache: "no-store",
    },
  );
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`WhatsApp verification failed (${response.status}).`);
  return {
    ok: true,
    id: typeof data.id === "string" ? data.id : phoneNumberId,
    displayPhoneNumber: typeof data.display_phone_number === "string" ? data.display_phone_number : null,
    verifiedName: typeof data.verified_name === "string" ? data.verified_name : null,
  };
}

export async function sendWhatsAppText(input: { to: string; body: string; previewUrl?: boolean }) {
  const health = metaWhatsAppHealth();
  if (!health.configured) throw new Error(`WhatsApp not configured: ${health.missing.join(", ")}`);
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
      type: "text",
      text: { body: input.body, preview_url: input.previewUrl ?? false },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
