import { envHealth } from "./types";

export type WhatsAppCredentials = {
  accessToken?: string;
  phoneNumberId?: string;
  verifyToken?: string;
  appSecret?: string;
  graphVersion?: string;
};

export const metaWhatsAppHealth = () =>
  envHealth("meta_whatsapp", "messaging", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"], "cloud");

function resolved(credentials?: WhatsAppCredentials) {
  return {
    accessToken: credentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: credentials?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: credentials?.appSecret || process.env.WHATSAPP_APP_SECRET || "",
    graphVersion: credentials?.graphVersion || process.env.WHATSAPP_GRAPH_VERSION || "v23.0",
  };
}

function assertConfigured(credentials?: WhatsAppCredentials) {
  const value = resolved(credentials);
  const missing = [!value.accessToken && "accessToken", !value.phoneNumberId && "phoneNumberId", !value.verifyToken && "verifyToken", !value.appSecret && "appSecret"].filter(Boolean);
  if (missing.length) throw new Error(`WhatsApp not configured: ${missing.join(", ")}`);
  return value;
}

export async function verifyWhatsAppCredentials(credentials?: WhatsAppCredentials) {
  const value = assertConfigured(credentials);
  const response = await fetch(`https://graph.facebook.com/${value.graphVersion}/${value.phoneNumberId}?fields=id,display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${value.accessToken}` }, cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`WhatsApp verification failed (${response.status}).`);
  return { ok: true, id: typeof data.id === "string" ? data.id : value.phoneNumberId, displayPhoneNumber: typeof data.display_phone_number === "string" ? data.display_phone_number : null, verifiedName: typeof data.verified_name === "string" ? data.verified_name : null };
}

export async function sendWhatsAppText(input: { to: string; body: string; previewUrl?: boolean }, credentials?: WhatsAppCredentials) {
  const value = assertConfigured(credentials);
  const response = await fetch(`https://graph.facebook.com/${value.graphVersion}/${value.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${value.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: input.to.replace(/\D/g, ""), type: "text", text: { body: input.body, preview_url: input.previewUrl ?? false } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
