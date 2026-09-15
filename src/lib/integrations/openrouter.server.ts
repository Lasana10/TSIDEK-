import { envHealth } from "./types";

export const openRouterHealth = () =>
  envHealth(
    "openrouter",
    "ai",
    ["OPENROUTER_API_KEY"],
    "cloud",
  );

export async function verifyOpenRouter() {
  const health = openRouterHealth();
  if (!health.configured) throw new Error(`OpenRouter not configured: ${health.missing.join(", ")}`);
  const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`OpenRouter verification failed (${response.status}).`);
  return {
    ok: true,
    status: response.status,
    label: typeof data.label === "string" ? data.label : null,
  };
}
