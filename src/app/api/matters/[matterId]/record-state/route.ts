import { NextResponse } from "next/server";
import { assertMatterPermission } from "@/lib/authorization";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";

const removableDependencyChecks = [
  ["documents", "matter_id"],
  ["invoices", "matter_id"],
  ["matter_payments", "matter_id"],
  ["matter_disbursements", "matter_id"],
  ["matter_events", "matter_id"],
  ["legal_document_records", "matter_id"],
] as const;

async function countDependencies(matterId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase persistence is required.");
  const dependencyCounts: Record<string, number> = {};
  for (const [table, column] of removableDependencyChecks) {
    const result = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, matterId);
    if (result.error) throw new Error(result.error.message);
    dependencyCounts[table] = result.count ?? 0;
  }
  return dependencyCounts;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase persistence is required.");
    const result = await supabase.from("matter_record_change_requests")
      .select("id,request_type,status,reason,requested_by,requested_at,decided_by,decided_at,decision_note")
      .eq("matter_id", matterId)
      .order("requested_at", { ascending: false })
      .limit(10);
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, requests: result.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load case governance." }, { status: statusForApiError(error) });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    const body = await request.json();
    const action = String(body.action ?? "");
    if (!["archive", "restore", "request_remove", "approve_remove", "reject_remove"].includes(action)) {
      return NextResponse.json({ success: false, error: "Unsupported record-state action." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase persistence is required.");

    if (action === "archive" || action === "restore") {
      await assertMatterPermission({ scope, matterId, permission: "archiveMatters" });
      const nextState = action === "restore" ? "active" : "archived";
      const reason = String(body.reason ?? "").trim() || null;
      const update = await supabase.from("matters")
        .update({ record_state: nextState, record_state_reason: reason, record_state_at: nextState === "active" ? null : new Date().toISOString(), record_state_by: scope.actorLawyerId ?? null })
        .eq("id", matterId)
        .select("id,record_state,record_state_reason")
        .single();
      if (update.error) throw new Error(update.error.message);
      await supabase.from("matter_events").insert({ matter_id: matterId, event_type: `MATTER_${nextState.toUpperCase()}`, actor_name: scope.actorName, reason, metadata: { recordState: nextState } });
      return NextResponse.json({ success: true, matter: update.data });
    }

    if (action === "request_remove") {
      await assertMatterPermission({ scope, matterId, permission: "requestMatterRemoval" });
      if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 8) return NextResponse.json({ success: false, error: "Give a clear reason for requesting case removal." }, { status: 400 });
      const dependencyCounts = await countDependencies(matterId);
      const linkedRecords = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);
      if (linkedRecords > 0) {
        return NextResponse.json({ success: false, error: "This case already has legal or financial history. Archive it instead of requesting removal.", dependencyCounts }, { status: 409 });
      }
      const created = await supabase.from("matter_record_change_requests").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        request_type: "remove",
        status: "pending",
        reason,
        requested_by: scope.actorLawyerId,
        metadata: { requested_by_name: scope.actorName },
      }).select("id,status,reason,requested_at").single();
      if (created.error) throw new Error(created.error.code === "23505" ? "A removal request is already pending for this case." : created.error.message);
      await supabase.from("matter_events").insert({ matter_id: matterId, event_type: "MATTER_REMOVAL_REQUESTED", actor_name: scope.actorName, reason, metadata: { requestId: created.data.id } });
      return NextResponse.json({ success: true, request: created.data });
    }

    await assertMatterPermission({ scope, matterId, permission: "approveMatterRemoval" });
    const requestId = String(body.requestId ?? "").trim();
    if (!requestId) return NextResponse.json({ success: false, error: "Removal request ID is required." }, { status: 400 });
    const pending = await supabase.from("matter_record_change_requests")
      .select("id,status,requested_by,reason")
      .eq("id", requestId)
      .eq("matter_id", matterId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending.error) throw new Error(pending.error.message);
    if (!pending.data) return NextResponse.json({ success: false, error: "Pending removal request not found." }, { status: 404 });
    if (pending.data.requested_by === scope.actorLawyerId) {
      return NextResponse.json({ success: false, error: "The person who requested removal cannot approve the same request." }, { status: 403 });
    }

    if (action === "reject_remove") {
      const decisionNote = String(body.decisionNote ?? "").trim() || "Removal request rejected";
      const rejected = await supabase.from("matter_record_change_requests")
        .update({ status: "rejected", decided_by: scope.actorLawyerId, decided_at: new Date().toISOString(), decision_note: decisionNote })
        .eq("id", requestId).eq("status", "pending").select("id,status").single();
      if (rejected.error) throw new Error(rejected.error.message);
      await supabase.from("matter_events").insert({ matter_id: matterId, event_type: "MATTER_REMOVAL_REJECTED", actor_name: scope.actorName, reason: decisionNote, metadata: { requestId } });
      return NextResponse.json({ success: true, request: rejected.data });
    }

    const dependencyCounts = await countDependencies(matterId);
    const linkedRecords = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);
    if (linkedRecords > 0) {
      return NextResponse.json({ success: false, error: "This case now has legal or financial history and can no longer be removed. Archive it instead.", dependencyCounts }, { status: 409 });
    }

    const decisionNote = String(body.decisionNote ?? "").trim() || "Approved by firm governance";
    const removed = await supabase.from("matters")
      .update({ record_state: "deleted", record_state_reason: pending.data.reason, record_state_at: new Date().toISOString(), record_state_by: scope.actorLawyerId ?? null })
      .eq("id", matterId).select("id,record_state,record_state_reason").single();
    if (removed.error) throw new Error(removed.error.message);
    const approved = await supabase.from("matter_record_change_requests")
      .update({ status: "approved", decided_by: scope.actorLawyerId, decided_at: new Date().toISOString(), decision_note: decisionNote })
      .eq("id", requestId).eq("status", "pending").select("id,status").single();
    if (approved.error) throw new Error(approved.error.message);
    await supabase.from("matter_events").insert({ matter_id: matterId, event_type: "MATTER_REMOVAL_APPROVED", actor_name: scope.actorName, reason: decisionNote, metadata: { requestId, recordState: "deleted" } });
    return NextResponse.json({ success: true, matter: removed.data, request: approved.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update case record state." }, { status: statusForApiError(error) });
  }
}
