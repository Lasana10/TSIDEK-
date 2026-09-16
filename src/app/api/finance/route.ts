import { NextResponse } from "next/server";
import { assertFirmModule, assertFirmPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const WRITE_ROLES = new Set(["owner", "partner", "administrator", "finance"]);

function asMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("A valid non-negative XAF amount is required.");
  return amount;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmModule({ scope, module: "finance" });
    await assertFirmPermission({ scope, permission: "viewBilling" });
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const [invoiceResult, ledgerResult, matterResult] = await Promise.all([
      supabase.from("invoices").select("id,matter_id,invoice_number,description,amount_xaf,paid_xaf,currency,status,issued_at,due_date,created_at,updated_at").eq("firm_id", scope.firmId).order("created_at", { ascending: false }).limit(250),
      supabase.from("finance_ledger_entries").select("id,matter_id,invoice_id,entry_type,amount_xaf,direction,payment_method,reference,description,occurred_at,created_at").eq("firm_id", scope.firmId).order("occurred_at", { ascending: false }).limit(250),
      supabase.from("matters").select("id,title,client_name,status").eq("firm_id", scope.firmId).order("updated_at", { ascending: false }).limit(250),
    ]);
    for (const result of [invoiceResult, ledgerResult, matterResult]) if (result.error) throw new Error(result.error.message);

    const invoices = invoiceResult.data ?? [];
    const ledger = ledgerResult.data ?? [];
    const matters = matterResult.data ?? [];
    const billed = invoices.reduce((sum, row) => sum + Number(row.amount_xaf ?? 0), 0);
    const paidOnInvoices = invoices.reduce((sum, row) => sum + Number(row.paid_xaf ?? 0), 0);
    const cashIn = ledger.filter((row) => row.direction === "in").reduce((sum, row) => sum + Number(row.amount_xaf ?? 0), 0);
    const cashOut = ledger.filter((row) => row.direction === "out").reduce((sum, row) => sum + Number(row.amount_xaf ?? 0), 0);
    const outstanding = invoices.reduce((sum, row) => sum + Math.max(0, Number(row.amount_xaf ?? 0) - Number(row.paid_xaf ?? 0)), 0);
    const overdue = invoices.filter((row) => row.due_date && new Date(row.due_date).getTime() < Date.now() && !["paid", "settled", "cancelled", "void"].includes(String(row.status ?? "").toLowerCase()));

    return NextResponse.json({
      success: true,
      actorRole: scope.actorRole,
      writable: WRITE_ROLES.has(String(scope.actorRole ?? "").toLowerCase()),
      metrics: { billed, paidOnInvoices, cashIn, cashOut, outstanding, overdueCount: overdue.length },
      invoices,
      ledger,
      matters,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load finance." }, { status: statusForApiError(error) });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmModule({ scope, module: "finance" });
    await assertFirmPermission({ scope, permission: "viewBilling" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const role = String(scope.actorRole ?? "").toLowerCase();
    if (!WRITE_ROLES.has(role)) throw new Error("Permission denied: finance write access is required for this action.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "createInvoice") {
      const matterId = String(body.matterId ?? "").trim();
      if (!matterId) return NextResponse.json({ success: false, error: "Matter is required." }, { status: 400 });
      const matter = await supabase.from("matters").select("id").eq("id", matterId).eq("firm_id", scope.firmId).maybeSingle();
      if (matter.error) throw new Error(matter.error.message);
      if (!matter.data) throw new Error("Matter not found in the active firm.");
      const amount = asMoney(body.amountXaf);
      const issuedAt = body.issuedAt ? String(body.issuedAt) : new Date().toISOString();
      const invoiceNumber = String(body.invoiceNumber ?? "").trim() || `TSK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const created = await supabase.from("invoices").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        invoice_number: invoiceNumber,
        description: String(body.description ?? "Legal fees").trim() || "Legal fees",
        amount_xaf: amount,
        paid_xaf: 0,
        currency: "XAF",
        status: "issued",
        issued_at: issuedAt,
        due_date: body.dueDate ? String(body.dueDate) : null,
        created_by: scope.actorLawyerId,
      }).select("*").single();
      if (created.error) throw new Error(created.error.message);
      return NextResponse.json({ success: true, invoice: created.data }, { status: 201 });
    }

    if (action === "recordEntry") {
      const entryType = String(body.entryType ?? "payment");
      const allowed = new Set(["payment", "expense", "disbursement", "receipt", "adjustment"]);
      if (!allowed.has(entryType)) return NextResponse.json({ success: false, error: "Unsupported finance entry type." }, { status: 400 });
      const direction = entryType === "payment" || entryType === "receipt" ? "in" : String(body.direction ?? "out") === "in" ? "in" : "out";
      const invoiceId = body.invoiceId ? String(body.invoiceId) : null;
      const matterId = body.matterId ? String(body.matterId) : null;
      const amount = asMoney(body.amountXaf);
      const created = await supabase.from("finance_ledger_entries").insert({
        firm_id: scope.firmId,
        matter_id: matterId,
        invoice_id: invoiceId,
        entry_type: entryType,
        amount_xaf: amount,
        direction,
        payment_method: body.paymentMethod ? String(body.paymentMethod).trim() : null,
        reference: body.reference ? String(body.reference).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        occurred_at: body.occurredAt ? String(body.occurredAt) : new Date().toISOString(),
        created_by: scope.actorLawyerId,
      }).select("*").single();
      if (created.error) throw new Error(created.error.message);

      if (invoiceId && direction === "in") {
        const invoice = await supabase.from("invoices").select("id,amount_xaf,paid_xaf").eq("id", invoiceId).eq("firm_id", scope.firmId).maybeSingle();
        if (invoice.error) throw new Error(invoice.error.message);
        if (invoice.data) {
          const nextPaid = Number(invoice.data.paid_xaf ?? 0) + amount;
          const nextStatus = nextPaid >= Number(invoice.data.amount_xaf ?? 0) ? "paid" : "part_paid";
          const updated = await supabase.from("invoices").update({ paid_xaf: nextPaid, status: nextStatus, updated_at: new Date().toISOString() }).eq("id", invoiceId).eq("firm_id", scope.firmId);
          if (updated.error) throw new Error(updated.error.message);
        }
      }
      return NextResponse.json({ success: true, entry: created.data }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: "Unsupported finance action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update finance." }, { status: statusForApiError(error) });
  }
}
