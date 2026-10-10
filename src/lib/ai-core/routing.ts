/** Shared, framework-neutral AI routing policy. No secrets or client data. */
export type Product = "BE0N" | "TSIDKENU" | "DREEM" | "AFAT";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type Provider = "openrouter" | "gemini" | "private";
export type Task = "general" | "legal" | "finance" | "education" | "mobility" | "vision";
export type RouteRequest = {
  product: Product;
  task: Task;
  sensitivity: Sensitivity;
  approvedExternalProcessing: boolean;
  availableProviders: readonly Provider[];
  overrideModel?: string;
};
export type RouteDecision = { provider: Provider; model: string; requiresHumanReview: boolean; reason: string };
const candidates: Record<Task, string> = {
  general: "anthropic/claude-haiku-5.5",
  legal: "anthropic/claude-haiku-5.5",
  finance: "anthropic/claude-haiku-5.5",
  education: "z-ai/glm-5.3-flash",
  mobility: "anthropic/claude-haiku-5.5",
  vision: "google/gemini-2.5-flash",
};
/** Fail closed: confidential data must never silently fall back to a cloud provider. */
export function selectAiRoute(req: RouteRequest): RouteDecision {
  if (req.sensitivity === "restricted" || (req.sensitivity !== "public" && !req.approvedExternalProcessing)) {
    if (!req.availableProviders.includes("private")) throw new Error("PRIVATE_AI_REQUIRED");
    return {provider:"private", model:"private/default", requiresHumanReview:true, reason:"sensitive_data_boundary"};
  }
  if (req.availableProviders.includes("openrouter")) {
    return {provider:"openrouter",model:req.overrideModel || candidates[req.task],requiresHumanReview:req.task==="legal"||req.task==="finance",reason:"benchmarked_candidate"};
  }
  if (req.availableProviders.includes("private")) {
    return {provider:"private",model:"private/default",requiresHumanReview:true,reason:"private_provider_available"};
  }
  throw new Error("NO_APPROVED_AI_PROVIDER");
}
export function parseStructuredOutput<T>(raw: string, validate: (value: unknown) => value is T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); } catch { throw new Error("AI_INVALID_JSON"); }
  if (!validate(parsed)) throw new Error("AI_SCHEMA_VALIDATION_FAILED");
  return parsed;
}
