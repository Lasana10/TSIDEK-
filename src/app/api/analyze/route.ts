import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { searchLegalSources } from "@/lib/legal-research.server";
import { runGovernedAi } from "@/lib/ai-runtime.server";

const supportedRoles = new Set([
  "SUPREME_REASONER",
  "LEGAL_SCULPTOR",
  "PRIVACY_GUARDIAN",
  "FRONT_ORCHESTRATOR",
  "COMPLIANCE_BOT",
]);

function roleInstruction(role: string) {
  switch (role) {
    case "SUPREME_REASONER":
      return "Analyze the legal problem conservatively. Separate facts, issues, applicable law, arguments, counterarguments, procedural risks, evidence gaps and recommended next actions.";
    case "LEGAL_SCULPTOR":
      return "Draft or revise the requested legal instrument precisely. Never insert an authority that is absent from the supplied source pack.";
    case "PRIVACY_GUARDIAN":
      return "Identify confidentiality, privilege, personal-data and disclosure risks. Prefer minimization and local processing where appropriate.";
    case "COMPLIANCE_BOT":
      return "Audit the request for Cameroon, OHADA, CEMAC, COBAC or OAPI compliance only to the extent supported by the supplied source pack.";
    default:
      return "Provide a concise bilingual-ready legal operations answer grounded only in the supplied source pack.";
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId || !scope.actorLawyerId) {
      return NextResponse.json({ success: false, error: "Authenticated firm context is required." }, { status: 401 });
    }

    const body = await request.json();
    const context = typeof body?.context === "string" ? body.context.trim() : "";
    const role = typeof body?.role === "string" ? body.role : "FRONT_ORCHESTRATOR";
    const matterId = typeof body?.matterId === "string" && body.matterId ? body.matterId : null;
    const preferredProvider = ["gemini", "openrouter", "local"].includes(body?.provider) ? body.provider : null;

    if (!context || !supportedRoles.has(role)) {
      return NextResponse.json({ success: false, error: "A valid context and legal role are required." }, { status: 400 });
    }

    const research = await searchLegalSources({ scope, query: context, matterId, limit: 10 });
    const sourcePack = research.hits
      .map((hit, index) => [
        `[SOURCE ${index + 1}] ${hit.title} — ${hit.jurisdiction}`,
        hit.section_path ? `Pinpoint: ${hit.section_path}` : null,
        hit.source_url || hit.canonical_uri ? `Source: ${hit.source_url || hit.canonical_uri}` : null,
        hit.content,
      ].filter(Boolean).join("\n"))
      .join("\n\n");

    const prompt = [
      "You are TSIDKENU, a human-supervised legal operating system.",
      "Do not fabricate statutes, cases, citations, dates, institutions or holdings.",
      "Every legal proposition that depends on authority must be traceable to the SOURCE pack below.",
      "If the source pack is insufficient, say exactly what is missing instead of guessing.",
      "Do not provide a fabricated win probability. Mark predictions as judgment-dependent unless supported by verified internal evaluation data.",
      roleInstruction(role),
      `USER CONTEXT:\n${context}`,
      sourcePack ? `VERIFIED SOURCE PACK:\n${sourcePack}` : "VERIFIED SOURCE PACK: none found.",
    ].join("\n\n");

    const result = await runGovernedAi({
      scope,
      matterId,
      taskType: role,
      prompt,
      preferredProvider,
      sourceDocumentIds: research.hits.map((hit) => hit.source_document_id),
    });

    return NextResponse.json({
      success: true,
      payload: result,
      research: {
        sourceCount: research.sourceCount,
        sources: research.hits.map((hit) => ({
          sourceDocumentId: hit.source_document_id,
          authorityId: hit.authority_id,
          title: hit.title,
          jurisdiction: hit.jurisdiction,
          sectionPath: hit.section_path,
          sourceUrl: hit.source_url,
          canonicalUri: hit.canonical_uri,
          rank: hit.rank,
        })),
        warning: research.warning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to synthesize legal strategy.";
    console.error("[API Analyze Route]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
