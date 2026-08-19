import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import {
  assertMatterLifecycleTransition,
  isMatterLifecycleState,
  type MatterLifecycleEvent,
  type MatterLifecycleState,
} from "@/lib/matter-lifecycle";

type MatterLifecycleRow = {
  id: string;
  firm_id: string;
  lifecycle_state: string | null;
};

type MatterEventRow = {
  id: string;
  matter_id: string;
  firm_id: string;
  event_type: string;
  previous_state: string | null;
  new_state: string | null;
  actor_lawyer_id: string | null;
  actor_name: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

function mapEvent(row: MatterEventRow): MatterLifecycleEvent {
  return {
    id: row.id,
    matterId: row.matter_id,
    firmId: row.firm_id,
    eventType: row.event_type,
    previousState: isMatterLifecycleState(row.previous_state)
      ? row.previous_state
      : null,
    newState: isMatterLifecycleState(row.new_state) ? row.new_state : null,
    actorLawyerId: row.actor_lawyer_id,
    actorName: row.actor_name,
    reason: row.reason,
    metadata: row.metadata ?? {},
    occurredAt: row.occurred_at,
  };
}

export async function getMatterLifecycle(matterId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase persistence is required for governed matter lifecycle.");
  }

  const [matterResult, eventResult] = await Promise.all([
    supabase
      .from("matters")
      .select("id,firm_id,lifecycle_state")
      .eq("id", matterId)
      .maybeSingle(),
    supabase
      .from("matter_events")
      .select(
        "id,matter_id,firm_id,event_type,previous_state,new_state,actor_lawyer_id,actor_name,reason,metadata,occurred_at"
      )
      .eq("matter_id", matterId)
      .order("occurred_at", { ascending: true }),
  ]);

  if (matterResult.error) {
    throw new Error(matterResult.error.message);
  }
  if (!matterResult.data) {
    throw new Error("Matter not found.");
  }
  if (eventResult.error) {
    throw new Error(eventResult.error.message);
  }

  const row = matterResult.data as MatterLifecycleRow;
  const state = isMatterLifecycleState(row.lifecycle_state)
    ? row.lifecycle_state
    : "OPEN";

  return {
    matterId: row.id,
    firmId: row.firm_id,
    state,
    events: ((eventResult.data ?? []) as MatterEventRow[]).map(mapEvent),
  };
}

export async function transitionMatterLifecycle(input: {
  matterId: string;
  targetState: MatterLifecycleState;
  scope: RequestScope;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase persistence is required for governed matter lifecycle.");
  }

  const currentResult = await supabase
    .from("matters")
    .select("id,firm_id,lifecycle_state")
    .eq("id", input.matterId)
    .maybeSingle();

  if (currentResult.error) {
    throw new Error(currentResult.error.message);
  }
  if (!currentResult.data) {
    throw new Error("Matter not found.");
  }

  const current = currentResult.data as MatterLifecycleRow;
  if (input.scope.firmId && current.firm_id !== input.scope.firmId) {
    throw new Error("Matter access denied for the current firm scope.");
  }

  const currentState: MatterLifecycleState = isMatterLifecycleState(
    current.lifecycle_state
  )
    ? current.lifecycle_state
    : "OPEN";

  assertMatterLifecycleTransition(currentState, input.targetState);

  const rpcResult = await supabase.rpc("transition_matter_lifecycle", {
    p_matter_id: input.matterId,
    p_expected_state: currentState,
    p_new_state: input.targetState,
    p_actor_lawyer_id: input.scope.actorLawyerId,
    p_actor_name: input.scope.actorName,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (rpcResult.error) {
    throw new Error(rpcResult.error.message);
  }

  return getMatterLifecycle(input.matterId);
}
