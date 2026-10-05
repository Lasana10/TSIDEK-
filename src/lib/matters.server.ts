import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import type { MatterOperatingModel } from "@/lib/matter-operating-model";
import { buildMatterWorkspaceRecord, seededMatterWorkspaceRecords, type MatterWorkspaceData } from "@/lib/matters";
import { createPrototypeMatterWorkspace, getPrototypeMatterWorkspaceById, listPrototypeMatterWorkspaces } from "@/lib/prototype-store.server";
import { isDemoModeEnabled } from "@/lib/runtime-mode";

const matterSelect = "id,title,client_name,status,risk_level,jurisdiction,matter_type,synopsis,primary_track,next_draft,risk_to_monitor,ai_usage_rule,lead_lawyer_id,security_classification,ethical_wall_enabled,case_reference,record_state,engagement_nature,practice_area,service_type,client_objective,plan_label";

async function loadServerMatters(firmId?: string, includeInactive = false) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  let query = supabase.from("matters").select(matterSelect).order("created_at", { ascending: false });
  if (firmId) query = query.eq("firm_id", firmId);
  if (!includeInactive) query = query.eq("record_state", "active");
  const matterResult = await query;
  if (matterResult.error) throw new Error(matterResult.error.message);
  const rows = matterResult.data ?? [];
  const matterIds = rows.map((row) => row.id);
  const lawyerIds = rows.map((row) => row.lead_lawyer_id).filter((id): id is string => Boolean(id));
  const [lawyerResult, workstreamResult, milestoneResult] = await Promise.all([
    lawyerIds.length ? supabase.from("lawyers").select("id,full_name,role").in("id", lawyerIds) : Promise.resolve({ data: [], error: null }),
    matterIds.length ? supabase.from("matter_workstreams").select("id,matter_id,name,workstream_type,status,sequence_no,objective").in("matter_id", matterIds).order("sequence_no", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    matterIds.length ? supabase.from("matter_milestones").select("id,matter_id,title,status,sequence_no,due_at,source_kind,source_detail").in("matter_id", matterIds).order("sequence_no", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (lawyerResult.error) throw new Error(lawyerResult.error.message);
  if (workstreamResult.error) throw new Error(workstreamResult.error.message);
  if (milestoneResult.error) throw new Error(milestoneResult.error.message);
  const lawyers = new Map((lawyerResult.data ?? []).map((lawyer) => [lawyer.id, lawyer]));
  return rows.map((row) => buildMatterWorkspaceRecord(
    row,
    row.lead_lawyer_id ? lawyers.get(row.lead_lawyer_id) : undefined,
    [],
    [],
    workstreamResult.data ?? [],
    milestoneResult.data ?? [],
  ));
}

async function resolveDefaultFirmId() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const firmResult = await supabase.from("firms").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (firmResult.error) throw new Error(firmResult.error.message);
  if (firmResult.data?.id) return firmResult.data.id as string;
  const createdFirm = await supabase.from("firms").insert({ name: "TSIDEK Demo Firm", country: "Cameroon" }).select("id").single();
  if (createdFirm.error || !createdFirm.data) throw new Error(createdFirm.error?.message ?? "Unable to initialize a firm record.");
  return createdFirm.data.id as string;
}

export async function listMatterWorkspacesServer(scope?: RequestScope) {
  const liveMatters = await loadServerMatters(scope?.firmId ?? undefined, false);
  if (liveMatters) return liveMatters;
  if (!isDemoModeEnabled()) return [];
  const storedMatters = await listPrototypeMatterWorkspaces();
  return storedMatters.length ? storedMatters : seededMatterWorkspaceRecords;
}

export async function getMatterWorkspaceByIdServer(matterId: string, scope?: RequestScope) {
  const liveMatters = await loadServerMatters(scope?.firmId ?? undefined, true);
  if (liveMatters) return liveMatters.find((matter) => matter.id === matterId) ?? null;
  if (!isDemoModeEnabled()) return null;
  return (await getPrototypeMatterWorkspaceById(matterId)) ?? seededMatterWorkspaceRecords.find((matter) => matter.id === matterId) ?? null;
}

export async function createMatterWorkspaceServer(input: {
  title: string; clientName: string; matterType: string; jurisdiction: string; riskLevel: string; status: string; synopsis: string;
  primaryTrack: string; riskToMonitor: string; aiUsageRule: string; nextDraft: string; operatingModel?: MatterOperatingModel;
  securityClassification?: "Standard" | "Confidential" | "Partner-only"; ethicalWallEnabled?: boolean; leadLawyerId?: string | null;
}, scope?: RequestScope) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const firmId = scope?.firmId ?? (await resolveDefaultFirmId());
    if (!firmId) throw new Error("Unable to resolve a firm for the new matter.");
    const model = input.operatingModel;
    const result = await supabase.from("matters").insert({
      firm_id: firmId, title: input.title, client_name: input.clientName, status: input.status, risk_level: input.riskLevel,
      matter_type: input.matterType, jurisdiction: input.jurisdiction, synopsis: input.synopsis, primary_track: input.primaryTrack,
      risk_to_monitor: input.riskToMonitor, ai_usage_rule: input.aiUsageRule, next_draft: input.nextDraft,
      security_classification: input.securityClassification ?? "Standard", ethical_wall_enabled: Boolean(input.ethicalWallEnabled),
      lead_lawyer_id: input.leadLawyerId ?? scope?.actorLawyerId ?? null, record_state: "active",
      engagement_nature: model?.nature ?? "custom", practice_area: model?.practiceArea ?? null, service_type: model?.serviceType ?? input.matterType,
      client_objective: model?.objective ?? input.synopsis, plan_label: model?.planLabel ?? "Matter plan",
    }).select(matterSelect).single();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Unable to create matter");

    if (input.leadLawyerId || scope?.actorLawyerId) {
      const members = [input.leadLawyerId ? { matter_id: result.data.id, lawyer_id: input.leadLawyerId, is_primary: true } : null,
        scope?.actorLawyerId && scope.actorLawyerId !== input.leadLawyerId ? { matter_id: result.data.id, lawyer_id: scope.actorLawyerId, is_primary: false } : null].filter(Boolean);
      if (members.length) await supabase.from("matter_members").upsert(members);
    }

    let createdWorkstreams: Array<{ id: string; matter_id: string; name: string; workstream_type: string; status: string; sequence_no: number; objective: string | null }> = [];
    let createdMilestones: Array<{ id: string; matter_id: string; title: string; status: string; sequence_no: number; due_at: string | null; source_kind: string; source_detail: string | null }> = [];
    if (model) {
      const workstreamRows = model.workstreams.map((name, index) => ({ firm_id: firmId, matter_id: result.data.id, name, workstream_type: model.nature, sequence_no: index + 1, status: index === 0 ? "active" : "planned" }));
      const workstreams = await supabase.from("matter_workstreams").insert(workstreamRows).select("id,matter_id,name,workstream_type,status,sequence_no,objective");
      if (workstreams.error) throw new Error(workstreams.error.message);
      createdWorkstreams = workstreams.data ?? [];
      const workstreamBySequence = new Map(createdWorkstreams.map((item) => [item.sequence_no, item.id]));
      const milestoneRows = model.milestones.map((title, index) => ({ firm_id: firmId, matter_id: result.data.id, workstream_id: workstreamBySequence.get(index + 1) ?? null, title, sequence_no: index + 1, source_kind: "matter_plan" }));
      const milestones = await supabase.from("matter_milestones").insert(milestoneRows).select("id,matter_id,title,status,sequence_no,due_at,source_kind,source_detail");
      if (milestones.error) throw new Error(milestones.error.message);
      createdMilestones = milestones.data ?? [];
    }

    const caseReference = result.data.case_reference || `TSK-${result.data.id.slice(0, 8).toUpperCase()}`;
    await supabase.from("physical_files").upsert({ matter_id: result.data.id, file_code: caseReference, label: `${input.clientName} — ${input.title}`, location: "Registry / not yet assigned", custody_status: "Registered", qr_payload: `/matters/${result.data.id}`, qr_destination: `/matters/${result.data.id}`, barcode_value: caseReference, verification_status: "UNVERIFIED" }, { onConflict: "matter_id" });
    return buildMatterWorkspaceRecord(result.data, undefined, [], [], createdWorkstreams, createdMilestones);
  }
  if (!isDemoModeEnabled()) throw new Error("Supabase persistence is required to create matters in production.");
  return createPrototypeMatterWorkspace(input);
}

export function buildMatterWorkspaceForTests(input: MatterWorkspaceData) {
  return buildMatterWorkspaceRecord({ id: input.id, title: input.title, client_name: input.clientName, status: input.status, risk_level: input.riskLevel, jurisdiction: input.jurisdiction, matter_type: input.matterType, synopsis: input.synopsis, primary_track: input.primaryTrack, next_draft: input.nextDraft, risk_to_monitor: input.riskToMonitor, ai_usage_rule: input.aiUsageRule, lead_lawyer_id: null, security_classification: input.securityClassification, ethical_wall_enabled: input.ethicalWallEnabled, case_reference: input.physicalFileId, record_state: "active", engagement_nature: input.engagementNature ?? "custom", practice_area: input.practiceArea ?? null, service_type: input.serviceType ?? input.matterType, client_objective: input.clientObjective ?? input.synopsis, plan_label: input.planLabel ?? "Matter plan" }, undefined, [], []);
}
