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
  if (!supabase) throw new Error("Supabase server configuration is required for the intake workflow.");
  return supabase;
}

async function recordIntakeEvent(input: {
  firmId: string;
  prospectId: string;
  actorLawyerId?: string | null;
  eventType: IntakeEventType;
  summary: string;
  detail?: string | null;
  matterId?: string | null;
}) {
  const supabase = requireSupabase();
  const eventResult = await supabase.from("intake_decision_events").insert({
    firm_id: input.firmId,
    prospect_id: input.prospectId,
    matter_id: input.matterId ?? null,
    actor_id: input.actorLawyerId ?? null,
    event_type: input.eventType,
    status: "recorded",
    notes: input.detail || input.summary,
    metadata: { summary: input.summary },
  });
  if (eventResult.error) throw new Error(eventResult.error.message);
}

async function ensurePrimaryParty(input: {
  firmId: string;
  actorLawyerId: string | null;
  primaryPartyId?: string | null;
  name: string;
  email?: string;
  phone?: string;
}) {
  const supabase = requireSupabase();
  if (input.primaryPartyId) {
    const existing = await supabase.from("parties").select("id,display_name,phone,email").eq("id", input.primaryPartyId).eq("firm_id", input.firmId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Selected contact does not belong to the active firm.");
    await supabase.from("parties").update({
      client_status: "prospective_client",
      phone: input.phone || existing.data.phone,
      email: input.email || existing.data.email,
      updated_by: input.actorLawyerId,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.data.id);
    return existing.data.id;
  }

  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  if (phone) {
    const found = await supabase.from("parties").select("id").eq("firm_id", input.firmId).eq("phone", phone).maybeSingle();
    if (found.error) throw new Error(found.error.message);
    if (found.data) return found.data.id;
  }
  if (email) {
    const found = await supabase.from("parties").select("id").eq("firm_id", input.firmId).eq("email", email).limit(1).maybeSingle();
    if (found.error) throw new Error(found.error.message);
    if (found.data) return found.data.id;
  }

  const created = await supabase.from("parties").insert({
    firm_id: input.firmId,
    party_type: "individual",
    display_name: input.name.trim(),
    phone,
    email,
    client_status: "prospective_client",
    created_by: input.actorLawyerId,
    updated_by: input.actorLawyerId,
  }).select("id").single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

export async function createProspect(input: {
  firmId: string;
  actorLawyerId: string | null;
  primaryPartyId?: string | null;
  name: string;
  email?: string;
  phone?: string;
  matterType: string;
  jurisdiction: string;
  summary: string;
  parties: IntakePartyInput[];
}) {
  const supabase = requireSupabase();
  const primaryPartyId = await ensurePrimaryParty(input);
  const prospectResult = await supabase.from("prospects").insert({
    firm_id: input.firmId,
    primary_party_id: primaryPartyId,
    created_by: input.actorLawyerId,
    prospect_name: input.name.trim(),
    contact_name: input.name.trim(),
    contact_email: input.email?.trim().toLowerCase() || null,
    contact_phone: input.phone?.trim() || null,
    source: "Direct / interaction capture",
    matter_summary: input.summary,
    proposed_matter_type: input.matterType,
    jurisdiction: input.jurisdiction,
    status: "Assessment",
    risk_level: "Medium",
    conflict_status: "Not checked",
    engagement_status: "Not prepared",
  }).select("id,prospect_name,status,primary_party_id").single();
  if (prospectResult.error || !prospectResult.data) throw new Error(prospectResult.error?.message ?? "Unable to create assessment.");

  const partyRows = [
    { party_name: input.name.trim(), party_role: "Prospective client", relationship_notes: "Primary contact" },
    ...input.parties.filter((party) => party.name.trim()).map((party) => ({
      party_name: party.name.trim(), party_role: party.partyRole, relationship_notes: null,
    })),
  ];
  const partiesResult = await supabase.from("prospect_parties").insert(partyRows.map((row) => ({ prospect_id: prospectResult.data.id, ...row })));
  if (partiesResult.error) throw new Error(partiesResult.error.message);

  const [conflictResult, engagementResult, checklistResult] = await Promise.all([
    supabase.from("conflict_checks").insert({ firm_id: input.firmId, prospect_id: prospectResult.data.id, status: "Pending review" }).select("id,status,match_summary").single(),
    supabase.from("engagements").insert({ firm_id: input.firmId, prospect_id: prospectResult.data.id, scope_of_work: input.summary, fee_model: "To define", engagement_letter_status: "Draft", approval_status: "Pending approval" }).select("id,approval_status,scope_of_work,fee_model").single(),
    supabase.from("matter_opening_checklists").insert({ firm_id: input.firmId, prospect_id: prospectResult.data.id, status: "Open" }).select("*").single(),
  ]);
  for (const result of [conflictResult, engagementResult, checklistResult]) if (result.error) throw new Error(result.error.message);

  await recordIntakeEvent({ firmId: input.firmId, prospectId: prospectResult.data.id, actorLawyerId: input.actorLawyerId, eventType: "prospect_created", summary: `${input.name} assessment recorded for ${input.matterType}.`, detail: input.summary });
  return { prospect: prospectResult.data, conflictCheck: conflictResult.data, engagement: engagementResult.data, checklist: checklistResult.data };
}

export async function runConflictCheck(firmId: string, prospectId: string, actorLawyerId?: string | null) {
  const supabase = requireSupabase();
  const prospectResult = await supabase.from("prospects").select("id,prospect_name").eq("id", prospectId).eq("firm_id", firmId).single();
  if (prospectResult.error || !prospectResult.data) throw new Error("Assessment not found.");
  const partiesResult = await supabase.from("prospect_parties").select("party_name,party_role").eq("prospect_id", prospectId);
  if (partiesResult.error) throw new Error(partiesResult.error.message);
  const names = Array.from(new Set((partiesResult.data ?? []).map((party) => normalizePartyName(party.party_name)).filter(Boolean)));
  const matches: Array<{source:string;id:string;name:string;detail:string}> = [];

  const [mattersResult, partiesRegistry, otherProspects] = await Promise.all([
    supabase.from("matters").select("id,title,client_name,status").eq("firm_id", firmId),
    supabase.from("parties").select("id,display_name,client_status").eq("firm_id", firmId),
    supabase.from("prospects").select("id,prospect_name,status").eq("firm_id", firmId).neq("id", prospectId),
  ]);
  if (mattersResult.error) throw new Error(mattersResult.error.message);
  if (partiesRegistry.error) throw new Error(partiesRegistry.error.message);
  if (otherProspects.error) throw new Error(otherProspects.error.message);

  for (const matter of mattersResult.data ?? []) if (names.includes(normalizePartyName(matter.client_name))) matches.push({ source:"matter", id:matter.id, name:matter.client_name, detail:`${matter.title} (${matter.status ?? "unknown status"})` });
  for (const party of partiesRegistry.data ?? []) if (names.includes(normalizePartyName(party.display_name))) matches.push({ source:"party_registry", id:party.id, name:party.display_name, detail:party.client_status });
  for (const prospect of otherProspects.data ?? []) if (names.includes(normalizePartyName(prospect.prospect_name))) matches.push({ source:"assessment", id:prospect.id, name:prospect.prospect_name, detail:prospect.status });

  const deduped = Array.from(new Map(matches.map((match) => [`${match.source}:${match.id}`, match])).values());
  const status = deduped.length ? "Potential conflict" : "No apparent conflict";
  const conflictResult = await supabase.from("conflict_checks").update({
    status,
    checked_by: actorLawyerId ?? null,
    match_summary: JSON.stringify(deduped),
  }).eq("prospect_id", prospectId).eq("firm_id", firmId).select("*").single();
  if (conflictResult.error || !conflictResult.data) throw new Error(conflictResult.error?.message ?? "Unable to save conflict review.");
  await supabase.from("prospects").update({ conflict_status: status, updated_at: new Date().toISOString() }).eq("id", prospectId).eq("firm_id", firmId);
  await recordIntakeEvent({ firmId, prospectId, actorLawyerId, eventType:"conflict_scan_completed", summary:deduped.length?`Conflict scan found ${deduped.length} potential match${deduped.length===1?"":"es"}.`:"Conflict scan found no apparent direct match.", detail:deduped.length?JSON.stringify(deduped):null });
  return { ...conflictResult.data, matches: deduped };
}

export async function updateConflictDecision(input: { firmId:string; prospectId:string; actorLawyerId:string; status:"Cleared"|"Waived"; decisionNote:string; }) {
  const supabase = requireSupabase();
  const conflictResult = await supabase.from("conflict_checks").update({
    status: input.status,
    checked_by: input.actorLawyerId,
    decision_reason: input.decisionNote || null,
    waiver_required: input.status === "Waived",
    decided_at: new Date().toISOString(),
  }).eq("prospect_id", input.prospectId).eq("firm_id", input.firmId).select("*").single();
  if (conflictResult.error || !conflictResult.data) throw new Error(conflictResult.error?.message ?? "Unable to save conflict decision.");
  await Promise.all([
    supabase.from("prospects").update({ conflict_status: input.status, status:"Compliance & terms", updated_at:new Date().toISOString() }).eq("id", input.prospectId).eq("firm_id", input.firmId),
    supabase.from("matter_opening_checklists").update({ conflict_cleared:true, updated_at:new Date().toISOString() }).eq("prospect_id", input.prospectId).eq("firm_id", input.firmId),
  ]);
  await recordIntakeEvent({ firmId:input.firmId, prospectId:input.prospectId, actorLawyerId:input.actorLawyerId, eventType:"conflict_decided", summary:`Conflict review marked ${input.status}.`, detail:input.decisionNote||null });
  return conflictResult.data;
}

export async function updateEngagement(input: { firmId:string; prospectId:string; actorLawyerId:string; scopeOfWork:string; feeArrangement:string; approve:boolean; decisionNote:string; }) {
  const supabase = requireSupabase();
  const approvalStatus = input.approve ? "Approved" : "Pending approval";
  const engagementResult = await supabase.from("engagements").update({
    scope_of_work: input.scopeOfWork,
    fee_model: input.feeArrangement || "To define",
    engagement_letter_status: input.approve ? "Approved" : "Draft",
    approval_status: approvalStatus,
    approved_by: input.approve ? input.actorLawyerId : null,
    approved_at: input.approve ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("prospect_id", input.prospectId).eq("firm_id", input.firmId).select("*").single();
  if (engagementResult.error || !engagementResult.data) throw new Error(engagementResult.error?.message ?? "Unable to save engagement decision.");
  await supabase.from("prospects").update({ engagement_status:approvalStatus, status:input.approve?"Ready for opening review":"Compliance & terms", updated_at:new Date().toISOString() }).eq("id", input.prospectId).eq("firm_id", input.firmId);
  if (input.approve) await supabase.from("matter_opening_checklists").update({ engagement_approved:true, updated_at:new Date().toISOString() }).eq("prospect_id", input.prospectId).eq("firm_id", input.firmId);
  await recordIntakeEvent({ firmId:input.firmId, prospectId:input.prospectId, actorLawyerId:input.actorLawyerId, eventType:input.approve?"engagement_approved":"engagement_updated", summary:input.approve?"Engagement approved for opening review.":"Engagement terms updated.", detail:[input.scopeOfWork,input.feeArrangement,input.decisionNote].filter(Boolean).join("\n") });
  return engagementResult.data;
}

export async function updateMatterOpeningChecklist(input: {
  firmId:string; prospectId:string; actorLawyerId?:string|null;
  kycComplete?:boolean; responsibleLawyerAssigned?:boolean; responsibleLawyerId?:string|null;
  initialDeadlineReviewed?:boolean; initialDeadlineNote?:string|null;
  documentStructureCreated?:boolean; documentStructureNote?:string|null; openingNotes?:string|null;
}) {
  const supabase = requireSupabase();
  const payload:Record<string,boolean|string|null>={};
  if(typeof input.kycComplete==="boolean") payload.kyc_complete=input.kycComplete;
  if(typeof input.responsibleLawyerAssigned==="boolean") payload.responsible_lawyer_assigned=input.responsibleLawyerAssigned;
  if(typeof input.initialDeadlineReviewed==="boolean") payload.initial_deadline_reviewed=input.initialDeadlineReviewed;
  if(typeof input.documentStructureCreated==="boolean") payload.opening_documents_ready=input.documentStructureCreated;
  if(input.responsibleLawyerId!==undefined){payload.responsible_lawyer_id=input.responsibleLawyerId||null;payload.responsible_lawyer_assigned=Boolean(input.responsibleLawyerId)}
  if(input.initialDeadlineNote!==undefined) payload.initial_deadline_notes=input.initialDeadlineNote?.trim()||null;
  if(input.documentStructureNote!==undefined) payload.opening_document_notes=input.documentStructureNote?.trim()||null;
  if(input.openingNotes!==undefined) payload.opening_document_notes=[payload.opening_document_notes,input.openingNotes?.trim()].filter(Boolean).join("\n\n")||null;
  if(!Object.keys(payload).length) throw new Error("At least one opening control must be provided.");
  payload.updated_at=new Date().toISOString();
  const checklistResult=await supabase.from("matter_opening_checklists").update(payload).eq("prospect_id",input.prospectId).eq("firm_id",input.firmId).select("*").single();
  if(checklistResult.error||!checklistResult.data)throw new Error(checklistResult.error?.message??"Unable to update opening controls.");
  await recordIntakeEvent({firmId:input.firmId,prospectId:input.prospectId,actorLawyerId:input.actorLawyerId,eventType:"checklist_updated",summary:"Matter opening controls updated.",detail:JSON.stringify(payload)});
  return checklistResult.data;
}
