import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
import { recordMatterEvent } from "@/lib/matter-events.server";
import { createMatterWorkspaceServer } from "@/lib/matters.server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createProspect,
  runConflictCheck,
  updateConflictDecision,
  updateEngagement,
  updateMatterOpeningChecklist,
  type IntakePartyInput,
} from "@/lib/intake-workflow";

function requireFirm(scope: Awaited<ReturnType<typeof resolveRequestScope>>) {
  if (!scope.firmId) throw new Error("Complete firm onboarding before using intake.");
  return scope.firmId;
}
function requireActorLawyer(scope: Awaited<ReturnType<typeof resolveRequestScope>>) {
  if (!scope.actorLawyerId) throw new Error("Your account must be linked to a lawyer profile before approving legal workflow steps.");
  return scope.actorLawyerId;
}
function parseMatches(value: unknown) {
  if (!value || typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const supabase = createServerSupabaseClient();
    const firmId = requireFirm(scope);
    if (!supabase) throw new Error("Supabase server configuration is required for intake.");

    const [prospectResult, lawyerResult, partyResult, parameterResult] = await Promise.all([
      supabase.from("prospects").select(
        "id,prospect_name,contact_name,contact_email,contact_phone,source,matter_summary,proposed_matter_type,jurisdiction,status,risk_level,responsible_lawyer_id,conflict_status,engagement_status,primary_party_id,matter_id,created_at,updated_at,conflict_checks(*),engagements(*),matter_opening_checklists(*),prospect_parties(*),intake_decision_events(*),prospect_kyc_reviews(id,status,risk_rating,reviewed_at,created_at)"
      ).eq("firm_id", firmId).order("created_at", { ascending: false }),
      supabase.from("lawyers").select("id,full_name,role").eq("firm_id", firmId).order("full_name"),
      supabase.from("parties").select("id,display_name,phone,email,client_status,preferred_language").eq("firm_id", firmId).order("display_name").limit(250),
      supabase.from("firm_legal_parameters").select("id,parameter_type,parameter_key,label_en,label_fr,active").eq("firm_id", firmId).eq("active", true).in("parameter_type", ["matter_type","jurisdiction","fee_model","risk_level"]).order("sort_order"),
    ]);
    if (prospectResult.error) throw new Error(prospectResult.error.message);
    if (lawyerResult.error) throw new Error(lawyerResult.error.message);
    if (partyResult.error) throw new Error(partyResult.error.message);
    if (parameterResult.error) throw new Error(parameterResult.error.message);

    const prospects = (prospectResult.data ?? []).map((prospect: any) => ({
      id: prospect.id,
      name: prospect.prospect_name,
      email: prospect.contact_email,
      phone: prospect.contact_phone,
      source: prospect.source,
      matter_type: prospect.proposed_matter_type,
      jurisdiction: prospect.jurisdiction,
      summary: prospect.matter_summary,
      status: prospect.status,
      risk_level: prospect.risk_level,
      responsible_lawyer_id: prospect.responsible_lawyer_id,
      primary_party_id: prospect.primary_party_id,
      matter_id: prospect.matter_id,
      created_at: prospect.created_at,
      conflict_checks: (prospect.conflict_checks ?? []).map((row: any) => ({ ...row, matches: parseMatches(row.match_summary), decision_note: row.decision_reason })),
      engagements: (prospect.engagements ?? []).map((row: any) => ({ ...row, status: row.approval_status, fee_arrangement: row.fee_model, decision_note: null })),
      matter_opening_checklists: (prospect.matter_opening_checklists ?? []).map((row: any) => ({
        ...row,
        kyc_complete: Boolean(row.kyc_complete),
        document_structure_created: Boolean(row.opening_documents_ready),
        initial_deadline_note: row.initial_deadline_notes,
        document_structure_note: row.opening_document_notes,
        opening_notes: row.opening_document_notes,
        completed_at: row.status === "Completed" ? row.updated_at : null,
      })),
      prospect_parties: (prospect.prospect_parties ?? []).map((row: any) => ({ ...row, name: row.party_name })),
      intake_decision_events: (prospect.intake_decision_events ?? []).map((row: any) => ({ ...row, summary: row.metadata?.summary ?? row.event_type.replaceAll("_", " "), detail: row.notes })),
      kyc_reviews: prospect.prospect_kyc_reviews ?? [],
    }));
    return NextResponse.json({ success: true, prospects, lawyers: lawyerResult.data ?? [], contacts: partyResult.data ?? [], parameters: parameterResult.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load intake." }, { status: statusForApiError(error) });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const body = await request.json();
    const action = String(body.action ?? "");
    const firmId = requireFirm(scope);

    if (action === "createProspect") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      const name = String(body.name ?? "").trim();
      const summary = String(body.summary ?? "").trim();
      if (!name || !summary) return NextResponse.json({ success: false, error: "Person/client name and legal issue summary are required." }, { status: 400 });
      const result = await createProspect({
        firmId,
        actorLawyerId: scope.actorLawyerId,
        primaryPartyId: body.primaryPartyId ? String(body.primaryPartyId) : null,
        name,
        email: String(body.email ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        matterType: String(body.matterType ?? "General legal matter").trim(),
        jurisdiction: String(body.jurisdiction ?? "Cameroon").trim(),
        summary,
        parties: Array.isArray(body.parties) ? body.parties as IntakePartyInput[] : [],
      });
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    const prospectId = String(body.prospectId ?? "").trim();
    if (!prospectId) return NextResponse.json({ success: false, error: "Assessment ID is required." }, { status: 400 });

    if (action === "runConflictCheck") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      return NextResponse.json({ success: true, conflictCheck: await runConflictCheck(firmId, prospectId, scope.actorLawyerId) });
    }
    if (action === "decideConflict") {
      await assertFirmPermission({ scope, permission: "approveFilings" });
      const status = body.status === "Waived" ? "Waived" : "Cleared";
      return NextResponse.json({ success: true, conflictCheck: await updateConflictDecision({ firmId, prospectId, actorLawyerId: requireActorLawyer(scope), status, decisionNote: String(body.decisionNote ?? "").trim() }) });
    }
    if (action === "saveEngagement") {
      await assertFirmPermission({ scope, permission: body.approve ? "approveFilings" : "openMatters" });
      const scopeOfWork = String(body.scopeOfWork ?? "").trim();
      const feeArrangement = String(body.feeArrangement ?? "").trim();
      if (body.approve && (!scopeOfWork || !feeArrangement)) return NextResponse.json({ success: false, error: "Scope of work and fee model are required before engagement approval." }, { status: 400 });
      return NextResponse.json({ success: true, engagement: await updateEngagement({ firmId, prospectId, actorLawyerId: body.approve ? requireActorLawyer(scope) : scope.actorLawyerId ?? "", scopeOfWork, feeArrangement, approve: Boolean(body.approve), decisionNote: String(body.decisionNote ?? "").trim() }) });
    }
    if (action === "updateChecklist") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      return NextResponse.json({ success: true, checklist: await updateMatterOpeningChecklist({
        firmId,
        prospectId,
        actorLawyerId: scope.actorLawyerId,
        kycComplete: typeof body.kycComplete === "boolean" ? body.kycComplete : undefined,
        responsibleLawyerAssigned: typeof body.responsibleLawyerAssigned === "boolean" ? body.responsibleLawyerAssigned : undefined,
        responsibleLawyerId: body.responsibleLawyerId === null || typeof body.responsibleLawyerId === "string" ? body.responsibleLawyerId : undefined,
        initialDeadlineReviewed: typeof body.initialDeadlineReviewed === "boolean" ? body.initialDeadlineReviewed : undefined,
        initialDeadlineNote: typeof body.initialDeadlineNote === "string" ? body.initialDeadlineNote : undefined,
        documentStructureCreated: typeof body.documentStructureCreated === "boolean" ? body.documentStructureCreated : undefined,
        documentStructureNote: typeof body.documentStructureNote === "string" ? body.documentStructureNote : undefined,
        openingNotes: typeof body.openingNotes === "string" ? body.openingNotes : undefined,
      }) });
    }
    if (action === "openMatter") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      const supabase = createServerSupabaseClient();
      if (!supabase) throw new Error("Supabase server configuration is required for matter opening.");
      const [prospectResult, checklistResult, conflictResult, engagementResult, kycResult] = await Promise.all([
        supabase.from("prospects").select("*").eq("id", prospectId).eq("firm_id", firmId).single(),
        supabase.from("matter_opening_checklists").select("*").eq("prospect_id", prospectId).eq("firm_id", firmId).single(),
        supabase.from("conflict_checks").select("status,decision_reason").eq("prospect_id", prospectId).eq("firm_id", firmId).single(),
        supabase.from("engagements").select("approval_status,scope_of_work,fee_model").eq("prospect_id", prospectId).eq("firm_id", firmId).single(),
        supabase.from("prospect_kyc_reviews").select("id,status,risk_rating,reviewed_at").eq("prospect_id", prospectId).eq("firm_id", firmId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (prospectResult.error || !prospectResult.data) throw new Error("Assessment not found.");
      if (checklistResult.error || !checklistResult.data) throw new Error("Matter opening controls are missing.");
      if (conflictResult.data?.status !== "Cleared" && conflictResult.data?.status !== "Waived") throw new Error("Conflict review must be cleared or formally waived before opening the matter.");
      if (kycResult.error) throw new Error(kycResult.error.message);
      if (kycResult.data?.status !== "cleared") throw new Error("KYC/compliance review must be cleared before opening the matter.");
      if (engagementResult.data?.approval_status !== "Approved") throw new Error("Engagement approval is required before opening the matter.");
      if (!checklistResult.data.responsible_lawyer_assigned || !checklistResult.data.responsible_lawyer_id) throw new Error("Assign the responsible lawyer before opening the matter.");
      if (!checklistResult.data.initial_deadline_reviewed) throw new Error("Initial deadline review must be confirmed before opening the matter.");
      if (!checklistResult.data.opening_documents_ready) throw new Error("Opening document structure must be confirmed before opening the matter.");
      if (prospectResult.data.matter_id) return NextResponse.json({ success: true, matterId: prospectResult.data.matter_id }, { status: 200 });

      const matter = await createMatterWorkspaceServer({
        title: `${prospectResult.data.prospect_name} - ${prospectResult.data.proposed_matter_type || "Legal matter"}`,
        clientName: prospectResult.data.prospect_name,
        matterType: prospectResult.data.proposed_matter_type || "General legal matter",
        jurisdiction: prospectResult.data.jurisdiction || "Cameroon",
        riskLevel: conflictResult.data?.status === "Waived" || kycResult.data.risk_rating === "high" ? "High" : prospectResult.data.risk_level || "Medium",
        status: "Active",
        synopsis: prospectResult.data.matter_summary || "Matter opened from assessment.",
        primaryTrack: "Matter opening and first working plan",
        riskToMonitor: checklistResult.data.initial_deadline_notes?.trim() || "Initial deadline review completed; continue procedural monitoring.",
        aiUsageRule: "AI suggestions require human review and matter confidentiality policy applies.",
        nextDraft: "Opening memorandum",
        leadLawyerId: checklistResult.data.responsible_lawyer_id,
      }, scope);
      if (!matter) throw new Error("Unable to create matter.");
      const now = new Date().toISOString();

      const writes = await Promise.all([
        supabase.from("prospects").update({ status: "Converted", matter_id: matter.id, updated_at: now }).eq("id", prospectId).eq("firm_id", firmId),
        supabase.from("matter_opening_checklists").update({ kyc_complete: true, status: "Completed", matter_id: matter.id, updated_at: now }).eq("prospect_id", prospectId).eq("firm_id", firmId),
        supabase.from("tasks").insert({ matter_id: matter.id, title: "Opening review and first action plan", description: checklistResult.data.initial_deadline_notes?.trim() || "Confirm chronology, deadlines, immediate responsibilities and next client update.", deadline: null, assigned_to: checklistResult.data.responsible_lawyer_id, status: "Open", is_completed: false }),
        supabase.from("documents").insert({ matter_id: matter.id, uploaded_by: scope.actorLawyerId, title: "Matter Opening Memorandum", document_type: "Opening memorandum", status: "Draft", review_status: "Working", access_level: "Lead+Partner", sharing_policy: "Internal only", version_label: "v1", source_kind: "Generated from intake", ai_summary: prospectResult.data.matter_summary || "Opening memorandum record created from approved assessment.", requires_compliance_audit: true }),
        prospectResult.data.primary_party_id ? supabase.from("parties").update({ client_status: "client", updated_by: scope.actorLawyerId, updated_at: now }).eq("id", prospectResult.data.primary_party_id).eq("firm_id", firmId) : Promise.resolve({ error: null }),
        prospectResult.data.primary_party_id ? supabase.from("matter_parties").upsert({ firm_id: firmId, matter_id: matter.id, party_id: prospectResult.data.primary_party_id, relationship_type: "client", relationship_detail: "Primary client from intake", is_primary: true }, { onConflict: "matter_id,party_id,relationship_type" }) : Promise.resolve({ error: null }),
        supabase.from("intake_decision_events").insert({ firm_id: firmId, prospect_id: prospectId, matter_id: matter.id, actor_id: scope.actorLawyerId, event_type: "matter_opened", status: "completed", notes: "Matter opened after conflict, KYC and engagement gates were satisfied.", metadata: { matter_id: matter.id } }),
      ]);
      for (const result of writes) if ((result as any)?.error) throw new Error((result as any).error.message);

      await recordMatterEvent({ firmId, matterId: matter.id, eventType: "MATTER_OPENED", title: "Matter opened from governed intake", details: "Conflict, KYC, engagement, responsible lawyer, deadline review and document readiness gates were satisfied.", actorName: scope.actorName || "Firm user", actorRole: scope.actorRole || "firm_member" });
      return NextResponse.json({ success: true, matterId: matter.id }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: "Unsupported intake action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to process intake." }, { status: statusForApiError(error) });
  }
}
