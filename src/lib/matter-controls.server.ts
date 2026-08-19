import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { recordMatterEvent } from "@/lib/matter-events.server";

function requireSupabase() {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  return supabase;
}

async function resolveFirmId(matterId: string, scope: RequestScope) {
  const supabase = requireSupabase();
  const result = await supabase.from("matters").select("firm_id").eq("id", matterId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Matter not found.");
  if (scope.firmId && scope.firmId !== result.data.firm_id) {
    throw new Error("Matter access denied for the current firm scope.");
  }
  return result.data.firm_id as string;
}

export async function listMatterControls(matterId: string, scope: RequestScope) {
  const supabase = requireSupabase();
  await resolveFirmId(matterId, scope);

  const [obligations, approvals, documents, communications] = await Promise.all([
    supabase.from("matter_obligations").select("*").eq("matter_id", matterId).order("due_at", { ascending: true }),
    supabase.from("matter_approvals").select("*").eq("matter_id", matterId).order("requested_at", { ascending: false }),
    supabase.from("legal_document_records").select("*").eq("matter_id", matterId).order("updated_at", { ascending: false }),
    supabase.from("matter_communications").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }),
  ]);

  for (const result of [obligations, approvals, documents, communications]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    obligations: obligations.data ?? [],
    approvals: approvals.data ?? [],
    documents: documents.data ?? [],
    communications: communications.data ?? [],
  };
}

export async function createMatterObligation(input: {
  matterId: string;
  scope: RequestScope;
  title: string;
  obligationType?: string;
  sourceType?: string | null;
  sourceReference?: string | null;
  legalBasis?: string | null;
  dueAt?: string | null;
  responsibleLawyerId?: string | null;
  consequence?: string | null;
}) {
  const supabase = requireSupabase();
  const firmId = await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("matter_obligations").insert({
    matter_id: input.matterId,
    firm_id: firmId,
    title: input.title,
    obligation_type: input.obligationType || "deadline",
    source_type: input.sourceType ?? null,
    source_reference: input.sourceReference ?? null,
    legal_basis: input.legalBasis ?? null,
    due_at: input.dueAt ?? null,
    responsible_lawyer_id: input.responsibleLawyerId ?? input.scope.actorLawyerId,
    consequence: input.consequence ?? null,
    created_by: input.scope.actorLawyerId,
  }).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "OBLIGATION_CREATED",
    metadata: { obligationId: result.data.id, obligationType: result.data.obligation_type },
  });
  return result.data;
}

export async function updateMatterObligationStatus(input: {
  matterId: string;
  scope: RequestScope;
  obligationId: string;
  status: "OPEN" | "IN_PROGRESS" | "SATISFIED" | "WAIVED" | "MISSED" | "CANCELLED";
  completionEvidence?: Record<string, unknown>;
}) {
  const supabase = requireSupabase();
  await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("matter_obligations").update({
    status: input.status,
    completion_evidence: input.completionEvidence ?? {},
    completed_at: ["SATISFIED", "WAIVED", "CANCELLED"].includes(input.status) ? new Date().toISOString() : null,
  }).eq("id", input.obligationId).eq("matter_id", input.matterId).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "OBLIGATION_STATUS_CHANGED",
    metadata: { obligationId: input.obligationId, status: input.status },
  });
  return result.data;
}

export async function registerLegalDocument(input: {
  matterId: string;
  scope: RequestScope;
  title: string;
  documentType?: string | null;
  existingDocumentId?: string | null;
  externalFileId?: string | null;
  securityClassification?: string;
  clientVisible?: boolean;
  provenance?: Record<string, unknown>;
}) {
  const supabase = requireSupabase();
  const firmId = await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("legal_document_records").insert({
    matter_id: input.matterId,
    firm_id: firmId,
    existing_document_id: input.existingDocumentId ?? null,
    external_file_id: input.externalFileId ?? null,
    title: input.title,
    document_type: input.documentType ?? null,
    security_classification: input.securityClassification ?? "Standard",
    client_visible: Boolean(input.clientVisible),
    provenance: input.provenance ?? {},
    created_by: input.scope.actorLawyerId,
  }).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "LEGAL_DOCUMENT_REGISTERED",
    metadata: { legalDocumentId: result.data.id, lifecycle: result.data.lifecycle_state },
  });
  return result.data;
}

