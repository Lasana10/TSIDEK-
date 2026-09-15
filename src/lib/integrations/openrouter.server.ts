import { envHealth } from "./types";

export type OpenRouterCredentials = { apiKey?: string };

export const openRouterHealth = () =>
  envHealth(
    "openrouter",
    "ai",
    ["OPENROUTER_API_KEY"],
    "cloud",
  );

function apiKey(credentials?: OpenRouterCredentials) {
  return credentials?.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
}

export async function verifyOpenRouter(credentials?: OpenRouterCredentials) {
  const key = apiKey(credentials);
  if (!key) throw new Error("OpenRouter not configured: OPENROUTER_API_KEY");
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { data?: Record<string, unknown> };
  if (!response.ok) throw new Error(`OpenRouter verification failed (${response.status}).`);
  const data = payload.data ?? {};
  return {
    ok: true,
    status: response.status,
    label: typeof data.label === "string" ? data.label : null,
    isFreeTier: typeof data.is_free_tier === "boolean" ? data.is_free_tier : null,
    limitRemaining: typeof data.limit_remaining === "number" ? data.limit_remaining : null,
  };
}
