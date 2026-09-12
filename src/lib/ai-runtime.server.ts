import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";

export type AiPrivacyMode = "local_only" | "hybrid" | "cloud_allowed";
export type AiProviderName = "gemini" | "openrouter" | "local";
export type AiUserMode = "standard" | "high_accuracy" | "private" | "local";

export type AiRuntimeRequest = {
  scope: RequestScope;
  matterId?: string | null;
  interactionId?: string | null;
  taskType: string;
  prompt: string;
  preferredProvider?: AiProviderName | null;
  userMode?: AiUserMode | null;
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

type RuntimeProfile = {
  ai_privacy_mode: AiPrivacyMode;
  primary_cloud_provider: "gemini" | "openrouter" | "none";
  local_ai_base_url: string | null;
};

type AiPolicy = {
  user_facing_mode: AiUserMode;
  standard_route: Record<string, unknown>;
  high_accuracy_route: Record<string, unknown>;
  private_route: Record<string, unknown>;
  local_route: Record<string, unknown>;
  highly_confidential_mode: "disabled" | "private" | "local";
  store_prompt_text: boolean;
  prompt_retention_days: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadRuntimeProfile(firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("firm_runtime_profiles").select("ai_privacy_mode,primary_cloud_provider,local_ai_base_url").eq("firm_id", firmId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as RuntimeProfile | null;
}

async function loadAiPolicy(firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("firm_ai_policies").select("user_facing_mode,standard_route,high_accuracy_route,private_route,local_route,highly_confidential_mode,store_prompt_text,prompt_retention_days").eq("firm_id", firmId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AiPolicy | null;
}

async function loadMatterConfidentiality(firmId: string, matterId?: string | null) {
  if (!matterId) return null;
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("matters").select("confidentiality_level").eq("id", matterId).eq("firm_id", firmId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.confidentiality_level ? String(data.confidentiality_level).toLowerCase().replaceAll(" ", "_") : null;
}

function routeObject(policy: AiPolicy | null, mode: AiUserMode) {
  if (!policy) return {} as Record<string, unknown>;
  if (mode === "high_accuracy") return policy.high_accuracy_route || {};
  if (mode === "private") return policy.private_route || {};
  if (mode === "local") return policy.local_route || {};
  return policy.standard_route || {};
}

function providerFromRoute(route: Record<string, unknown>): AiProviderName | null {
  const provider = String(route.provider ?? "").toLowerCase();
  return provider === "gemini" || provider === "openrouter" || provider === "local" ? provider : null;
}

function modelFromRoute(route: Record<string, unknown>) {
  const value = route.model;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function providerAvailable(provider: AiProviderName, profile: RuntimeProfile | null) {
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  return Boolean(profile?.local_ai_base_url || process.env.TSIDEK_LOCAL_AI_BASE_URL);
}

function fallbackProvider(profile: RuntimeProfile | null, preferred?: AiProviderName | null): AiProviderName {
  const privacy = profile?.ai_privacy_mode ?? "hybrid";
  if (privacy === "local_only") {
    if (providerAvailable("local", profile)) return "local";
    throw new Error("The firm requires Local AI, but no local AI endpoint is configured.");
  }
  if (preferred && providerAvailable(preferred, profile)) return preferred;
  if (privacy === "hybrid" && providerAvailable("local", profile)) return "local";
  if (profile?.primary_cloud_provider === "openrouter" && providerAvailable("openrouter", profile)) return "openrouter";
  if (profile?.primary_cloud_provider === "gemini" && providerAvailable("gemini", profile)) return "gemini";
  if (providerAvailable("gemini", profile)) return "gemini";
  if (providerAvailable("openrouter", profile)) return "openrouter";
  if (providerAvailable("local", profile)) return "local";
  throw new Error("No permitted AI route is configured for this firm. TSIDKENU will not simulate a successful answer.");
}

function resolveRoute(input: {
  profile: RuntimeProfile | null;
  policy: AiPolicy | null;
  matterConfidentiality: string | null;
  requestedMode?: AiUserMode | null;
  preferredProvider?: AiProviderName | null;
  explicitModel?: string | null;
}) {
  let mode: AiUserMode = input.requestedMode || input.policy?.user_facing_mode || "standard";
  const highlyConfidential = input.matterConfidentiality === "highly_confidential" || input.matterConfidentiality === "highly-confidential" || input.matterConfidentiality === "partner-only";
  if (highlyConfidential) {
    const restriction = input.policy?.highly_confidential_mode || "local";
    if (restriction === "disabled") throw new Error("AI is disabled for highly confidential matters by firm policy.");
    mode = restriction;
  }
  const route = routeObject(input.policy, mode);
  const configuredProvider = providerFromRoute(route);
  let provider: AiProviderName;
  if (mode === "local") {
    if (!providerAvailable("local", input.profile)) throw new Error("Local AI is required for this work, but no local endpoint is configured.");
    provider = "local";
  } else if (mode === "private") {
    if (configuredProvider && providerAvailable(configuredProvider, input.profile)) provider = configuredProvider;
    else if (providerAvailable("local", input.profile)) provider = "local";
    else throw new Error("No private AI route is configured for this firm.");
  } else if (configuredProvider && providerAvailable(configuredProvider, input.profile)) {
    provider = configuredProvider;
  } else {
    provider = fallbackProvider(input.profile, input.preferredProvider);
  }
  const model = input.explicitModel || modelFromRoute(route);
  return { mode, provider, model };
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
  const model = modelOverride || process.env.TSIDEK_OPENROUTER_MODEL || "openrouter/free";
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
  if (!endpoint) throw new Error("Local AI is required by the firm's privacy policy but no local endpoint is configured.");
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
  const [profile, policy, matterConfidentiality] = await Promise.all([
    loadRuntimeProfile(input.scope.firmId),
    loadAiPolicy(input.scope.firmId),
    loadMatterConfidentiality(input.scope.firmId, input.matterId),
  ]);
  const route = resolveRoute({ profile, policy, matterConfidentiality, requestedMode: input.userMode, preferredProvider: input.preferredProvider, explicitModel: input.model });
  const provider = route.provider;
  const startedAt = Date.now();
  const supabase = createServerSupabaseClient();
  let runId: string | null = null;
  let model = route.model || "pending";
  const requestHash = sha256(input.prompt);

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
      request_hash: requestHash,
      source_document_ids: input.sourceDocumentIds ?? [],
    }).select("id").single();
    runId = data?.id ?? null;
  }

  try {
    const response = provider === "gemini"
      ? await runGemini(input.prompt, route.model)
      : provider === "openrouter"
        ? await runOpenRouter(input.prompt, route.model)
        : await runLocal(input.prompt, profile?.local_ai_base_url ?? null, route.model);
    model = response.model;
    const responseHash = sha256(response.output);

    if (supabase) {
      if (runId) await supabase.from("ai_provider_runs").update({ model, status:"succeeded", latency_ms:Date.now()-startedAt, response_hash:responseHash, completed_at:new Date().toISOString() }).eq("id",runId);
      await supabase.from("ai_activity_ledger").insert({
        firm_id: input.scope.firmId,
        matter_id: input.matterId ?? null,
        actor_lawyer_id: input.scope.actorLawyerId,
        interaction_id: input.interactionId ?? null,
        mode: route.mode,
        provider_route: provider,
        model_name: model,
        task_type: input.taskType,
        source_document_ids: input.sourceDocumentIds ?? [],
        input_hash: requestHash,
        output_hash: responseHash,
        outcome_status: "generated",
        metadata: { run_id: runId, matter_confidentiality: matterConfidentiality, prompt_stored: Boolean(policy?.store_prompt_text) },
      });
    }
    return { provider, model, output: response.output, configured: true, runId, generatedAt: new Date().toISOString() };
  } catch (error) {
    if (supabase) {
      if (runId) await supabase.from("ai_provider_runs").update({ model, status:"failed", latency_ms:Date.now()-startedAt, error_code:error instanceof Error?error.message.slice(0,250):"AI_PROVIDER_FAILED", completed_at:new Date().toISOString() }).eq("id",runId);
      await supabase.from("ai_activity_ledger").insert({
        firm_id: input.scope.firmId,
        matter_id: input.matterId ?? null,
        actor_lawyer_id: input.scope.actorLawyerId,
        interaction_id: input.interactionId ?? null,
        mode: route.mode,
        provider_route: provider,
        model_name: model,
        task_type: input.taskType,
        source_document_ids: input.sourceDocumentIds ?? [],
        input_hash: requestHash,
        outcome_status: "failed",
        metadata: { run_id: runId, matter_confidentiality: matterConfidentiality },
      });
    }
    throw error;
  }
}
