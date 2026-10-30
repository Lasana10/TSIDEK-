import { NextResponse } from "next/server";
import { assertFirmModule, assertFirmPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
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
function intakeErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/Active firm authority/i.test(message)) return 403;
  if (/Conflict review|KYC\/compliance review|Engagement approval|opening controls|responsible lawyer|deadline review|opening file structure/i.test(message)) return 409;
  return statusForApiError(error);
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmModule({ scope, module: "intake" });

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
    await assertFirmModule({ scope, module: "intake" });

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
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(prospectId))
        return NextResponse.json({ success: false, error: "A valid assessment ID is required." }, { status: 400 });
      const actorId = requireActorLawyer(scope);
      const supabase = createServerSupabaseClient();
      if (!supabase) throw new Error("Supabase server configuration is required for matter opening.");
      const result = await supabase.rpc("tsidek_open_matter_from_intake", {
        p_firm_id: firmId, p_prospect_id: prospectId, p_actor_id: actorId,
      });
      if (result.error) throw new Error(result.error.message);
      const opening = result.data as { matterId: string; created: boolean } | null;
      if (!opening?.matterId) throw new Error("Matter opening did not return a case reference.");
      return NextResponse.json({ success: true, matterId: opening.matterId }, { status: opening.created ? 201 : 200 });
    }

    return NextResponse.json({ success: false, error: "Unsupported intake action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to process intake." }, { status: intakeErrorStatus(error) });
  }
}
