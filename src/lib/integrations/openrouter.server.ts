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

function messageText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

async function smokeCompletion(key: string, model: string) {
  const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:"POST",
    headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json", "HTTP-Referer":process.env.NEXT_PUBLIC_APP_URL || "https://tsidek-os.onrender.com", "X-Title":"TSIDKENU verification" },
    body:JSON.stringify({ model, messages:[{role:"user",content:"Reply only with OK."}], max_tokens:64, temperature:0 }),
    cache:"no-store",
  });
  const completionPayload = await completion.json().catch(()=>({})) as { choices?: Array<{message?:{content?:unknown}}> };
  const content = messageText(completionPayload.choices?.[0]?.message?.content);
  return { ok: completion.ok, status: completion.status, content };
}

export async function verifyOpenRouter(credentials?: OpenRouterCredentials) {
  const key = apiKey(credentials);
  if (!key) throw new Error("OpenRouter not configured: OPENROUTER_API_KEY");
  const keyResponse = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const keyPayload = await keyResponse.json().catch(() => ({})) as { data?: Record<string, unknown> };
  if (!keyResponse.ok) throw new Error(`OpenRouter key verification failed (${keyResponse.status}).`);

  const requestedModel = process.env.OPENROUTER_SMOKE_MODEL || process.env.TSIDEK_OPENROUTER_MODEL || "openrouter/auto";
  let usedModel = requestedModel;
  let result = await smokeCompletion(key, requestedModel);

  if ((!result.ok || !result.content) && requestedModel !== "openrouter/auto") {
    usedModel = "openrouter/auto";
    result = await smokeCompletion(key, usedModel);
  }

  if (!result.ok) throw new Error(`OpenRouter completion verification failed (${result.status}).`);
  if (!result.content) throw new Error("OpenRouter returned no usable completion, including provider-auto fallback.");

  const data = keyPayload.data ?? {};
  return {
    ok:true,
    status:result.status,
    completionResolved:true,
    model:usedModel,
    requestedModel,
    fallbackUsed:usedModel !== requestedModel,
    label:typeof data.label==="string"?data.label:null,
    isFreeTier:typeof data.is_free_tier==="boolean"?data.is_free_tier:null,
    limitRemaining:typeof data.limit_remaining==="number"?data.limit_remaining:null,
  };
}
