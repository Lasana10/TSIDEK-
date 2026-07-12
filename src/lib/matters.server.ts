import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import {
  buildMatterWorkspaceRecord,
  loadMattersFromSupabase,
  seededMatterWorkspaceRecords,
  type MatterWorkspaceData,
} from "@/lib/matters";
import {
  createPrototypeMatterWorkspace,
  getPrototypeMatterWorkspaceById,
  listPrototypeMatterWorkspaces,
} from "@/lib/prototype-store.server";

async function resolveDefaultFirmId() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const firmResult = await supabase
    .from("firms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firmResult.error) {
    throw new Error(firmResult.error.message);
  }

  if (firmResult.data?.id) {
    return firmResult.data.id as string;
  }

  const createdFirm = await supabase
    .from("firms")
    .insert({
      name: "TSIDEK Demo Firm",
      country: "Cameroon",
    })
    .select("id")
    .single();

  if (createdFirm.error || !createdFirm.data) {
    throw new Error(createdFirm.error?.message ?? "Unable to initialize a firm record.");
  }

  return createdFirm.data.id as string;
}

export async function listMatterWorkspacesServer(scope?: RequestScope) {
  const liveMatters = await loadMattersFromSupabase(scope?.firmId ?? undefined);
  if (liveMatters) {
    return liveMatters;
  }

  const storedMatters = await listPrototypeMatterWorkspaces();
  return storedMatters.length ? storedMatters : seededMatterWorkspaceRecords;
}

export async function getMatterWorkspaceByIdServer(matterId: string, scope?: RequestScope) {
  const liveMatters = await loadMattersFromSupabase(scope?.firmId ?? undefined);
  if (liveMatters) {
    return liveMatters.find((matter) => matter.id === matterId) ?? null;
  }

  return (
    (await getPrototypeMatterWorkspaceById(matterId)) ??
    seededMatterWorkspaceRecords.find((matter) => matter.id === matterId) ??
    null
  );
}

export async function createMatterWorkspaceServer(input: {
  title: string;
  clientName: string;
  matterType: string;
  jurisdiction: string;
  riskLevel: string;
  status: string;
  synopsis: string;
  primaryTrack: string;
  riskToMonitor: string;
  aiUsageRule: string;
  nextDraft: string;
}, scope?: RequestScope) {
  const supabase = createServerSupabaseClient();

  if (supabase) {
    const firmId = scope?.firmId ?? (await resolveDefaultFirmId());
    if (!firmId) {
      throw new Error("Unable to resolve a firm for the new matter.");
    }

    const result = await supabase
      .from("matters")
      .insert({
        firm_id: firmId,
        title: input.title,
        client_name: input.clientName,
        status: input.status,
        risk_level: input.riskLevel,
        matter_type: input.matterType,
        jurisdiction: input.jurisdiction,
        synopsis: input.synopsis,
        primary_track: input.primaryTrack,
        risk_to_monitor: input.riskToMonitor,
        ai_usage_rule: input.aiUsageRule,
        next_draft: input.nextDraft,
        lead_lawyer_id: scope?.actorLawyerId ?? null,
      })
      .select("id")
      .single();

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Unable to create matter");
    }

    if (scope?.actorLawyerId) {
      await supabase.from("matter_members").upsert({
        matter_id: result.data.id,
        lawyer_id: scope.actorLawyerId,
        is_primary: true,
      });
    }

    const matters = await listMatterWorkspacesServer(scope);
    return matters.find((item) => item.id === result.data.id) ?? null;
  }

  return createPrototypeMatterWorkspace(input);
}

export function buildMatterWorkspaceForTests(input: MatterWorkspaceData) {
  return buildMatterWorkspaceRecord(
    {
      id: input.id,
      title: input.title,
      client_name: input.clientName,
      status: input.status,
      risk_level: input.riskLevel,
      jurisdiction: input.jurisdiction,
      lead_lawyer_id: null,
    },
    undefined,
    [],
    []
  );
}
