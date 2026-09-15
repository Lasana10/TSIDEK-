import { envHealth } from "./types";

export type PawaPayCredentials = { apiToken?: string; apiKey?: string; environment?: string; apiUrl?: string };

function token(credentials?: PawaPayCredentials) {
  return credentials?.apiToken || credentials?.apiKey || process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_API_KEY || "";
}

function baseUrl(credentials?: PawaPayCredentials) {
  const environment = (credentials?.environment || process.env.PAWAPAY_ENV || "sandbox").toLowerCase();
  return (credentials?.apiUrl || process.env.PAWAPAY_API_URL || (environment === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io")).replace(/\/$/, "");
}

export function pawaPayHealth() {
  const required = process.env.PAWAPAY_API_TOKEN?.trim() ? ["PAWAPAY_API_TOKEN"] : ["PAWAPAY_API_KEY"];
  return envHealth("pawapay", "payments", required, "cloud");
}

export async function verifyPawaPay(credentials?: PawaPayCredentials) {
  const auth = token(credentials);
  if (!auth) throw new Error("pawaPay not configured: apiToken");
  const response = await fetch(`${baseUrl(credentials)}/v2/availability`, { headers: { Authorization: `Bearer ${auth}` }, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`pawaPay availability verification failed (${response.status}).`);
  const cameroon = Array.isArray(data) ? data.find((entry) => entry && typeof entry === "object" && "country" in entry && entry.country === "CMR") : null;
  return { ok: true, status: response.status, environment: (credentials?.environment || process.env.PAWAPAY_ENV || "sandbox").toLowerCase(), cameroon: cameroon ?? null };
}
