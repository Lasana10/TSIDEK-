import { envHealth } from "./types";

function token() {
  return process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_API_KEY || "";
}

function baseUrl() {
  const environment = (process.env.PAWAPAY_ENV || "sandbox").toLowerCase();
  return (process.env.PAWAPAY_API_URL ||
    (environment === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io"))
    .replace(/\/$/, "");
}

export function pawaPayHealth() {
  const required = process.env.PAWAPAY_API_TOKEN?.trim() ? ["PAWAPAY_API_TOKEN"] : ["PAWAPAY_API_KEY"];
  return envHealth("pawapay", "payments", required, "cloud");
}

export async function verifyPawaPay() {
  const health = pawaPayHealth();
  if (!health.configured) throw new Error(`pawaPay not configured: ${health.missing.join(", ")}`);
  const response = await fetch(`${baseUrl()}/v2/availability`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`pawaPay availability verification failed (${response.status}).`);
  const cameroon = Array.isArray(data)
    ? data.find((entry) => entry && typeof entry === "object" && "country" in entry && entry.country === "CMR")
    : null;
  return { ok: true, status: response.status, cameroon: cameroon ?? null };
}
