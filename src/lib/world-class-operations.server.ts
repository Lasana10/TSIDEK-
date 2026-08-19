import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { deliverMatterUpdate } from "@/lib/communications";
import { recordMatterEvent } from "@/lib/matter-events.server";

function db() {
  const s = createServerSupabaseClient();
  if (!s) throw new Error("Supabase server configuration is required.");
  return s;
}

async function firmId(matterId: string, scope: RequestScope) {
  const s = db();
  const r = await s.from("matters").select("firm_id").eq("id", matterId).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) throw new Error("Matter not found.");
  if (scope.firmId && scope.firmId !== r.data.firm_id) throw new Error("Cross-firm access denied.");
  return r.data.firm_id as string;
}

export async function addAuthority(input: any) {
  const s = db();
  const firm = await firmId(input.matterId, input.scope);
  const checksum = input.sourceText
    ? createHash("sha256").update(String(input.sourceText)).digest("hex")
    : null;
  const a = await s.from("legal_authorities").insert({
    firm_id: firm,
    jurisdiction: input.jurisdiction,
    authority_type: input.authorityType,
    title: input.title,
    citation: input.citation ?? null,
    issuing_body: input.issuingBody ?? null,
    source_url: input.sourceUrl ?? null,
    source_storage_path: input.sourceStoragePath ?? null,
    official_source: Boolean(input.officialSource),
    language: input.language ?? null,
    checksum,
  }).select("*").single();
  if (a.error) throw new Error(a.error.message);

  let proposition = null;
  if (input.proposition) {
    const p = await s.from("legal_propositions").insert({
      firm_id: firm,
      authority_id: a.data.id,
      proposition: input.proposition,
      pinpoint_reference: input.pinpointReference ?? null,
    }).select("*").single();
    if (p.error) throw new Error(p.error.message);
    proposition = p.data;
  }

  const link = await s.from("matter_authority_links").insert({
    firm_id: firm,
    matter_id: input.matterId,
    authority_id: a.data.id,
    proposition_id: proposition?.id ?? null,
    added_by: input.scope.actorLawyerId,
  });
  if (link.error) throw new Error(link.error.message);

  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: "LEGAL_AUTHORITY_ADDED",
    metadata: { authorityId: a.data.id, officialSource: Boolean(input.officialSource) },
  });
  return { authority: a.data, proposition };
}

export async function postLedger(input: any) {
  const s = db();
  const firm = await firmId(input.matterId, input.scope);
  if (!Number.isFinite(input.amountXaf) || input.amountXaf <= 0) throw new Error("Positive amount required.");
  const r = await s.from("finance_ledger_entries").insert({
    firm_id: firm,
    matter_id: input.matterId,
    entry_type: input.entryType,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    amount_xaf: Math.round(input.amountXaf),
    direction: input.direction,
    account_bucket: input.accountBucket,
    description: input.description ?? null,
    provider_reference: input.providerReference ?? null,
    created_by: input.scope.actorLawyerId,
  }).select("*").single();
  if (r.error) throw new Error(r.error.message);
  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: "FINANCE_LEDGER_POSTED",
    metadata: { ledgerEntryId: r.data.id, entryType: input.entryType },
  });
  return r.data;
}

export async function registerAiProduct(input: any) {
  const s = db();
  const firm = await firmId(input.matterId, input.scope);
  const r = await s.from("ai_work_products").insert({
    firm_id: firm,
    matter_id: input.matterId,
    work_product_type: input.workProductType,
    title: input.title,
    model_provider: input.modelProvider ?? null,
    model_name: input.modelName ?? null,
    prompt_hash: input.promptText ? createHash("sha256").update(input.promptText).digest("hex") : null,
    source_authority_ids: input.sourceAuthorityIds ?? [],
    source_document_ids: input.sourceDocumentIds ?? [],
    draft_storage_path: input.draftStoragePath ?? null,
    output_hash: input.outputText ? createHash("sha256").update(input.outputText).digest("hex") : null,
    generated_by: input.scope.actorLawyerId,
  }).select("*").single();
  if (r.error) throw new Error(r.error.message);
  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: "AI_WORK_PRODUCT_REGISTERED",
    metadata: { workProductId: r.data.id },
  });
  return r.data;
}

export async function dispatchApproved(input: any) {
  const s = db();
  await firmId(input.matterId, input.scope);
  const c = await s.from("matter_communications")
    .select("id,lifecycle_state,substantive_legal_advice")
    .eq("id", input.communicationId).eq("matter_id", input.matterId).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) throw new Error("Communication not found.");
  if (c.data.substantive_legal_advice && c.data.lifecycle_state !== "APPROVED") {
    throw new Error("Substantive legal communication must be approved before dispatch.");
  }

  const delivery = await deliverMatterUpdate({
    matterId: input.matterId,
    channel: input.channel,
    title: input.title,
    message: input.message,
  });

  const u = await s.from("matter_communications").update({
    lifecycle_state: delivery.delivered ? "SENT" : "FAILED",
    sent_at: delivery.delivered ? new Date().toISOString() : null,
    recipient_or_sender: delivery.recipient,
    metadata: { deliveryNote: delivery.note },
  }).eq("id", input.communicationId).eq("matter_id", input.matterId);
  if (u.error) throw new Error(u.error.message);

  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: delivery.delivered ? "CLIENT_COMMUNICATION_SENT" : "CLIENT_COMMUNICATION_FAILED",
    metadata: { communicationId: input.communicationId, channel: input.channel },
  });
  return delivery;
}

export async function saveClosure(input: any) {
  const s = db();
  const firm = await firmId(input.matterId, input.scope);
  const complete = input.financialReconciled && input.obligationsResolved &&
    input.documentsArchived && input.clientNotified && input.knowledgeReviewed;
  if (input.approve && !complete) throw new Error("Complete all closure controls before approval.");

  const payload: any = {
    firm_id: firm,
    matter_id: input.matterId,
    outcome_summary: input.outcomeSummary ?? null,
    client_outcome: input.clientOutcome ?? null,
    financial_reconciled: Boolean(input.financialReconciled),
    obligations_resolved: Boolean(input.obligationsResolved),
    documents_archived: Boolean(input.documentsArchived),
    client_notified: Boolean(input.clientNotified),
    knowledge_reviewed: Boolean(input.knowledgeReviewed),
    lessons_learned: input.lessonsLearned ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.approve) {
    payload.approved_by = input.scope.actorLawyerId;
    payload.approved_at = new Date().toISOString();
  }

  const r = await s.from("matter_closure_reviews").upsert(payload, { onConflict: "matter_id" })
    .select("*").single();
  if (r.error) throw new Error(r.error.message);

  if (input.approve && input.lessonsLearned) {
    const m = await s.from("institutional_memory_entries").insert({
      firm_id: firm, matter_id: input.matterId,
      memory_type: "MATTER_CLOSURE",
      title: "Approved matter closure learning",
      summary: input.lessonsLearned,
      outcome: input.outcomeSummary ?? null,
      proposed_by: input.scope.actorLawyerId,
      approved: true,
      approved_by: input.scope.actorLawyerId,
      approved_at: new Date().toISOString(),
    });
    if (m.error) throw new Error(m.error.message);
  }

  await recordMatterEvent({
    matterId: input.matterId, scope: input.scope,
    eventType: input.approve ? "MATTER_CLOSURE_APPROVED" : "MATTER_CLOSURE_REVIEW_SAVED",
    metadata: { closureReviewId: r.data.id },
  });
  return r.data;
}
