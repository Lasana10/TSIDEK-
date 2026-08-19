import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { isMatterLifecycleState } from "@/lib/matter-lifecycle";

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function must<T>(result: QueryResult<T>, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${label}: no data returned.`);
  }
  return result.data;
}

function dueSeverity(dueAt: string | null) {
  if (!dueAt) return "NONE" as const;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const hours = (due - now) / 36e5;
  if (hours < 0) return "OVERDUE" as const;
  if (hours <= 24) return "CRITICAL" as const;
  if (hours <= 72) return "HIGH" as const;
  if (hours <= 168) return "MEDIUM" as const;
  return "NORMAL" as const;
}

export async function getMatterCommandCenter(input: {
  matterId: string;
  scope: RequestScope;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase persistence is required for the matter command center.");
  }

  const matterResult = await supabase
    .from("matters")
    .select(
      "id,firm_id,title,client_name,status,risk_level,jurisdiction,lead_lawyer_id,security_classification,ethical_wall_enabled,lifecycle_state"
    )
    .eq("id", input.matterId)
    .maybeSingle();

  if (matterResult.error) throw new Error(matterResult.error.message);
  if (!matterResult.data) throw new Error("Matter not found.");

  const matter = matterResult.data;

  if (input.scope.firmId && matter.firm_id !== input.scope.firmId) {
    throw new Error("Matter access denied for the current firm scope.");
  }

  const [
    obligationResult,
    approvalResult,
    documentResult,
    communicationResult,
    memberResult,
    invoiceResult,
    paymentResult,
    eventResult,
  ] = await Promise.all([
    supabase
      .from("matter_obligations")
      .select(
        "id,title,obligation_type,legal_basis,due_at,responsible_lawyer_id,consequence,status,created_at,completed_at"
      )
      .eq("matter_id", input.matterId)
      .order("due_at", { ascending: true }),
    supabase
      .from("matter_approvals")
      .select(
        "id,approval_type,subject_type,subject_id,status,decision_reason,requested_at,decided_at,requested_by,decided_by"
      )
      .eq("matter_id", input.matterId)
      .order("requested_at", { ascending: false }),
    supabase
      .from("legal_document_records")
      .select(
        "id,title,document_type,authoritative_version,lifecycle_state,security_classification,client_visible,approved_at,updated_at"
      )
      .eq("matter_id", input.matterId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("matter_communications")
      .select(
        "id,channel,direction,subject,recipient_or_sender,lifecycle_state,substantive_legal_advice,sent_at,delivered_at,created_at"
      )
      .eq("matter_id", input.matterId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("matter_members")
      .select("lawyer_id,is_primary,lawyers(id,full_name,role)")
      .eq("matter_id", input.matterId),
    supabase
      .from("invoices")
      .select("id,amount_xaf,status,due_date,created_at")
      .eq("matter_id", input.matterId),
    supabase
      .from("payments")
      .select("id,amount_xaf,currency,provider,status,payment_kind,account_type,created_at")
      .eq("matter_id", input.matterId),
    supabase
      .from("matter_events")
      .select("id,event_type,actor_name,reason,metadata,occurred_at")
      .eq("matter_id", input.matterId)
      .order("occurred_at", { ascending: false })
      .limit(12),
  ]);

  if (obligationResult.error) throw new Error(obligationResult.error.message);
  if (approvalResult.error) throw new Error(approvalResult.error.message);
  if (documentResult.error) throw new Error(documentResult.error.message);
  if (communicationResult.error) throw new Error(communicationResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (paymentResult.error) throw new Error(paymentResult.error.message);
  if (eventResult.error) throw new Error(eventResult.error.message);

  const obligations = (obligationResult.data ?? []).map((item) => ({
    ...item,
    severity: dueSeverity(item.due_at),
  }));

  const openObligations = obligations.filter((item) =>
    ["OPEN", "IN_PROGRESS", "MISSED"].includes(item.status)
  );
  const pendingApprovals = (approvalResult.data ?? []).filter(
    (item) => item.status === "PENDING"
  );

  const authoritativeDocuments = (documentResult.data ?? []).filter((item) =>
    ["APPROVED", "ISSUED", "FILED", "SENT"].includes(item.lifecycle_state)
  );
  const documentsAwaitingReview = (documentResult.data ?? []).filter((item) =>
    ["DRAFT", "IN_REVIEW"].includes(item.lifecycle_state)
  );

  const communications = communicationResult.data ?? [];
  const unapprovedSubstantiveCommunications = communications.filter(
    (item) =>
      item.direction === "OUTBOUND" &&
      item.substantive_legal_advice &&
      ["DRAFT", "IN_REVIEW"].includes(item.lifecycle_state)
  );

  const invoices = invoiceResult.data ?? [];
  const payments = paymentResult.data ?? [];
  const invoicedXaf = invoices.reduce(
    (sum, item) => sum + Number(item.amount_xaf ?? 0),
    0
  );
  const receivedXaf = payments
    .filter((item) =>
      ["Paid", "Confirmed", "Completed", "Received"].includes(String(item.status))
    )
    .reduce((sum, item) => sum + Number(item.amount_xaf ?? 0), 0);

  const lifecycleState = isMatterLifecycleState(matter.lifecycle_state)
    ? matter.lifecycle_state
    : "OPEN";

  const riskFlags = [
    ...openObligations
      .filter((item) => ["OVERDUE", "CRITICAL", "HIGH"].includes(item.severity))
      .map((item) => ({
        key: `obligation:${item.id}`,
        severity: item.severity,
        label: item.title,
        detail: item.consequence || item.legal_basis || "Time-sensitive matter obligation.",
      })),
    ...pendingApprovals.map((item) => ({
      key: `approval:${item.id}`,
      severity: "MEDIUM" as const,
      label: `${item.approval_type} approval pending`,
      detail: `${item.subject_type} is waiting for a decision.`,
    })),
    ...unapprovedSubstantiveCommunications.map((item) => ({
      key: `communication:${item.id}`,
      severity: "HIGH" as const,
      label: "Substantive client communication awaiting approval",
      detail: item.subject || `${item.channel} outbound communication`,
    })),
  ];

  return {
    matter: {
      id: matter.id,
      title: matter.title,
      clientName: matter.client_name,
      displayStatus: matter.status,
      lifecycleState,
      riskLevel: matter.risk_level,
      jurisdiction: matter.jurisdiction,
      securityClassification: matter.security_classification,
      ethicalWallEnabled: Boolean(matter.ethical_wall_enabled),
      leadLawyerId: matter.lead_lawyer_id,
    },
    summary: {
      openObligations: openObligations.length,
      overdueOrCriticalObligations: openObligations.filter((item) =>
        ["OVERDUE", "CRITICAL"].includes(item.severity)
      ).length,
      pendingApprovals: pendingApprovals.length,
      authoritativeDocuments: authoritativeDocuments.length,
      documentsAwaitingReview: documentsAwaitingReview.length,
      unapprovedSubstantiveCommunications:
        unapprovedSubstantiveCommunications.length,
      invoicedXaf,
      receivedXaf,
      outstandingXaf: Math.max(0, invoicedXaf - receivedXaf),
    },
    obligations: openObligations.slice(0, 8),
    approvals: pendingApprovals.slice(0, 8),
    documents: {
      authoritative: authoritativeDocuments.slice(0, 8),
      awaitingReview: documentsAwaitingReview.slice(0, 8),
    },
    communications: communications.slice(0, 8),
    team: memberResult.data ?? [],
    finance: {
      invoices,
      payments,
      invoicedXaf,
      receivedXaf,
      outstandingXaf: Math.max(0, invoicedXaf - receivedXaf),
    },
    riskFlags: riskFlags.slice(0, 12),
    recentEvents: eventResult.data ?? [],
  };
}
