import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const GOVERNOR_ROLES = new Set(["owner", "partner", "administrator"]);
const FINANCE_ROLES = new Set(["owner", "partner", "administrator", "finance"]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId || !scope.actorLawyerId) {
      return NextResponse.json({ success: false, error: "Authenticated firm context is required." }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const membershipResult = await supabase
      .from("firm_memberships")
      .select("role_key,title,status")
      .eq("firm_id", scope.firmId)
      .eq("user_id", scope.actorLawyerId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipResult.error) throw new Error(membershipResult.error.message);

    const role = membershipResult.data?.role_key ?? String(scope.actorRole ?? "lawyer").toLowerCase();
    const isGovernor = GOVERNOR_ROLES.has(role);
    const canSeeFinance = FINANCE_ROLES.has(role);

    const matterQuery = supabase
      .from("matters")
      .select("id,title,client_name,status,risk_level,matter_type,jurisdiction,procedural_stage,confidentiality_level,lead_lawyer_id,opened_at,updated_at")
      .eq("firm_id", scope.firmId)
      .order("updated_at", { ascending: false })
      .limit(40);

    const [matterResult, prospectResult] = await Promise.all([
      matterQuery,
      supabase
        .from("prospects")
        .select("id,prospect_name,status,risk_level,conflict_status,engagement_status,responsible_lawyer_id,created_at")
        .eq("firm_id", scope.firmId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (matterResult.error) throw new Error(matterResult.error.message);
    if (prospectResult.error) throw new Error(prospectResult.error.message);

    const allMatters = matterResult.data ?? [];
    let accessibleMatters = allMatters;
    if (!isGovernor) {
      const { data: memberships, error } = await supabase
        .from("matter_members")
        .select("matter_id")
        .eq("lawyer_id", scope.actorLawyerId);
      if (error) throw new Error(error.message);
      const assigned = new Set((memberships ?? []).map((item) => item.matter_id));
      accessibleMatters = allMatters.filter((matter) => matter.lead_lawyer_id === scope.actorLawyerId || assigned.has(matter.id));
    }

    const matterIds = accessibleMatters.map((matter) => matter.id);
    const empty = Promise.resolve({ data: [], error: null });
    const taskPromise = matterIds.length
      ? supabase.from("tasks").select("id,matter_id,assigned_to,title,deadline,status,is_completed,created_at").in("matter_id", matterIds).order("deadline", { ascending: true }).limit(100)
      : empty;
    const documentPromise = matterIds.length
      ? supabase.from("documents").select("id,matter_id,title,document_type,status,review_status,version_label,created_at,updated_at").in("matter_id", matterIds).order("updated_at", { ascending: false }).limit(60)
      : empty;
    const clientUpdatePromise = matterIds.length
      ? supabase.from("matter_client_updates").select("id,matter_id,title,status,delivery_status,instruction_required,instruction_status,created_at").in("matter_id", matterIds).order("created_at", { ascending: false }).limit(40)
      : empty;
    const closurePromise = matterIds.length
      ? supabase.from("matter_closure_reviews").select("id,matter_id,financial_reconciled,obligations_resolved,documents_archived,client_notified,knowledge_reviewed,approved_at,updated_at").in("matter_id", matterIds)
      : empty;
    const invoicePromise = canSeeFinance && matterIds.length
      ? supabase.from("invoices").select("id,matter_id,amount_xaf,status,due_date,created_at").in("matter_id", matterIds).order("created_at", { ascending: false }).limit(80)
      : empty;

    const [taskResult, documentResult, clientUpdateResult, closureResult, invoiceResult] = await Promise.all([
      taskPromise,
      documentPromise,
      clientUpdatePromise,
      closurePromise,
      invoicePromise,
    ]);
    for (const result of [taskResult, documentResult, clientUpdateResult, closureResult, invoiceResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const tasks = taskResult.data ?? [];
    const documents = documentResult.data ?? [];
    const updates = clientUpdateResult.data ?? [];
    const closures = closureResult.data ?? [];
    const invoices = invoiceResult.data ?? [];
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

    const myTasks = tasks.filter((task) => isGovernor || !task.assigned_to || task.assigned_to === scope.actorLawyerId);
    const openTasks = myTasks.filter((task) => !task.is_completed && String(task.status ?? "").toLowerCase() !== "completed");
    const urgentTasks = openTasks.filter((task) => task.deadline && new Date(task.deadline).getTime() <= sevenDays);
    const reviewQueue = documents.filter((doc) => ["pending", "draft", "needs_review", "under_review"].includes(String(doc.review_status ?? doc.status ?? "").toLowerCase()));
    const pendingClientUpdates = updates.filter((item) => !["sent", "delivered", "acknowledged"].includes(String(item.delivery_status ?? item.status ?? "").toLowerCase()));
    const openProspects = (prospectResult.data ?? []).filter((prospect) => !["rejected", "converted", "closed"].includes(String(prospect.status ?? "").toLowerCase()));
    const outstandingInvoices = invoices.filter((invoice) => !["paid", "settled", "cancelled", "void"].includes(String(invoice.status ?? "").toLowerCase()));
    const outstandingXaf = outstandingInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_xaf ?? 0), 0);

    return NextResponse.json({
      success: true,
      identity: {
        actorName: scope.actorName,
        actorRole: role,
        title: membershipResult.data?.title ?? null,
        firmId: scope.firmId,
      },
      capabilities: {
        governor: isGovernor,
        finance: canSeeFinance,
        studio: isGovernor,
        ethicalWalls: isGovernor,
        approvals: ["owner", "partner"].includes(role),
        clientAccess: !["intern", "finance"].includes(role),
        aiReview: ["owner", "partner", "knowledge_manager"].includes(role),
      },
      metrics: {
        activeMatters: accessibleMatters.filter((matter) => !["closed", "archived"].includes(String(matter.status ?? "").toLowerCase())).length,
        highRiskMatters: accessibleMatters.filter((matter) => ["high", "critical"].includes(String(matter.risk_level ?? "").toLowerCase())).length,
        openIntake: openProspects.length,
        openTasks: openTasks.length,
        urgentTasks: urgentTasks.length,
        reviewQueue: reviewQueue.length,
        pendingClientUpdates: pendingClientUpdates.length,
        outstandingInvoices: outstandingInvoices.length,
        outstandingXaf,
      },
      queues: {
        matters: accessibleMatters.slice(0, 12),
        tasks: openTasks.slice(0, 12),
        documents: reviewQueue.slice(0, 10),
        intake: openProspects.slice(0, 10),
        clientUpdates: pendingClientUpdates.slice(0, 10),
        closures: closures.slice(0, 10),
        invoices: outstandingInvoices.slice(0, 10),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load operating workspace." }, { status: 500 });
  }
}
