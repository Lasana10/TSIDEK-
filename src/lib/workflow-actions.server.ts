import type { SupabaseClient } from "@supabase/supabase-js";

type ActionRow = {
  id: string;
  stage_key: string;
  action_key: string;
  action_type: string;
  name: string;
  configuration: Record<string, unknown> | null;
  sort_order: number;
};

export async function executeWorkflowStageActions(input: {
  supabase: SupabaseClient;
  firmId: string;
  matterId: string;
  instanceId: string;
  workflowId: string;
  stageKey: string;
  actorLawyerId: string | null;
  leadLawyerId: string | null;
}) {
  const { supabase, firmId, matterId, instanceId, workflowId, stageKey, actorLawyerId, leadLawyerId } = input;
  const { data: actions, error } = await supabase
    .from("firm_workflow_stage_actions")
    .select("id,stage_key,action_key,action_type,name,configuration,sort_order")
    .eq("workflow_id", workflowId)
    .eq("stage_key", stageKey)
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);

  const results: Array<{ actionKey: string; status: string; result?: unknown; error?: string }> = [];

  for (const action of (actions ?? []) as ActionRow[]) {
    const existing = await supabase
      .from("matter_workflow_action_runs")
      .select("id,status,result,error_message")
      .eq("instance_id", instanceId)
      .eq("stage_action_id", action.id)
      .eq("stage_key", stageKey)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.status === "completed") {
      results.push({ actionKey: action.action_key, status: "completed", result: existing.data.result });
      continue;
    }

    const config = action.configuration ?? {};
    let runId = existing.data?.id as string | undefined;
    if (!runId) {
      const run = await supabase
        .from("matter_workflow_action_runs")
        .insert({ firm_id: firmId, matter_id: matterId, instance_id: instanceId, stage_action_id: action.id, stage_key: stageKey, status: "pending" })
        .select("id")
        .single();
      if (run.error) throw new Error(run.error.message);
      runId = run.data.id;
    }

    try {
      let output: unknown = { skipped: false };
      if (action.action_type === "create_task") {
        const title = String(config.title ?? action.name);
        const existingTask = await supabase.from("tasks").select("id").eq("matter_id", matterId).eq("title", title).limit(1);
        if (existingTask.error) throw new Error(existingTask.error.message);
        if (existingTask.data?.length) output = { taskId: existingTask.data[0].id, reused: true };
        else {
          const task = await supabase.from("tasks").insert({
            matter_id: matterId,
            title,
            description: String(config.description ?? action.name),
            assigned_to: String(config.assign ?? "") === "lead" ? leadLawyerId : null,
            status: "Open",
            is_completed: false,
          }).select("id").single();
          if (task.error) throw new Error(task.error.message);
          output = { taskId: task.data.id, reused: false };
        }
      } else if (action.action_type === "require_client_update") {
        const title = String(config.title ?? action.name);
        const existingUpdate = await supabase.from("matter_client_updates").select("id").eq("matter_id", matterId).eq("title", title).limit(1);
        if (existingUpdate.error) throw new Error(existingUpdate.error.message);
        if (existingUpdate.data?.length) output = { updateId: existingUpdate.data[0].id, reused: true };
        else {
          const update = await supabase.from("matter_client_updates").insert({
            firm_id: firmId,
            matter_id: matterId,
            created_by: actorLawyerId,
            title,
            body: "Prepare and approve a client-facing update for this workflow stage.",
            channel: "Portal",
            audience: "Client",
            status: "Draft",
            instruction_required: Boolean(config.instruction_required),
            instruction_status: Boolean(config.instruction_required) ? "Pending" : "Not requested",
            delivery_status: "Not sent",
          }).select("id").single();
          if (update.error) throw new Error(update.error.message);
          output = { updateId: update.data.id, reused: false };
        }
      } else if (action.action_type === "require_finance_reconciliation") {
        const existingReview = await supabase.from("finance_reconciliation_reviews").select("id,status").eq("matter_id", matterId).in("status", ["open","matched","approved"]).order("created_at", { ascending: false }).limit(1);
        if (existingReview.error) throw new Error(existingReview.error.message);
        if (existingReview.data?.length) output = { reconciliationId: existingReview.data[0].id, reused: true };
        else {
          const review = await supabase.from("finance_reconciliation_reviews").insert({
            firm_id: firmId,
            matter_id: matterId,
            status: "open",
            notes: "Workflow-required matter reconciliation.",
            prepared_by: actorLawyerId,
          }).select("id").single();
          if (review.error) throw new Error(review.error.message);
          output = { reconciliationId: review.data.id, reused: false };
        }
      } else if (action.action_type === "create_closure_checklist") {
        const existingClosure = await supabase.from("matter_closure_reviews").select("id").eq("matter_id", matterId).maybeSingle();
        if (existingClosure.error) throw new Error(existingClosure.error.message);
        if (existingClosure.data) output = { closureReviewId: existingClosure.data.id, reused: true };
        else {
          const closure = await supabase.from("matter_closure_reviews").insert({ firm_id: firmId, matter_id: matterId }).select("id").single();
          if (closure.error) throw new Error(closure.error.message);
          output = { closureReviewId: closure.data.id, reused: false };
        }
      } else if (action.action_type === "require_document") {
        output = { requirement: String(config.document_type ?? action.name) };
      } else if (action.action_type === "create_review") {
        output = { review: String(config.title ?? action.name), status: "required" };
      } else if (action.action_type === "notify_role") {
        output = { role: String(config.role ?? "partner"), notification: action.name };
      }

      const saved = await supabase.from("matter_workflow_action_runs").update({
        status: "completed",
        result: output as Record<string, unknown>,
        error_message: null,
        executed_by: actorLawyerId,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", runId);
      if (saved.error) throw new Error(saved.error.message);
      results.push({ actionKey: action.action_key, status: "completed", result: output });
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Workflow action failed.";
      await supabase.from("matter_workflow_action_runs").update({ status: "failed", error_message: message, executed_by: actorLawyerId, executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
      results.push({ actionKey: action.action_key, status: "failed", error: message });
    }
  }

  return results;
}
