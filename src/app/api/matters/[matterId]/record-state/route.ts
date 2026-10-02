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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, permission: "approveFilings" });

    const body = await request.json();
    const action = String(body.action ?? "");
    if (!['archive', 'restore', 'remove'].includes(action)) {
      return NextResponse.json({ success: false, error: "Unsupported record-state action." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase persistence is required.");

    if (action === "remove") {
      const dependencyCounts: Record<string, number> = {};
      for (const [table, column] of removableDependencyChecks) {
        const result = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, matterId);
        if (result.error) throw new Error(result.error.message);
        dependencyCounts[table] = result.count ?? 0;
      }
      const linkedRecords = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);
      if (linkedRecords > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "This case already has legal or financial history. Archive it instead of removing it.",
            dependencyCounts,
          },
          { status: 409 }
        );
      }
    }

    const nextState = action === "restore" ? "active" : action === "archive" ? "archived" : "deleted";
    const reason = String(body.reason ?? "").trim() || (action === "remove" ? "Created by mistake" : null);
    const update = await supabase
      .from("matters")
      .update({
        record_state: nextState,
        record_state_reason: reason,
        record_state_at: nextState === "active" ? null : new Date().toISOString(),
        record_state_by: scope.actorLawyerId ?? null,
      })
      .eq("id", matterId)
      .select("id,record_state,record_state_reason")
      .single();

    if (update.error) throw new Error(update.error.message);

    await supabase.from("matter_events").insert({
      matter_id: matterId,
      event_type: `MATTER_${nextState.toUpperCase()}`,
      actor_name: scope.actorName,
      reason,
      metadata: { recordState: nextState },
    });

    return NextResponse.json({ success: true, matter: update.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to update case record state." },
      { status: statusForApiError(error) }
    );
  }
}
