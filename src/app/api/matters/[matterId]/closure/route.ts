import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ matterId: string }> };
type DocumentStatusRow = { status: string | null };

async function runtimeFor(request: Request, matterId: string) {
  const scope = await resolveRequestScope(request);
  await assertMatterPermission({ scope, matterId, allowAnyMember: true });
  if (!scope.firmId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const matter = await supabase
    .from("matters")
    .select("id,firm_id,title,status,closed_at")
    .eq("id", matterId)
    .eq("firm_id", scope.firmId)
    .single();
  if (matter.error) throw new Error(matter.error.message);
  return { scope, supabase, matter: matter.data };
}

async function loadClosure(runtime: Awaited<ReturnType<typeof runtimeFor>>, matterId: string) {
  const { supabase } = runtime;
  const [review, openTasks, reconciliation, documents, updates] = await Promise.all([
    supabase.from("matter_closure_reviews").select("*").eq("matter_id", matterId).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("matter_id", matterId).eq("is_completed", false),
    supabase.from("finance_reconciliation_reviews").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("documents").select("id,status").eq("matter_id", matterId),
    supabase.from("matter_client_updates").select("id,status,delivery_status").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [review, openTasks, reconciliation, documents, updates]) {
    if (result.error) throw new Error(result.error.message);
  }
  const documentRows = (documents.data ?? []) as DocumentStatusRow[];
  const documentsArchived = documentRows.every((document) => {
    const status = String(document.status ?? "").toLowerCase();
    return status === "archived" || status === "filed";
  });
  const clientNotified = Boolean(
    updates.data &&
      (["sent", "delivered", "approved"].includes(String(updates.data.status).toLowerCase()) ||
        ["sent", "delivered"].includes(String(updates.data.delivery_status).toLowerCase())),
  );
  return {
    review: review.data,
    openTaskCount: openTasks.count ?? 0,
    latestReconciliation: reconciliation.data,
    documentsArchived,
    clientNotified,
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const runtime = await runtimeFor(request, matterId);
    return NextResponse.json({ success: true, matter: runtime.matter, ...(await loadClosure(runtime, matterId)) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load closure." },
      { status: 403 },
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const runtime = await runtimeFor(request, matterId);
    await assertMatterPermission({ scope: runtime.scope, matterId, permission: "approveFilings" });
    if (!runtime.scope.actorLawyerId) throw new Error("A linked lawyer profile is required.");
    const body = await request.json();
    const action = String(body.action || "save");
    const current = await loadClosure(runtime, matterId);

    if (action === "save") {
      const latestReconciliationApproved = ["approved", "matched"].includes(
        String(current.latestReconciliation?.status ?? "").toLowerCase(),
      );
      const payload = {
        firm_id: runtime.scope.firmId,
        matter_id: matterId,
        outcome_summary: body.outcomeSummary || null,
        client_outcome: body.clientOutcome || null,
        financial_reconciled:
          body.financialReconciled ?? current.review?.financial_reconciled ?? latestReconciliationApproved,
        obligations_resolved: body.obligationsResolved ?? current.review?.obligations_resolved ?? current.openTaskCount === 0,
        documents_archived: body.documentsArchived ?? current.review?.documents_archived ?? current.documentsArchived,
        client_notified: body.clientNotified ?? current.review?.client_notified ?? current.clientNotified,
        knowledge_reviewed: Boolean(body.knowledgeReviewed ?? current.review?.knowledge_reviewed),
        lessons_learned: body.lessonsLearned || current.review?.lessons_learned || null,
        updated_at: new Date().toISOString(),
      };
      const saved = await runtime.supabase
        .from("matter_closure_reviews")
        .upsert(payload, { onConflict: "matter_id" })
        .select("*")
        .single();
      if (saved.error) throw new Error(saved.error.message);
      const refreshed = await loadClosure(runtime, matterId);
      return NextResponse.json({ success: true, ...refreshed, review: saved.data });
    }

    if (action === "approveClose") {
      const check = await loadClosure(runtime, matterId);
      const review = check.review;
      if (!review) return NextResponse.json({ success: false, error: "Closure review is missing." }, { status: 409 });
      const failures: string[] = [];
      if (check.openTaskCount > 0) failures.push("Open tasks remain.");
      if (!review.financial_reconciled) failures.push("Finance is not reconciled.");
      if (!review.obligations_resolved) failures.push("Outstanding obligations remain.");
      if (!review.documents_archived) failures.push("Documents are not fully archived/filed.");
      if (!review.client_notified) failures.push("Client notification is incomplete.");
      if (!review.knowledge_reviewed) failures.push("Knowledge/lessons review is incomplete.");
      if (failures.length) return NextResponse.json({ success: false, error: "Closure gate failed.", failures }, { status: 409 });

      const now = new Date().toISOString();
      const [reviewUpdate, matterUpdate, workflowUpdate] = await Promise.all([
        runtime.supabase.from("matter_closure_reviews").update({ approved_by: runtime.scope.actorLawyerId, approved_at: now, updated_at: now }).eq("matter_id", matterId),
        runtime.supabase.from("matters").update({ status: "Closed", closed_at: now, updated_at: now }).eq("id", matterId).eq("firm_id", runtime.scope.firmId),
        runtime.supabase.from("matter_workflow_instances").update({ status: "completed", current_stage_key: "closed", completed_at: now, updated_at: now }).eq("matter_id", matterId),
      ]);
      for (const result of [reviewUpdate, matterUpdate, workflowUpdate]) {
        if (result.error) throw new Error(result.error.message);
      }
      const event = await runtime.supabase.from("matter_events").insert({
        firm_id: runtime.scope.firmId,
        matter_id: matterId,
        event_type: "MATTER_CLOSED",
        title: "Matter formally closed",
        details: review.outcome_summary || "Matter closure approved after operational, client, document and finance controls.",
        actor_name: runtime.scope.actorName || "Authorized lawyer",
        actor_role: runtime.scope.actorRole || "lawyer",
      });
      if (event.error) throw new Error(event.error.message);
      return NextResponse.json({ success: true, closed: true });
    }

    return NextResponse.json({ success: false, error: "Unsupported closure action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to update closure." },
      { status: 403 },
    );
  }
}
