import { createServerSupabaseClient } from "@/lib/supabase-server";

export type IntakePartyInput = {
  name: string;
  partyRole:
    | "Prospective client"
    | "Opposing party"
    | "Related party"
    | "Witness"
    | "Director"
    | "Beneficial owner"
    | "Other";
};

type IntakeEventType =
  | "prospect_created"
  | "conflict_scan_completed"
  | "conflict_decided"
  | "engagement_updated"
  | "engagement_approved"
  | "checklist_updated"
  | "matter_opened";

export function normalizePartyName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9À-ÿ]+/gi, " ").replace(/\s+/g, " ");
}

function requireSupabase() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase server configuration is required for the intake workflow.");
  }
  return supabase;
}

async function recordIntakeEvent(input: {
  firmId: string;
  prospectId: string;
  actorLawyerId?: string | null;
  eventType: IntakeEventType;
  summary: string;
  detail?: string | null;
}) {
  const supabase = requireSupabase();
  const eventResult = await supabase.from("intake_decision_events").insert({
    firm_id: input.firmId,
    prospect_id: input.prospectId,
    actor_id: input.actorLawyerId ?? null,
    event_type: input.eventType,
    summary: input.summary,
    detail: input.detail ?? null,
  });

  if (eventResult.error) {
    throw new Error(eventResult.error.message);
  }
}

