import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ workflowId: string }> };

async function requireWorkflow(scope: Awaited<ReturnType<typeof resolveRequestScope>>, workflowId: string) {
  if (!scope.firmId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const result = await supabase.from("firm_workflow_definitions").select("*").eq("id", workflowId).eq("firm_id", scope.firmId).single();
  if (result.error) throw new Error(result.error.message);
  return { supabase, workflow: result.data };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { workflowId } = await context.params;
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    const { supabase } = await requireWorkflow(scope, workflowId);
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "workflow") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: scope.actorLawyerId };
      for (const key of ["name", "description", "status", "configuration"]) if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
      const result = await supabase.from("firm_workflow_definitions").update(patch).eq("id", workflowId).select("*").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, workflow: result.data });
    }

    if (action === "stage") {
      const stageKey = String(body.stageKey ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      const name = String(body.name ?? "").trim();
      if (!stageKey || !name) return NextResponse.json({ success: false, error: "Stage key and name are required." }, { status: 400 });
      const payload = {
        workflow_id: workflowId,
        stage_key: stageKey,
        name,
        description: body.description ? String(body.description) : null,
        sort_order: Number(body.sortOrder ?? 0),
        stage_type: ["gate","work","review","finance","closure"].includes(String(body.stageType)) ? String(body.stageType) : "work",
        color_token: body.colorToken ? String(body.colorToken) : null,
        required_roles: Array.isArray(body.requiredRoles) ? body.requiredRoles.map(String) : [],
        entry_requirements: body.entryRequirements && typeof body.entryRequirements === "object" ? body.entryRequirements : {},
        exit_requirements: body.exitRequirements && typeof body.exitRequirements === "object" ? body.exitRequirements : {},
        sla_hours: body.slaHours === null || body.slaHours === "" || body.slaHours === undefined ? null : Number(body.slaHours),
        is_terminal: Boolean(body.isTerminal),
        updated_at: new Date().toISOString(),
      };
      const result = await supabase.from("firm_workflow_stages").upsert(payload, { onConflict: "workflow_id,stage_key" }).select("*").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, stage: result.data });
    }

    if (action === "transition") {
      const from = String(body.fromStageKey ?? "").trim();
      const to = String(body.toStageKey ?? "").trim();
      const name = String(body.name ?? "").trim();
      if (!from || !to || !name) return NextResponse.json({ success: false, error: "From, to and transition name are required." }, { status: 400 });
      const payload = {
        workflow_id: workflowId,
        from_stage_key: from,
        to_stage_key: to,
        name,
        allowed_roles: Array.isArray(body.allowedRoles) ? body.allowedRoles.map(String) : [],
        guard_rules: body.guardRules && typeof body.guardRules === "object" ? body.guardRules : {},
        requires_reason: Boolean(body.requiresReason),
        requires_approval: Boolean(body.requiresApproval),
        approval_roles: Array.isArray(body.approvalRoles) ? body.approvalRoles.map(String) : [],
        automation: body.automation && typeof body.automation === "object" ? body.automation : {},
        sort_order: Number(body.sortOrder ?? 0),
        active: body.active !== false,
        updated_at: new Date().toISOString(),
      };
      const result = await supabase.from("firm_workflow_transitions").upsert(payload, { onConflict: "workflow_id,from_stage_key,to_stage_key" }).select("*").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, transition: result.data });
    }

    return NextResponse.json({ success: false, error: "Unsupported workflow edit action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to edit workflow." }, { status: 403 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { workflowId } = await context.params;
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    const { supabase } = await requireWorkflow(scope, workflowId);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (!id || !["stage","transition"].includes(String(kind))) return NextResponse.json({ success: false, error: "Valid kind and id are required." }, { status: 400 });
    const table = kind === "stage" ? "firm_workflow_stages" : "firm_workflow_transitions";
    const result = await supabase.from(table).delete().eq("id", id).eq("workflow_id", workflowId);
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to edit workflow." }, { status: 403 });
  }
}
