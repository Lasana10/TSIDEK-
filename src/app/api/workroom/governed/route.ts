import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { assertFirmPermission } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId || !scope.actorLawyerId) {
      throw new Error("Authenticated firm context is required.");
    }
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    let manageFirm = false;
    try {
      await assertFirmPermission({ scope, permission: "manageFirm" });
      manageFirm = true;
    } catch {
      manageFirm = false;
    }

    const mattersResult = await supabase
      .from("matters")
      .select("id,title,client_name,status,risk_level,lead_lawyer_id,engagement_nature,plan_label")
      .eq("firm_id", scope.firmId)
      .eq("record_state", "active")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (mattersResult.error) throw new Error(mattersResult.error.message);

    let matters = mattersResult.data ?? [];
    if (!manageFirm) {
      const memberships = await supabase
        .from("matter_members")
        .select("matter_id")
        .eq("lawyer_id", scope.actorLawyerId);
      if (memberships.error) throw new Error(memberships.error.message);
      const memberMatterIds = new Set((memberships.data ?? []).map((item) => item.matter_id));
      matters = matters.filter((matter) => matter.lead_lawyer_id === scope.actorLawyerId || memberMatterIds.has(matter.id));
    }

    const matterIds = matters.map((matter) => matter.id);
    if (!matterIds.length) {
      return NextResponse.json({ success: true, matters: [], decisions: [], executions: [], instructions: [], handoffs: [], milestones: [] });
    }

    const [decisions, executions, instructions, handoffs, milestones] = await Promise.all([
      supabase.from("matter_decisions").select("id,matter_id,title,decision,status,authority_level,created_at").in("matter_id", matterIds).order("created_at", { ascending: false }).limit(300),
      supabase.from("matter_execution_actions").select("id,matter_id,title,status,execution_mode,target_system,due_at,created_at").in("matter_id", matterIds).order("created_at", { ascending: false }).limit(300),
      supabase.from("matter_client_instructions").select("id,matter_id,instruction,confirmation_status,received_at").in("matter_id", matterIds).order("received_at", { ascending: false }).limit(300),
      supabase.from("matter_handoffs").select("id,matter_id,purpose,status,external_professional,created_at").in("matter_id", matterIds).order("created_at", { ascending: false }).limit(300),
      supabase.from("matter_milestones").select("id,matter_id,title,status,due_at,sequence_no").in("matter_id", matterIds).order("sequence_no", { ascending: true }).limit(500),
    ]);
    for (const result of [decisions, executions, instructions, handoffs, milestones]) {
      if (result.error) throw new Error(result.error.message);
    }

    return NextResponse.json({
      success: true,
      matters,
      decisions: decisions.data ?? [],
      executions: executions.data ?? [],
      instructions: instructions.data ?? [],
      handoffs: handoffs.data ?? [],
      milestones: milestones.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load governed Workroom context." },
      { status: 403 },
    );
  }
}