export async function createProspect(input: {
  firmId: string;
  actorLawyerId: string | null;
  name: string;
  email?: string;
  phone?: string;
  matterType: string;
  jurisdiction: string;
  summary: string;
  parties: IntakePartyInput[];
}) {
  const supabase = requireSupabase();
  const prospectResult = await supabase
    .from("prospects")
    .insert({
      firm_id: input.firmId,
      created_by: input.actorLawyerId,
      name: input.name,
      normalized_name: normalizePartyName(input.name),
      email: input.email || null,
      phone: input.phone || null,
      matter_type: input.matterType,
      jurisdiction: input.jurisdiction,
      summary: input.summary,
    })
    .select("id,name,status")
    .single();

  if (prospectResult.error || !prospectResult.data) {
    throw new Error(prospectResult.error?.message ?? "Unable to create prospect.");
  }

  const parties = [
    {
      name: input.name,
      normalized_name: normalizePartyName(input.name),
      party_role: "Prospective client",
    },
    ...input.parties
      .filter((party) => party.name.trim())
      .map((party) => ({
        name: party.name.trim(),
        normalized_name: normalizePartyName(party.name),
        party_role: party.partyRole,
      })),
  ];

  const partiesResult = await supabase
    .from("prospect_parties")
    .insert(parties.map((party) => ({ prospect_id: prospectResult.data.id, ...party })));

  if (partiesResult.error) {
    throw new Error(partiesResult.error.message);
  }

  const [conflictResult, engagementResult, checklistResult] = await Promise.all([
    supabase
      .from("conflict_checks")
      .insert({ firm_id: input.firmId, prospect_id: prospectResult.data.id })
      .select("id,status,matches")
      .single(),
    supabase
      .from("engagements")
      .insert({
        firm_id: input.firmId,
        prospect_id: prospectResult.data.id,
        scope_of_work: input.summary,
        fee_arrangement: "To be agreed",
      })
      .select("id,status")
      .single(),
    supabase
      .from("matter_opening_checklists")
      .insert({
        firm_id: input.firmId,
        prospect_id: prospectResult.data.id,
        identity_complete: Boolean(input.email || input.phone),
      })
      .select("*")
      .single(),
  ]);

  for (const result of [conflictResult, engagementResult, checklistResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  await recordIntakeEvent({
    firmId: input.firmId,
    prospectId: prospectResult.data.id,
    actorLawyerId: input.actorLawyerId,
    eventType: "prospect_created",
    summary: `Prospect ${input.name} was recorded for ${input.matterType}.`,
    detail: input.summary,
  });

  return {
    prospect: prospectResult.data,
    conflictCheck: conflictResult.data,
    engagement: engagementResult.data,
    checklist: checklistResult.data,
  };
}

export async function runConflictCheck(firmId: string, prospectId: string, actorLawyerId?: string | null) {
  const supabase = requireSupabase();
  const prospectResult = await supabase
    .from("prospects")
    .select("id,name,normalized_name")
    .eq("id", prospectId)
    .eq("firm_id", firmId)
    .single();

  if (prospectResult.error || !prospectResult.data) {
    throw new Error("Prospect not found.");
  }

  const partiesResult = await supabase
    .from("prospect_parties")
    .select("name,normalized_name,party_role")
    .eq("prospect_id", prospectId);

  if (partiesResult.error) {
    throw new Error(partiesResult.error.message);
  }

  const names = Array.from(new Set((partiesResult.data ?? []).map((party) => party.normalized_name).filter(Boolean)));
  const matches: Array<{ source: string; id: string; name: string; detail: string }> = [];

  const mattersResult = await supabase
    .from("matters")
    .select("id,title,client_name,status")
    .eq("firm_id", firmId);

  if (mattersResult.error) {
    throw new Error(mattersResult.error.message);
  }

  for (const matter of mattersResult.data ?? []) {
    if (names.includes(normalizePartyName(matter.client_name))) {
      matches.push({
        source: "matter",
        id: matter.id,
        name: matter.client_name,
        detail: `${matter.title} (${matter.status ?? "unknown status"})`,
      });
    }
  }

  const otherProspects = await supabase
    .from("prospects")
    .select("id,name,status")
    .eq("firm_id", firmId)
    .neq("id", prospectId);

  if (otherProspects.error) {
    throw new Error(otherProspects.error.message);
  }

  for (const prospect of otherProspects.data ?? []) {
    if (names.includes(normalizePartyName(prospect.name))) {
      matches.push({
        source: "prospect",
        id: prospect.id,
        name: prospect.name,
        detail: prospect.status,
      });
    }
  }

  const status = matches.length ? "Potential conflict" : "Pending";
  const conflictResult = await supabase
    .from("conflict_checks")
    .update({ status, matches })
    .eq("prospect_id", prospectId)
    .eq("firm_id", firmId)
    .select("*")
    .single();

  if (conflictResult.error || !conflictResult.data) {
    throw new Error(conflictResult.error?.message ?? "Unable to save conflict review.");
  }

  await recordIntakeEvent({
    firmId,
    prospectId,
    actorLawyerId,
    eventType: "conflict_scan_completed",
    summary: matches.length
      ? `Conflict scan found ${matches.length} potential match${matches.length === 1 ? "" : "es"}.`
      : "Conflict scan completed with no direct match.",
    detail: matches.length
      ? matches.map((match) => `${match.source}: ${match.name} - ${match.detail}`).join("\n")
      : null,
  });

  return conflictResult.data;
}

export async function updateConflictDecision(input: {
  firmId: string;
  prospectId: string;
  actorLawyerId: string;
  status: "Cleared" | "Waived";
  decisionNote: string;
}) {
  const supabase = requireSupabase();
  const conflictResult = await supabase
    .from("conflict_checks")
    .update({
      status: input.status,
      reviewed_by: input.actorLawyerId,
      reviewed_at: new Date().toISOString(),
      decision_note: input.decisionNote,
    })
    .eq("prospect_id", input.prospectId)
    .eq("firm_id", input.firmId)
    .select("*")
    .single();

  if (conflictResult.error || !conflictResult.data) {
    throw new Error(conflictResult.error?.message ?? "Unable to save conflict decision.");
  }

  await supabase
    .from("prospects")
    .update({ status: "Engagement" })
    .eq("id", input.prospectId)
    .eq("firm_id", input.firmId);

  await supabase
    .from("matter_opening_checklists")
    .update({ conflict_cleared: true })
    .eq("prospect_id", input.prospectId)
    .eq("firm_id", input.firmId);

  await recordIntakeEvent({
    firmId: input.firmId,
    prospectId: input.prospectId,
    actorLawyerId: input.actorLawyerId,
    eventType: "conflict_decided",
    summary: `Conflict review marked as ${input.status}.`,
    detail: input.decisionNote || null,
  });

  return conflictResult.data;
}

export async function updateEngagement(input: {
  firmId: string;
  prospectId: string;
  actorLawyerId: string;
  scopeOfWork: string;
  feeArrangement: string;
  approve: boolean;
  decisionNote: string;
}) {
  const supabase = requireSupabase();
  const status = input.approve ? "Approved" : "Approval required";
  const engagementResult = await supabase
    .from("engagements")
    .update({
      status,
      scope_of_work: input.scopeOfWork,
      fee_arrangement: input.feeArrangement,
      approved_by: input.approve ? input.actorLawyerId : null,
      approved_at: input.approve ? new Date().toISOString() : null,
      decision_note: input.decisionNote,
    })
    .eq("prospect_id", input.prospectId)
    .eq("firm_id", input.firmId)
    .select("*")
    .single();

  if (engagementResult.error || !engagementResult.data) {
    throw new Error(engagementResult.error?.message ?? "Unable to save engagement decision.");
  }

  if (input.approve) {
    await supabase
      .from("prospects")
      .update({ status: "Ready to open" })
      .eq("id", input.prospectId)
      .eq("firm_id", input.firmId);

    await supabase
      .from("matter_opening_checklists")
      .update({ engagement_approved: true })
      .eq("prospect_id", input.prospectId)
      .eq("firm_id", input.firmId);
  }

  await recordIntakeEvent({
    firmId: input.firmId,
    prospectId: input.prospectId,
    actorLawyerId: input.actorLawyerId,
    eventType: input.approve ? "engagement_approved" : "engagement_updated",
    summary: input.approve ? "Engagement approved for matter opening." : "Engagement terms updated for review.",
    detail: [input.scopeOfWork, input.feeArrangement, input.decisionNote].filter(Boolean).join("\n"),
  });

  return engagementResult.data;
}

export async function updateMatterOpeningChecklist(input: {
  firmId: string;
  prospectId: string;
  actorLawyerId?: string | null;
  identityComplete?: boolean;
  responsibleLawyerAssigned?: boolean;
  responsibleLawyerId?: string | null;
  initialDeadlineReviewed?: boolean;
  initialDeadlineNote?: string | null;
  documentStructureCreated?: boolean;
  documentStructureNote?: string | null;
  openingNotes?: string | null;
}) {
  const supabase = requireSupabase();
  const payload: Record<string, boolean | string | null> = {};

  if (typeof input.identityComplete === "boolean") {
    payload.identity_complete = input.identityComplete;
  }

  if (typeof input.responsibleLawyerAssigned === "boolean") {
    payload.responsible_lawyer_assigned = input.responsibleLawyerAssigned;
  }

  if (typeof input.initialDeadlineReviewed === "boolean") {
    payload.initial_deadline_reviewed = input.initialDeadlineReviewed;
  }

  if (typeof input.documentStructureCreated === "boolean") {
    payload.document_structure_created = input.documentStructureCreated;
  }

  if (input.responsibleLawyerId !== undefined) {
    payload.responsible_lawyer_id = input.responsibleLawyerId || null;
    payload.responsible_lawyer_assigned = Boolean(input.responsibleLawyerId);
  }

  if (input.initialDeadlineNote !== undefined) {
    payload.initial_deadline_note = input.initialDeadlineNote?.trim() || null;
  }

  if (input.documentStructureNote !== undefined) {
    payload.document_structure_note = input.documentStructureNote?.trim() || null;
  }

  if (input.openingNotes !== undefined) {
    payload.opening_notes = input.openingNotes?.trim() || null;
  }

  if (!Object.keys(payload).length) {
    throw new Error("At least one checklist control must be provided.");
  }

  const checklistResult = await supabase
    .from("matter_opening_checklists")
    .update(payload)
    .eq("prospect_id", input.prospectId)
    .eq("firm_id", input.firmId)
    .select("*")
    .single();

  if (checklistResult.error || !checklistResult.data) {
    throw new Error(checklistResult.error?.message ?? "Unable to update the matter opening checklist.");
  }

  const changeSummary = [
    payload.identity_complete !== undefined ? `identity=${payload.identity_complete}` : null,
    payload.responsible_lawyer_assigned !== undefined
      ? `responsible_lawyer_assigned=${payload.responsible_lawyer_assigned}`
      : null,
    payload.responsible_lawyer_id ? `responsible_lawyer_id=${payload.responsible_lawyer_id}` : null,
    payload.initial_deadline_reviewed !== undefined
      ? `deadline_reviewed=${payload.initial_deadline_reviewed}`
      : null,
    payload.document_structure_created !== undefined
      ? `document_structure_created=${payload.document_structure_created}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  await recordIntakeEvent({
    firmId: input.firmId,
    prospectId: input.prospectId,
    actorLawyerId: input.actorLawyerId,
    eventType: "checklist_updated",
    summary: "Matter opening checklist updated.",
    detail: [
      changeSummary,
      payload.initial_deadline_note ? `deadline_note=${payload.initial_deadline_note}` : null,
      payload.document_structure_note ? `document_note=${payload.document_structure_note}` : null,
      payload.opening_notes ? `opening_notes=${payload.opening_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return checklistResult.data;
}
