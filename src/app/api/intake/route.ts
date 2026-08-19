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

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const supabase = createServerSupabaseClient();
    const firmId = requireFirm(scope);
    if (!supabase) throw new Error("Supabase server configuration is required for intake.");
    const [prospectResult, lawyerResult] = await Promise.all([
      supabase
        .from("prospects")
        .select(
          "id,name,email,phone,matter_type,jurisdiction,summary,status,matter_id,created_at,conflict_checks(*),engagements(*),matter_opening_checklists(*),prospect_parties(*),intake_decision_events(*)"
        )
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false }),
      supabase
        .from("lawyers")
        .select("id,full_name,role")
        .eq("firm_id", firmId)
        .order("full_name", { ascending: true }),
    ]);
    if (prospectResult.error) throw new Error(prospectResult.error.message);
    if (lawyerResult.error) throw new Error(lawyerResult.error.message);
    return NextResponse.json({ success: true, prospects: prospectResult.data ?? [], lawyers: lawyerResult.data ?? [] });
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
      if (!name || !summary) return NextResponse.json({ success: false, error: "Prospective client name and issue summary are required." }, { status: 400 });
      const result = await createProspect({ firmId, actorLawyerId: scope.actorLawyerId, name, email: String(body.email ?? "").trim(), phone: String(body.phone ?? "").trim(), matterType: String(body.matterType ?? "General legal matter").trim(), jurisdiction: String(body.jurisdiction ?? "OHADA").trim(), summary, parties: Array.isArray(body.parties) ? body.parties as IntakePartyInput[] : [] });
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    const prospectId = String(body.prospectId ?? "").trim();
    if (!prospectId) return NextResponse.json({ success: false, error: "Prospect ID is required." }, { status: 400 });
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
      if (body.approve && (!scopeOfWork || !feeArrangement)) return NextResponse.json({ success: false, error: "Scope of work and fee arrangement are required before engagement approval." }, { status: 400 });
      return NextResponse.json({ success: true, engagement: await updateEngagement({ firmId, prospectId, actorLawyerId: body.approve ? requireActorLawyer(scope) : scope.actorLawyerId ?? "", scopeOfWork, feeArrangement, approve: Boolean(body.approve), decisionNote: String(body.decisionNote ?? "").trim() }) });
    }
    if (action === "updateChecklist") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      return NextResponse.json({
        success: true,
        checklist: await updateMatterOpeningChecklist({
          firmId,
          prospectId,
          actorLawyerId: scope.actorLawyerId,
          identityComplete: typeof body.identityComplete === "boolean" ? body.identityComplete : undefined,
          responsibleLawyerAssigned:
            typeof body.responsibleLawyerAssigned === "boolean" ? body.responsibleLawyerAssigned : undefined,
          responsibleLawyerId:
            body.responsibleLawyerId === null || typeof body.responsibleLawyerId === "string"
              ? body.responsibleLawyerId
              : undefined,
          initialDeadlineReviewed:
            typeof body.initialDeadlineReviewed === "boolean" ? body.initialDeadlineReviewed : undefined,
          initialDeadlineNote:
            typeof body.initialDeadlineNote === "string" ? body.initialDeadlineNote : undefined,
          documentStructureCreated:
            typeof body.documentStructureCreated === "boolean" ? body.documentStructureCreated : undefined,
          documentStructureNote:
            typeof body.documentStructureNote === "string" ? body.documentStructureNote : undefined,
          openingNotes: typeof body.openingNotes === "string" ? body.openingNotes : undefined,
        }),
      });
    }
    if (action === "openMatter") {
      await assertFirmPermission({ scope, permission: "openMatters" });
      const supabase = createServerSupabaseClient();
      if (!supabase) throw new Error("Supabase server configuration is required for matter opening.");
      const prospectResult = await supabase.from("prospects").select("*").eq("id", prospectId).eq("firm_id", firmId).single();
      const checklistResult = await supabase.from("matter_opening_checklists").select("*").eq("prospect_id", prospectId).eq("firm_id", firmId).single();
      const conflictResult = await supabase.from("conflict_checks").select("status,decision_note").eq("prospect_id", prospectId).eq("firm_id", firmId).single();
      const engagementResult = await supabase.from("engagements").select("status,scope_of_work,fee_arrangement,decision_note").eq("prospect_id", prospectId).eq("firm_id", firmId).single();
      if (prospectResult.error || !prospectResult.data) throw new Error("Prospect not found.");
      if (checklistResult.error || !checklistResult.data) throw new Error("Matter opening checklist is missing.");
      if (conflictResult.data?.status !== "Cleared" && conflictResult.data?.status !== "Waived") throw new Error("Conflict review must be cleared or waived before opening the matter.");
      if (engagementResult.data?.status !== "Approved") throw new Error("Engagement approval is required before opening the matter.");
      if (!checklistResult.data.identity_complete) throw new Error("Complete at least one client contact method before opening the matter.");
      if (!checklistResult.data.responsible_lawyer_assigned) throw new Error("Assign the responsible lawyer before opening the matter.");
      if (!checklistResult.data.responsible_lawyer_id) throw new Error("A responsible lawyer must be selected before opening the matter.");
      if (!checklistResult.data.initial_deadline_reviewed) throw new Error("Initial deadline review must be confirmed before opening the matter.");
      if (!checklistResult.data.document_structure_created) throw new Error("Document structure must be confirmed before opening the matter.");
      if (prospectResult.data.matter_id) {
        return NextResponse.json({ success: true, matterId: prospectResult.data.matter_id }, { status: 200 });
      }
      const matter = await createMatterWorkspaceServer({
        title: `${prospectResult.data.name} - ${prospectResult.data.matter_type}`,
        clientName: prospectResult.data.name,
        matterType: prospectResult.data.matter_type,
        jurisdiction: prospectResult.data.jurisdiction,
        riskLevel: conflictResult.data?.status === "Waived" ? "High" : "Medium",
        status: "Active",
        synopsis: prospectResult.data.summary,
        primaryTrack: checklistResult.data.opening_notes?.trim() || "Matter opening and first working plan",
        riskToMonitor:
          checklistResult.data.initial_deadline_note?.trim() || "Initial deadline review required and must be monitored.",
        aiUsageRule: "AI suggestions require human review",
        nextDraft: "Opening memorandum",
        leadLawyerId: checklistResult.data.responsible_lawyer_id,
      }, scope);
      if (!matter) throw new Error("Unable to create matter.");
      const openingTimestamp = new Date().toISOString();
      const opposingPartyName = String(body.opposingPartyName ?? "").trim();

      const bootstrapWrites = await Promise.all([
        supabase.from("prospects").update({ status: "Converted", matter_id: matter.id }).eq("id", prospectId).eq("firm_id", firmId),
        supabase
          .from("matter_opening_checklists")
          .update({ completed_at: openingTimestamp })
          .eq("prospect_id", prospectId)
          .eq("firm_id", firmId),
        supabase.from("tasks").insert({
          matter_id: matter.id,
          title: "Opening review and first action plan",
          description: checklistResult.data.initial_deadline_note?.trim() || "Confirm chronology, deadlines, and immediate work allocation.",
          deadline: null,
          assigned_to: checklistResult.data.responsible_lawyer_id,
          status: "Open",
          is_completed: false,
        }),
        supabase.from("documents").insert({
          matter_id: matter.id,
          uploaded_by: scope.actorLawyerId,
          title: "Matter Opening Memorandum",
          document_type: "Opening",
          document_status: "Draft",
          review_status: "Working",
          access_level: "Lead+Partner",
          sharing_policy: "Internal only",
          version_label: "v1",
          ai_summary: checklistResult.data.opening_notes?.trim() || "Opening memorandum placeholder created from intake conversion.",
          review_note: engagementResult.data?.decision_note ?? null,
          requires_compliance_audit: true,
        }),
        supabase.from("knowledge_entries").insert({
          firm_id: firmId,
          matter_id: matter.id,
          title: `${prospectResult.data.name} intake brief`,
          entry_type: "Strategy note",
          tags: ["Intake", prospectResult.data.matter_type, prospectResult.data.jurisdiction],
          summary: [
            prospectResult.data.summary,
            checklistResult.data.initial_deadline_note?.trim() || null,
            checklistResult.data.document_structure_note?.trim() || null,
          ]
            .filter(Boolean)
            .join("\n\n"),
          storage_path: null,
          sensitivity: "Restricted",
        }),
        supabase.from("physical_files").upsert({
          matter_id: matter.id,
          file_code: `INT-${matter.id.slice(0, 8).toUpperCase()}`,
          label: `${prospectResult.data.name} opening file`,
          location: "Opening registry pending cabinet assignment",
          custody_status: "Registered",
          qr_payload: null,
        }),
        supabase.from("matter_case_fields").insert(
          [
            {
              matter_id: matter.id,
              field_key: "client_email",
              field_label: "Client email",
              field_value: prospectResult.data.email ?? "Not provided",
              field_group: "Intake",
            },
            {
              matter_id: matter.id,
              field_key: "client_phone",
              field_label: "Client phone",
              field_value: prospectResult.data.phone ?? "Not provided",
              field_group: "Intake",
            },
            {
              matter_id: matter.id,
              field_key: "scope_of_work",
              field_label: "Scope of work",
              field_value: engagementResult.data?.scope_of_work ?? "Not recorded",
              field_group: "Engagement",
            },
            {
              matter_id: matter.id,
              field_key: "fee_arrangement",
              field_label: "Fee arrangement",
              field_value: engagementResult.data?.fee_arrangement ?? "Not recorded",
              field_group: "Engagement",
            },
            {
              matter_id: matter.id,
              field_key: "opposing_party",
              field_label: "Opposing party",
              field_value: opposingPartyName || "Not recorded",
              field_group: "Parties",
            },
          ],
        ),
        supabase.from("audit_logs").insert({
          firm_id: firmId,
          matter_id: matter.id,
          actor_id: scope.actorLawyerId,
          action_type: "matter_opened",
          description: `Matter opened from prospect ${prospectResult.data.name} after conflict and engagement approval.`,
          is_critical: true,
        }),
        supabase.from("intake_decision_events").insert({
          firm_id: firmId,
          prospect_id: prospectId,
          actor_id: scope.actorLawyerId,
          event_type: "matter_opened",
          summary: `Matter ${matter.title} was opened from the intake workflow.`,
          detail: checklistResult.data.opening_notes?.trim() || null,
        }),
      ]);

      const bootstrapError = bootstrapWrites.find((result) => "error" in result && result.error);
      if (bootstrapError && "error" in bootstrapError && bootstrapError.error) {
        throw new Error(bootstrapError.error.message);
      }

      await recordMatterEvent({
        matterId: matter.id,
        scope,
        eventType: "MATTER_OPENED",
        newState: "OPEN",
        reason: "Converted from governed intake after conflict and engagement approval.",
        metadata: {
          prospectId,
          conflictStatus: conflictResult.data?.status ?? null,
          responsibleLawyerId: checklistResult.data.responsible_lawyer_id,
        },
      });

      return NextResponse.json({ success: true, matterId: matter.id, matter });
    }
    return NextResponse.json({ success: false, error: "Unsupported intake action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to process intake." }, { status: statusForApiError(error) });
  }
}
