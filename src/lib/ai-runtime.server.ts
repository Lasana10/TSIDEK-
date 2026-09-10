import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";

export type AiPrivacyMode = "local_only" | "hybrid" | "cloud_allowed";
export type AiProviderName = "gemini" | "openrouter" | "local";

export type AiRuntimeRequest = {
  scope: RequestScope;
  matterId?: string | null;
  taskType: string;
  prompt: string;
  preferredProvider?: AiProviderName | null;
  sourceDocumentIds?: string[];
  model?: string | null;
};

export type AiRuntimeResult = {
  provider: AiProviderName;
  model: string;
  output: string;
  configured: true;
  runId: string | null;
  generatedAt: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadRuntimeProfile(firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("firm_runtime_profiles")
    .select("ai_privacy_mode,primary_cloud_provider,local_ai_base_url")
    .eq("firm_id", firmId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { ai_privacy_mode: AiPrivacyMode; primary_cloud_provider: "gemini" | "openrouter" | "none"; local_ai_base_url: string | null } | null;
}

function chooseProvider(profile: Awaited<ReturnType<typeof loadRuntimeProfile>>, preferred?: AiProviderName | null): AiProviderName {
  const mode = profile?.ai_privacy_mode ?? "hybrid";
  if (mode === "local_only") return "local";
  if (preferred === "local") return "local";
  if (preferred === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (preferred === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (mode === "hybrid" && profile?.local_ai_base_url) return "local";
  if (profile?.primary_cloud_provider === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (profile?.primary_cloud_provider === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (profile?.local_ai_base_url || process.env.TSIDEK_LOCAL_AI_BASE_URL) return "local";
  throw new Error("No permitted AI provider is configured for this firm. TSIDKENU will not simulate a successful legal answer.");
}

async function runGemini(prompt: string, modelOverride?: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured.");
  const model = modelOverride || process.env.TSIDEK_GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const response = await genAI.getGenerativeModel({ model }).generateContent(prompt);
  return { output: response.response.text(), model };
}

async function runOpenRouter(prompt: string, modelOverride?: string | null) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter is not configured.");
  const model = modelOverride || process.env.TSIDEK_OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed (${response.status}).`);
  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const output = json.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error("OpenRouter returned no usable content.");
  return { output, model };
}

async function runLocal(prompt: string, baseUrl: string | null, modelOverride?: string | null) {
  const endpoint = (baseUrl || process.env.TSIDEK_LOCAL_AI_BASE_URL || "").replace(/\/$/, "");
  if (!endpoint) throw new Error("Local AI is required by the firm's privacy mode but no local endpoint is configured.");
  const model = modelOverride || process.env.TSIDEK_LOCAL_AI_MODEL || "gemma3";
  const response = await fetch(`${endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!response.ok) throw new Error(`Local AI request failed (${response.status}).`);
  const json = await response.json() as { response?: string };
  const output = json.response?.trim();
  if (!output) throw new Error("Local AI returned no usable content.");
  return { output, model };
}

export async function runGovernedAi(input: AiRuntimeRequest): Promise<AiRuntimeResult> {
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authenticated firm context is required for AI work.");
  const profile = await loadRuntimeProfile(input.scope.firmId);
  const provider = chooseProvider(profile, input.preferredProvider);
  const startedAt = Date.now();
  const supabase = createServerSupabaseClient();
  let runId: string | null = null;
  let model = input.model || "pending";

  if (supabase) {
    const { data } = await supabase.from("ai_provider_runs").insert({
      firm_id: input.scope.firmId,
      matter_id: input.matterId ?? null,
      actor_id: input.scope.actorLawyerId,
      provider,
      model,
      task_type: input.taskType,
      privacy_mode: profile?.ai_privacy_mode ?? "hybrid",
      status: "started",
      request_hash: sha256(input.prompt),
      source_document_ids: input.sourceDocumentIds ?? [],
    }).select("id").single();
    runId = data?.id ?? null;
  }

  try {
    const response = provider === "gemini"
      ? await runGemini(input.prompt, input.model)
      : provider === "openrouter"
        ? await runOpenRouter(input.prompt, input.model)
        : await runLocal(input.prompt, profile?.local_ai_base_url ?? null, input.model);
    model = response.model;

    if (supabase && runId) {
      await supabase.from("ai_provider_runs").update({
        model,
        status: "succeeded",
        latency_ms: Date.now() - startedAt,
        response_hash: sha256(response.output),
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    return { provider, model, output: response.output, configured: true, runId, generatedAt: new Date().toISOString() };
  } catch (error) {
    if (supabase && runId) {
      await supabase.from("ai_provider_runs").update({
        model,
        status: "failed",
        latency_ms: Date.now() - startedAt,
        error_code: error instanceof Error ? error.message.slice(0, 250) : "AI_PROVIDER_FAILED",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    throw error;
  }
}