export async function transitionLegalDocument(input: {
  matterId: string;
  scope: RequestScope;
  documentId: string;
  lifecycleState: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ISSUED" | "FILED" | "SENT" | "SUPERSEDED" | "ARCHIVED";
}) {
  const supabase = requireSupabase();
  await resolveFirmId(input.matterId, input.scope);

  const patch: Record<string, unknown> = {
    lifecycle_state: input.lifecycleState,
    updated_at: new Date().toISOString(),
  };
  if (input.lifecycleState === "APPROVED") {
    patch.approved_by = input.scope.actorLawyerId;
    patch.approved_at = new Date().toISOString();
  }
  if (input.lifecycleState === "IN_REVIEW") {
    patch.reviewed_by = input.scope.actorLawyerId;
  }

  const result = await supabase.from("legal_document_records")
    .update(patch)
    .eq("id", input.documentId)
    .eq("matter_id", input.matterId)
    .select("*")
    .single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "LEGAL_DOCUMENT_STATE_CHANGED",
    metadata: { legalDocumentId: input.documentId, lifecycle: input.lifecycleState },
  });
  return result.data;
}

export async function requestMatterApproval(input: {
  matterId: string;
  scope: RequestScope;
  approvalType: string;
  subjectType: string;
  subjectId: string;
}) {
  const supabase = requireSupabase();
  const firmId = await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("matter_approvals").insert({
    matter_id: input.matterId,
    firm_id: firmId,
    approval_type: input.approvalType,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    requested_by: input.scope.actorLawyerId,
  }).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "APPROVAL_REQUESTED",
    metadata: { approvalId: result.data.id, approvalType: input.approvalType },
  });
  return result.data;
}

export async function decideMatterApproval(input: {
  matterId: string;
  scope: RequestScope;
  approvalId: string;
  status: "APPROVED" | "REJECTED" | "WITHDRAWN";
  reason?: string | null;
}) {
  const supabase = requireSupabase();
  await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("matter_approvals").update({
    status: input.status,
    decision_reason: input.reason ?? null,
    decided_by: input.scope.actorLawyerId,
    decided_at: new Date().toISOString(),
  }).eq("id", input.approvalId).eq("matter_id", input.matterId).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "APPROVAL_DECIDED",
    metadata: { approvalId: input.approvalId, status: input.status },
  });
  return result.data;
}

export async function draftMatterCommunication(input: {
  matterId: string;
  scope: RequestScope;
  channel: string;
  direction?: "INBOUND" | "OUTBOUND";
  subject?: string | null;
  recipientOrSender?: string | null;
  substantiveLegalAdvice?: boolean;
  bodyHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = requireSupabase();
  const firmId = await resolveFirmId(input.matterId, input.scope);
  const result = await supabase.from("matter_communications").insert({
    matter_id: input.matterId,
    firm_id: firmId,
    channel: input.channel,
    direction: input.direction ?? "OUTBOUND",
    subject: input.subject ?? null,
    recipient_or_sender: input.recipientOrSender ?? null,
    substantive_legal_advice: Boolean(input.substantiveLegalAdvice),
    body_hash: input.bodyHash ?? null,
    drafted_by: input.scope.actorLawyerId,
    metadata: input.metadata ?? {},
  }).select("*").single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "COMMUNICATION_DRAFTED",
    metadata: { communicationId: result.data.id, channel: input.channel, substantive: Boolean(input.substantiveLegalAdvice) },
  });
  return result.data;
}

export async function transitionMatterCommunication(input: {
  matterId: string;
  scope: RequestScope;
  communicationId: string;
  lifecycleState: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SENT" | "DELIVERED" | "ACKNOWLEDGED" | "REPLIED" | "FAILED";
  externalMessageId?: string | null;
}) {
  const supabase = requireSupabase();
  await resolveFirmId(input.matterId, input.scope);

  const patch: Record<string, unknown> = { lifecycle_state: input.lifecycleState };
  if (input.lifecycleState === "IN_REVIEW") patch.reviewed_by = input.scope.actorLawyerId;
  if (input.lifecycleState === "APPROVED") patch.approved_by = input.scope.actorLawyerId;
  if (input.lifecycleState === "SENT") patch.sent_at = new Date().toISOString();
  if (input.lifecycleState === "DELIVERED") patch.delivered_at = new Date().toISOString();
  if (input.externalMessageId !== undefined) patch.external_message_id = input.externalMessageId;

  const result = await supabase.from("matter_communications")
    .update(patch)
    .eq("id", input.communicationId)
    .eq("matter_id", input.matterId)
    .select("*")
    .single();
  if (result.error) throw new Error(result.error.message);

  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType: "COMMUNICATION_STATE_CHANGED",
    metadata: { communicationId: input.communicationId, lifecycle: input.lifecycleState },
  });
  return result.data;
}
