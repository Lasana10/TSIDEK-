import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";

const EVENT_BY_ACTION: Record<string, string> = {
  createComment: "COMMENT_CREATED",
  createTask: "TASK_CREATED",
  updateTaskStatus: "TASK_STATUS_CHANGED",
  upsertPhysicalFile: "PHYSICAL_FILE_UPDATED",
  createCustodyEvent: "CUSTODY_EVENT_CREATED",
  assignMember: "MEMBER_ASSIGNED",
  removeMember: "MEMBER_REMOVED",
  createDocument: "DOCUMENT_CREATED",
  updateDocumentControl: "DOCUMENT_CONTROL_CHANGED",
  createCasePreparation: "CASE_PREPARATION_CREATED",
  createJurisprudenceEntry: "JURISPRUDENCE_ADDED",
  createCouncilRegisterEntry: "COUNCIL_REGISTER_UPDATED",
  createComplianceChecklistItem: "COMPLIANCE_ITEM_CREATED",
  updateComplianceChecklistItemStatus: "COMPLIANCE_ITEM_CHANGED",
  createKnowledgeEntry: "KNOWLEDGE_ENTRY_CREATED",
  upsertCaseField: "CASE_FIELD_CHANGED",
  createDigitalCaseFile: "DIGITAL_CASE_FILE_CREATED",
  createInvoice: "INVOICE_CREATED",
  updateInvoiceStatus: "INVOICE_STATUS_CHANGED",
  createPayment: "PAYMENT_RECORDED",
  createDisbursement: "DISBURSEMENT_RECORDED",
  createDocumentTemplate: "DOCUMENT_TEMPLATE_CREATED",
  generatePersonalizedDraft: "AI_DRAFT_GENERATED",
  archivePersonalizedDraft: "AI_DRAFT_ARCHIVED",
  updateSecurityProfile: "SECURITY_PROFILE_CHANGED",
  upsertAccessOverride: "ACCESS_OVERRIDE_CHANGED",
};

function safeMetadata(body: Record<string, unknown>) {
  const allowed = [
    "action", "taskId", "documentId", "invoiceId", "lawyerId",
    "checklistItemId", "status", "documentStatus", "reviewStatus",
    "securityClassification", "ethicalWallEnabled", "accessStatus",
    "provider", "paymentKind", "accountType",
  ];
  return Object.fromEntries(
    allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])
  );
}

export async function recordMatterEvent(input: {
  matterId: string;
  scope: RequestScope;
  eventType: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase persistence is required for matter audit events.");

  const matter = await supabase
    .from("matters")
    .select("id,firm_id")
    .eq("id", input.matterId)
    .maybeSingle();

  if (matter.error) throw new Error(matter.error.message);
  if (!matter.data) throw new Error("Matter not found.");
  if (input.scope.firmId && matter.data.firm_id !== input.scope.firmId) {
    throw new Error("Matter access denied for the current firm scope.");
  }

  const result = await supabase.from("matter_events").insert({
    matter_id: input.matterId,
    firm_id: matter.data.firm_id,
    event_type: input.eventType,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    actor_lawyer_id: input.scope.actorLawyerId,
    actor_name: input.scope.actorName,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });

  if (result.error) throw new Error(result.error.message);
}

export async function recordSuccessfulMatterAction(input: {
  matterId: string;
  scope: RequestScope;
  body: Record<string, unknown>;
}) {
  const action = String(input.body.action ?? "");
  const eventType = EVENT_BY_ACTION[action];
  if (!eventType) return;
  await recordMatterEvent({
    matterId: input.matterId,
    scope: input.scope,
    eventType,
    metadata: safeMetadata(input.body),
  });
}
