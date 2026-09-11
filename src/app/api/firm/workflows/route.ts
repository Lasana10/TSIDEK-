import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const workflows = await supabase
      .from("firm_workflow_definitions")
      .select("id,workflow_key,name,subject_type,description,status,version,configuration,updated_at")
      .eq("firm_id", scope.firmId)
      .order("workflow_key")
      .order("version", { ascending: false });
    if (workflows.error) throw new Error(workflows.error.message);

    const workflowIds = (workflows.data ?? []).map((item) => item.id);
    if (!workflowIds.length) return NextResponse.json({ success: true, workflows: [] });

    const [stages, transitions] = await Promise.all([
      supabase.from("firm_workflow_stages").select("*").in("workflow_id", workflowIds).order("sort_order"),
      supabase.from("firm_workflow_transitions").select("*").in("workflow_id", workflowIds).order("sort_order"),
    ]);
    if (stages.error) throw new Error(stages.error.message);
    if (transitions.error) throw new Error(transitions.error.message);

    return NextResponse.json({
      success: true,
      workflows: (workflows.data ?? []).map((workflow) => ({
        ...workflow,
        stages: (stages.data ?? []).filter((stage) => stage.workflow_id === workflow.id),
        transitions: (transitions.data ?? []).filter((transition) => transition.workflow_id === workflow.id),
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load workflows." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const workflowKey = String(body.workflowKey ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!name || !workflowKey) return NextResponse.json({ success: false, error: "Workflow name and key are required." }, { status: 400 });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const { data: current } = await supabase.from("firm_workflow_definitions")
      .select("version").eq("firm_id", scope.firmId).eq("workflow_key", workflowKey).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(current?.version ?? 0) + 1;

    const { data, error } = await supabase.from("firm_workflow_definitions").insert({
      firm_id: scope.firmId,
      workflow_key: workflowKey,
      name,
      subject_type: body.subjectType === "prospect" || body.subjectType === "engagement" ? body.subjectType : "matter",
      description: body.description ? String(body.description) : null,
      status: body.status === "active" ? "active" : "draft",
      version,
      configuration: body.configuration && typeof body.configuration === "object" ? body.configuration : {},
      created_by: scope.actorLawyerId,
      updated_by: scope.actorLawyerId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, workflow: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create workflow." }, { status: 403 });
  }
}
