import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import type { LegalResearchHit } from "@/lib/legal-research.server";
import type { AiRuntimeResult } from "@/lib/ai-runtime.server";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function recordAiWorkAndEvaluation(input: {
  scope: RequestScope;
  matterId: string;
  role: string;
  context: string;
  result: AiRuntimeResult;
  hits: LegalResearchHit[];
}) {
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");

  const sourceDocumentIds = [...new Set(input.hits.map((hit) => hit.source_document_id))];
  const sourceAuthorityIds = [...new Set(input.hits.map((hit) => hit.authority_id).filter((value): value is string => Boolean(value)))];
  const expectedLabels = input.hits.map((_, index) => `[SOURCE ${index + 1}]`);
  const labelsUsed = expectedLabels.filter((label) => input.result.output.includes(label)).length;
  const citationSupportScore = input.hits.length === 0 ? 0 : Math.round((labelsUsed / input.hits.length) * 10000) / 100;
  const jurisdictionScore = input.hits.length > 0 ? 100 : 0;
  const temporalAccuracyScore = input.hits.some((hit) => /valid|version|effective/i.test(hit.content)) ? 100 : input.hits.length > 0 ? 70 : 0;
  const hallucinationRiskScore = input.hits.length === 0 ? 100 : Math.max(0, 100 - citationSupportScore);
  const passed = input.hits.length > 0 && citationSupportScore >= 50 && hallucinationRiskScore <= 50;

  const work = await supabase.from("ai_work_products").insert({
    firm_id: input.scope.firmId,
    matter_id: input.matterId,
    work_product_type: input.role,
    title: `${input.role} analysis`,
    model_provider: input.result.provider,
    model_name: input.result.model,
    prompt_hash: hash(input.context),
    source_authority_ids: sourceAuthorityIds,
    source_document_ids: sourceDocumentIds,
    output_hash: hash(input.result.output),
    status: "DRAFT",
    generated_by: input.scope.actorLawyerId,
    metadata: {
      providerRunId: input.result.runId,
      sourceCount: sourceDocumentIds.length,
      requiresHumanReview: true,
      outputPreview: input.result.output.slice(0, 1500),
    },
  }).select("id").single();
  if (work.error || !work.data) throw new Error(work.error?.message ?? "Unable to persist AI work product.");

  const evaluation = await supabase.from("ai_quality_evaluations").insert({
    firm_id: input.scope.firmId,
    matter_id: input.matterId,
    ai_work_product_id: work.data.id,
    provider_run_id: input.result.runId,
    citation_support_score: citationSupportScore,
    jurisdiction_score: jurisdictionScore,
    temporal_accuracy_score: temporalAccuracyScore,
    hallucination_risk_score: hallucinationRiskScore,
    bilingual_quality_score: null,
    passed,
    evaluator: "tsidek-deterministic-source-gate-v1",
    findings: {
      labelsExpected: expectedLabels.length,
      labelsUsed,
      sourceCount: sourceDocumentIds.length,
      requiresHumanReview: true,
      note: passed ? "Automated source gate passed; lawyer review is still mandatory." : "Automated source gate failed or sources were insufficient; do not approve without correction.",
    },
  }).select("id,passed,citation_support_score,hallucination_risk_score").single();
  if (evaluation.error) throw new Error(evaluation.error.message);

  return { workProductId: work.data.id, evaluation: evaluation.data };
}
