import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission, assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ matterId: string }> };

const docketTypes = new Set(["filing","hearing","service","meeting","order","judgment","appeal","deadline","other"]);
const reviewActions = new Set(["submitted_for_review","reviewed","changes_requested","approved","rejected","signed","filed","served","superseded"]);

export async function GET(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const scope = await resolveRequestScope(request);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated matter context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const [time, docket, reviews, recon] = await Promise.all([
      supabase.from("matter_time_entries").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(100),
      supabase.from("matter_docket_events").select("*").eq("matter_id", matterId).order("scheduled_at", { ascending: true }).limit(100),
      supabase.from("document_review_events").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(100),
      supabase.from("finance_reconciliation_reviews").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(40),
    ]);
    for (const result of [time, docket, reviews, recon]) if (result.error) throw new Error(result.error.message);

    const entries = time.data ?? [];
    const billableMinutes = entries.filter((item) => item.billable && item.billing_status === "unbilled").reduce((sum, item) => sum + Number(item.minutes ?? 0), 0);
    const estimatedUnbilledXaf = entries.filter((item) => item.billable && item.billing_status === "unbilled").reduce((sum, item) => sum + Math.round((Number(item.minutes ?? 0) / 60) * Number(item.hourly_rate_xaf ?? 0)), 0);

    return NextResponse.json({
      success: true,
      timeEntries: entries,
      docketEvents: docket.data ?? [],
      reviewEvents: reviews.data ?? [],
      reconciliations: recon.data ?? [],
      metrics: { billableMinutes, estimatedUnbilledXaf },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load practice execution data." }, { status: 403 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { matterId } = await context.params;
    const scope = await resolveRequestScope(request);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated matter context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "time") {
      const minutes = Math.max(0, Number(body.minutes ?? 0));
      if (!body.description || !minutes) return NextResponse.json({ success: false, error: "Description and minutes are required." }, { status: 400 });
      const { data, error } = await supabase.from("matter_time_entries").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        lawyer_id: scope.actorLawyerId,
        activity_type: String(body.activityType ?? "legal_work"),
        description: String(body.description),
        minutes,
        hourly_rate_xaf: body.hourlyRateXaf === undefined || body.hourlyRateXaf === "" ? null : Number(body.hourlyRateXaf),
        billable: body.billable !== false,
        billing_status: body.billable === false ? "non_billable" : "unbilled",
        started_at: body.startedAt || null,
        ended_at: body.endedAt || null,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, entry: data });
    }

    if (action === "docket") {
      await assertMatterPermission({ scope, matterId, permission: "editDeadlines" });
      const eventType = String(body.eventType ?? "other");
      if (!docketTypes.has(eventType) || !body.title) return NextResponse.json({ success: false, error: "Valid event type and title are required." }, { status: 400 });
      const { data, error } = await supabase.from("matter_docket_events").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        event_type: eventType,
        title: String(body.title),
        description: body.description ? String(body.description) : null,
        court_or_authority: body.courtOrAuthority ? String(body.courtOrAuthority) : null,
        venue: body.venue ? String(body.venue) : null,
        scheduled_at: body.scheduledAt || null,
        status: String(body.status ?? "scheduled"),
        filing_reference: body.filingReference ? String(body.filingReference) : null,
        next_action: body.nextAction ? String(body.nextAction) : null,
        responsible_lawyer_id: body.responsibleLawyerId || scope.actorLawyerId,
        created_by: scope.actorLawyerId,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, event: data });
    }

    if (action === "document_review") {
      await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });
      const reviewAction = String(body.reviewAction ?? "");
      if (!reviewActions.has(reviewAction) || !body.documentId) return NextResponse.json({ success: false, error: "Document and review action are required." }, { status: 400 });
      if (["approved","signed","filed","served"].includes(reviewAction)) {
        await assertMatterPermission({ scope, matterId, permission: "approveFilings" });
      }
      const { data, error } = await supabase.from("document_review_events").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        document_id: String(body.documentId),
        action: reviewAction,
        notes: body.notes ? String(body.notes) : null,
        actor_lawyer_id: scope.actorLawyerId,
        version_label: body.versionLabel ? String(body.versionLabel) : null,
        checksum: body.checksum ? String(body.checksum) : null,
      }).select("*").single();
      if (error) throw new Error(error.message);

      const documentPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (reviewAction === "submitted_for_review") documentPatch.review_status = "pending";
      if (reviewAction === "reviewed") documentPatch.review_status = "reviewed";
      if (reviewAction === "changes_requested") documentPatch.review_status = "changes_requested";
      if (reviewAction === "approved") {
        documentPatch.review_status = "approved";
        documentPatch.approved_by = scope.actorLawyerId;
        documentPatch.approved_at = new Date().toISOString();
      }
      if (reviewAction === "filed") documentPatch.filed_at = new Date().toISOString();
      const update = await supabase.from("documents").update(documentPatch).eq("id", body.documentId).eq("matter_id", matterId);
      if (update.error) throw new Error(update.error.message);
      return NextResponse.json({ success: true, review: data });
    }

    if (action === "reconciliation") {
      await assertFirmPermission({ scope, permission: "viewBilling" });
      const expected = Math.round(Number(body.expectedXaf ?? 0));
      const received = Math.round(Number(body.receivedXaf ?? 0));
      const status = received === expected ? "matched" : "variance";
      const { data, error } = await supabase.from("finance_reconciliation_reviews").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        period_start: body.periodStart || null,
        period_end: body.periodEnd || null,
        expected_xaf: expected,
        received_xaf: received,
        status,
        notes: body.notes ? String(body.notes) : null,
        source_summary: body.sourceSummary && typeof body.sourceSummary === "object" ? body.sourceSummary : {},
        prepared_by: scope.actorLawyerId,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, reconciliation: data });
    }

    return NextResponse.json({ success: false, error: "Unsupported practice action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to record practice action." }, { status: 403 });
  }
}
