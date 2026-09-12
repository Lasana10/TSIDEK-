import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { executeWorkflowStageActions } from "@/lib/workflow-actions.server";

type Context = { params: Promise<{ matterId: string }> };

async function loadRuntime(request: Request, matterId: string) {
  const scope = await resolveRequestScope(request);
  await assertMatterPermission({ scope, matterId, allowAnyMember: true });
  if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated matter context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");

  const matter = await supabase.from("matters").select("id,firm_id,lead_lawyer_id,status,title").eq("id", matterId).eq("firm_id", scope.firmId).single();
  if (matter.error) throw new Error(matter.error.message);

  let instance = await supabase.from("matter_workflow_instances").select("*").eq("matter_id", matterId).maybeSingle();
  if (instance.error) throw new Error(instance.error.message);

  if (!instance.data) {
    const workflow = await supabase.from("firm_workflow_definitions").select("id").eq("firm_id", scope.firmId).eq("workflow_key", "matter_standard").eq("status", "active").order("version", { ascending: false }).limit(1).single();
    if (workflow.error) throw new Error(workflow.error.message);
    const created = await supabase.from("matter_workflow_instances").insert({
      firm_id: scope.firmId, matter_id: matterId, workflow_id: workflow.data.id, current_stage_key: "opened",
    }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    instance = created;
    const event = await supabase.from("matter_workflow_events").insert({
      firm_id: scope.firmId, matter_id: matterId, instance_id: created.data.id, from_stage_key: null, to_stage_key: "opened", action: "initialized", actor_lawyer_id: scope.actorLawyerId, actor_role: scope.actorRole ?? null,
    });
    if (event.error) throw new Error(event.error.message);
  }

  const [workflow, stages, transitions, events, requests] = await Promise.all([
    supabase.from("firm_workflow_definitions").select("*").eq("id", instance.data.workflow_id).single(),
    supabase.from("firm_workflow_stages").select("*").eq("workflow_id", instance.data.workflow_id).order("sort_order"),
    supabase.from("firm_workflow_transitions").select("*").eq("workflow_id", instance.data.workflow_id).eq("active", true).order("sort_order"),
    supabase.from("matter_workflow_events").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(50),
    supabase.from("workflow_transition_requests").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(20),
  ]);
  for (const result of [workflow, stages, transitions, events, requests]) if (result.error) throw new Error(result.error.message);

  return { scope, supabase, matter: matter.data, instance: instance.data, workflow: workflow.data, stages: stages.data ?? [], transitions: transitions.data ?? [], events: events.data ?? [], requests: requests.data ?? [] };
}

async function evaluateGuards(runtime: Awaited<ReturnType<typeof loadRuntime>>, transition: Record<string, unknown>) {
  const rules = (transition.guard_rules && typeof transition.guard_rules === "object" ? transition.guard_rules : {}) as Record<string, unknown>;
  const failures: string[] = [];
  const { supabase, matter, instance } = runtime;

  if (rules.require_lead && !matter.lead_lawyer_id) failures.push("A lead lawyer must be assigned.");
  if (rules.require_no_open_tasks) {
    const result = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("matter_id", matter.id).eq("is_completed", false);
    if (result.error) throw new Error(result.error.message);
    if ((result.count ?? 0) > 0) failures.push("Open tasks must be completed before this transition.");
  }
  if (rules.require_no_overdue_critical_tasks) {
    const result = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("matter_id", matter.id).eq("is_completed", false).lt("deadline", new Date().toISOString());
    if (result.error) throw new Error(result.error.message);
    if ((result.count ?? 0) > 0) failures.push("Overdue work must be resolved before this transition.");
  }
  if (rules.require_client_update) {
    const result = await supabase.from("matter_client_updates").select("id").eq("matter_id", matter.id).in("status", ["Approved","Sent","Delivered","approved","sent","delivered"]).order("created_at", { ascending: false }).limit(1);
    if (result.error) throw new Error(result.error.message);
    if (!(result.data ?? []).length) failures.push("A governed client update is required.");
  }
  if (rules.require_finance_reconciled) {
    const result = await supabase.from("finance_reconciliation_reviews").select("id,status").eq("matter_id", matter.id).in("status", ["matched","approved"]).order("created_at", { ascending: false }).limit(1);
    if (result.error) throw new Error(result.error.message);
    if (!(result.data ?? []).length) failures.push("Finance must be reconciled before closure starts.");
  }
  if (rules.require_closure_review) {
    const result = await supabase.from("matter_closure_reviews").select("*").eq("matter_id", matter.id).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    const review = result.data;
    if (!review || !review.financial_reconciled || !review.obligations_resolved || !review.documents_archived || !review.client_notified || !review.knowledge_reviewed) failures.push("The closure checklist is incomplete.");
  }

  return { ok: failures.length === 0, failures, stage: instance.current_stage_key, rules };
}

export async function GET(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const runtime = await loadRuntime(request, matterId);
    const available = runtime.transitions.filter((item) => item.from_stage_key === runtime.instance.current_stage_key);
    return NextResponse.json({ success: true, workflow: runtime.workflow, instance: runtime.instance, stages: runtime.stages, transitions: available, events: runtime.events, approvalRequests: runtime.requests });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load matter workflow." }, { status: 403 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const runtime = await loadRuntime(request, matterId);
    await assertMatterPermission({ scope: runtime.scope, matterId, permission: "assignWork" });
    const body = await request.json();
    const action = String(body.action ?? "transition");

    if (action === "reviewApproval") {
      const requestId = String(body.requestId ?? "");
      const decision = String(body.decision ?? "");
      if (!requestId || !["approved","rejected"].includes(decision)) return NextResponse.json({ success: false, error: "Valid request and decision are required." }, { status: 400 });
      const pending = runtime.requests.find((item) => item.id === requestId && item.status === "pending");
      if (!pending) return NextResponse.json({ success: false, error: "Pending approval request not found." }, { status: 404 });
      const transition = runtime.transitions.find((item) => item.id === pending.transition_id);
      if (!transition) return NextResponse.json({ success: false, error: "Workflow transition no longer exists." }, { status: 409 });
      const role = String(runtime.scope.actorRole ?? "").toLowerCase();
      const approvalRoles = (transition.approval_roles ?? []).map((item: unknown) => String(item).toLowerCase());
      if (approvalRoles.length && !approvalRoles.includes(role)) return NextResponse.json({ success: false, error: "Your role cannot approve this transition." }, { status: 403 });

      if (decision === "rejected") {
        const rejected = await runtime.supabase.from("workflow_transition_requests").update({ status: "rejected", reviewer_lawyer_id: runtime.scope.actorLawyerId, reviewer_role: runtime.scope.actorRole ?? null, review_reason: String(body.reviewReason ?? "").trim() || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId).eq("status", "pending");
        if (rejected.error) throw new Error(rejected.error.message);
        return NextResponse.json({ success: true, approvalStatus: "rejected" });
      }

      if (pending.from_stage_key !== runtime.instance.current_stage_key) {
        await runtime.supabase.from("workflow_transition_requests").update({ status: "stale", reviewer_lawyer_id: runtime.scope.actorLawyerId, reviewer_role: runtime.scope.actorRole ?? null, review_reason: "Matter stage changed before approval.", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId);
        return NextResponse.json({ success: false, error: "Approval request is stale because the matter stage changed." }, { status: 409 });
      }

      const guard = await evaluateGuards(runtime, transition);
      if (!guard.ok) return NextResponse.json({ success: false, error: "Workflow gate failed at approval time.", guard }, { status: 409 });
      const atomic = await runtime.supabase.rpc("transition_matter_workflow_atomic", {
        p_instance_id: runtime.instance.id,
        p_transition_id: transition.id,
        p_expected_stage: runtime.instance.current_stage_key,
        p_reason: pending.reason ?? "Approved workflow transition",
        p_guard_snapshot: guard,
        p_actor_lawyer_id: runtime.scope.actorLawyerId,
        p_actor_role: runtime.scope.actorRole ?? null,
      });
      if (atomic.error) throw new Error(atomic.error.message);
      const result = atomic.data as { instance?: any; event?: unknown; target_stage?: string } | null;
      const approved = await runtime.supabase.from("workflow_transition_requests").update({ status: "approved", reviewer_lawyer_id: runtime.scope.actorLawyerId, reviewer_role: runtime.scope.actorRole ?? null, review_reason: String(body.reviewReason ?? "").trim() || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId).eq("status", "pending");
      if (approved.error) throw new Error(approved.error.message);
      const targetStage = String(result?.target_stage ?? transition.to_stage_key);
      const actions = await executeWorkflowStageActions({ supabase: runtime.supabase, firmId: runtime.scope.firmId!, matterId, instanceId: runtime.instance.id, workflowId: runtime.instance.workflow_id, stageKey: targetStage, actorLawyerId: runtime.scope.actorLawyerId, leadLawyerId: runtime.matter.lead_lawyer_id });
      return NextResponse.json({ success: true, approvalStatus: "approved", instance: result?.instance ?? null, event: result?.event ?? null, stage: targetStage, actions });
    }

    const transitionId = String(body.transitionId ?? "");
    const transition = runtime.transitions.find((item) => item.id === transitionId && item.from_stage_key === runtime.instance.current_stage_key);
    if (!transition) return NextResponse.json({ success: false, error: "This transition is not available from the current stage." }, { status: 400 });

    const role = String(runtime.scope.actorRole ?? "").toLowerCase();
    const allowedRoles = (transition.allowed_roles ?? []).map((item: unknown) => String(item).toLowerCase());
    if (allowedRoles.length && !allowedRoles.includes(role)) return NextResponse.json({ success: false, error: "Your role cannot perform this transition." }, { status: 403 });
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (transition.requires_reason && !reason) return NextResponse.json({ success: false, error: "A reason is required for this transition." }, { status: 400 });

    const guard = await evaluateGuards(runtime, transition);
    if (!guard.ok) return NextResponse.json({ success: false, error: "Workflow gate failed.", guard }, { status: 409 });

    const approvalRoles = (transition.approval_roles ?? []).map((item: unknown) => String(item).toLowerCase());
    if (transition.requires_approval && approvalRoles.length && !approvalRoles.includes(role)) {
      const requestResult = await runtime.supabase.from("workflow_transition_requests").upsert({
        firm_id: runtime.scope.firmId,
        matter_id: matterId,
        instance_id: runtime.instance.id,
        transition_id: transition.id,
        from_stage_key: runtime.instance.current_stage_key,
        to_stage_key: transition.to_stage_key,
        requester_lawyer_id: runtime.scope.actorLawyerId,
        requester_role: runtime.scope.actorRole ?? null,
        reason: reason || null,
        guard_snapshot: guard,
        status: "pending",
        updated_at: new Date().toISOString(),
      }, { onConflict: "instance_id,transition_id" }).select("*").single();
      if (requestResult.error) throw new Error(requestResult.error.message);
      return NextResponse.json({ success: true, approvalRequired: true, approvalRequest: requestResult.data }, { status: 202 });
    }

    const atomic = await runtime.supabase.rpc("transition_matter_workflow_atomic", {
      p_instance_id: runtime.instance.id,
      p_transition_id: transition.id,
      p_expected_stage: runtime.instance.current_stage_key,
      p_reason: reason,
      p_guard_snapshot: guard,
      p_actor_lawyer_id: runtime.scope.actorLawyerId,
      p_actor_role: runtime.scope.actorRole ?? null,
    });
    if (atomic.error) throw new Error(atomic.error.message);
    const result = atomic.data as { instance?: any; event?: unknown; target_stage?: string } | null;
    const targetStage = String(result?.target_stage ?? transition.to_stage_key);
    const actions = await executeWorkflowStageActions({ supabase: runtime.supabase, firmId: runtime.scope.firmId!, matterId, instanceId: runtime.instance.id, workflowId: runtime.instance.workflow_id, stageKey: targetStage, actorLawyerId: runtime.scope.actorLawyerId, leadLawyerId: runtime.matter.lead_lawyer_id });
    return NextResponse.json({ success: true, instance: result?.instance ?? null, event: result?.event ?? null, stage: targetStage, actions });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to transition workflow." }, { status: 403 });
  }
}
