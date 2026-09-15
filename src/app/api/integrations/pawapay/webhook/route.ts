import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveFirmProviderCredentials } from "@/lib/tenant-integrations.server";
import { PaymentService } from "@/lib/payment-service/pawapay";

function eventKey(raw: string, depositId: string) {
  return createHash("sha256").update(`${depositId}:${raw}`).digest("hex");
}

function extractDepositId(payload: Record<string, unknown>) {
  const candidates = [payload.depositId, payload.deposit_id, payload.id, (payload.data as Record<string, unknown> | undefined)?.depositId];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProviderStatus(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function isSuccess(status: string) {
  return ["COMPLETED","SUCCESSFUL","SUCCEEDED"].includes(status);
}

function isFailure(status: string) {
  return ["FAILED","REJECTED","CANCELLED","EXPIRED"].includes(status);
}

export async function POST(request: Request) {
  const raw = await request.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw || "{}") as Record<string, unknown>; }
  catch { return NextResponse.json({ success:false, error:"Invalid JSON payload." }, { status:400 }); }

  const depositId = extractDepositId(payload);
  if (!depositId) return NextResponse.json({ success:false, error:"Missing depositId." }, { status:400 });

  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success:false, error:"Server database configuration missing." }, { status:500 });

  const key = eventKey(raw, depositId);
  const existing = await supabase.from("payment_provider_events").select("id,processed_at").eq("provider","PAWAPAY").eq("provider_event_key",key).maybeSingle();
  if (existing.error) return NextResponse.json({ success:false, error:existing.error.message }, { status:500 });
  if (existing.data?.processed_at) return NextResponse.json({ success:true, duplicate:true });

  const paymentResult = await supabase.from("matter_payments").select("*,matters(client_name)").eq("provider","PAWAPAY").eq("provider_reference",depositId).maybeSingle();
  if (paymentResult.error) return NextResponse.json({ success:false, error:paymentResult.error.message }, { status:500 });
  if (!paymentResult.data) return NextResponse.json({ success:false, error:"Unknown pawaPay deposit reference." }, { status:404 });
  const payment = paymentResult.data;

  const eventInsert = await supabase.from("payment_provider_events").upsert({
    provider:"PAWAPAY", provider_event_key:key, provider_reference:depositId,
    firm_id:payment.firm_id, matter_id:payment.matter_id, payment_id:payment.id,
    event_status:String(payload.status || payload.event || "received"), payload,
  }, { onConflict:"provider,provider_event_key" }).select("id").single();
  if (eventInsert.error) return NextResponse.json({ success:false, error:eventInsert.error.message }, { status:500 });

  try {
    const tenantCredentials = await resolveFirmProviderCredentials(payment.firm_id, "pawapay");
    const providerState = await PaymentService.checkDepositStatus(depositId, tenantCredentials ? {
      apiToken: tenantCredentials.apiToken,
      apiKey: tenantCredentials.apiKey,
      environment: tenantCredentials.environment,
      apiUrl: tenantCredentials.apiUrl,
    } : undefined) as Record<string, unknown>;
    const status = normalizeProviderStatus(providerState.status ?? providerState.depositStatus ?? providerState.state);
    const mergedPayload = { ...(payment.provider_payload ?? {}), webhook: payload, provider_state: providerState };

    if (isSuccess(status) && payment.status !== "Confirmed") {
      const receivedAt = new Date().toISOString();
      const update = await supabase.from("matter_payments").update({ status:"Confirmed", provider_status:status, provider_payload:mergedPayload, received_at:receivedAt, updated_at:receivedAt }).eq("id",payment.id);
      if (update.error) throw new Error(update.error.message);

      const ledger = await supabase.from("finance_ledger_entries").upsert({
        firm_id:payment.firm_id,matter_id:payment.matter_id,entry_type:"PAYMENT",source_table:"matter_payments",source_id:payment.id,
        amount_xaf:payment.amount_xaf,direction:"CREDIT",account_bucket:payment.account_type==="Client funds"?"CLIENT_FUNDS":"OPERATING",
        status:"POSTED",description:"Confirmed mobile-money payment via pawaPay",provider_reference:depositId,
      },{onConflict:"firm_id,source_table,source_id,entry_type"});
      if (ledger.error) throw new Error(ledger.error.message);

      const receiptExists = await supabase.from("payment_receipts").select("id").eq("payment_id",payment.id).maybeSingle();
      if (receiptExists.error) throw new Error(receiptExists.error.message);
      if (!receiptExists.data) {
        const receiptNo = await supabase.rpc("next_firm_document_number",{p_firm_id:payment.firm_id,p_prefix:"RCT",p_table:"receipt"});
        if (receiptNo.error) throw new Error(receiptNo.error.message);
        const receipt = await supabase.from("payment_receipts").insert({
          firm_id:payment.firm_id,matter_id:payment.matter_id,payment_id:payment.id,receipt_number:receiptNo.data,
          amount_xaf:payment.amount_xaf,issued_to:payment.matters?.client_name ?? null,
          metadata:{provider:"PAWAPAY",provider_reference:depositId,provider_status:status}
        });
        if (receipt.error) throw new Error(receipt.error.message);
      }

      if (payment.invoice_id) {
        const inv = await supabase.from("invoices").select("id,amount_xaf,paid_xaf").eq("id",payment.invoice_id).single();
        if (inv.error) throw new Error(inv.error.message);
        const nextPaid = Number(inv.data.paid_xaf||0)+Number(payment.amount_xaf||0);
        const invoiceUpdate = await supabase.from("invoices").update({ paid_xaf:nextPaid,status:nextPaid>=Number(inv.data.amount_xaf)?"Paid":"Partial",updated_at:receivedAt }).eq("id",inv.data.id);
        if (invoiceUpdate.error) throw new Error(invoiceUpdate.error.message);
      }
    } else if (isFailure(status) && payment.status !== "Confirmed") {
      const failed = await supabase.from("matter_payments").update({ status:"Failed", provider_status:status, provider_payload:mergedPayload, updated_at:new Date().toISOString() }).eq("id",payment.id);
      if (failed.error) throw new Error(failed.error.message);
    } else {
      const pending = await supabase.from("matter_payments").update({ provider_status:status || "PENDING", provider_payload:mergedPayload, updated_at:new Date().toISOString() }).eq("id",payment.id);
      if (pending.error) throw new Error(pending.error.message);
    }

    const processed = await supabase.from("payment_provider_events").update({ processed_at:new Date().toISOString(),event_status:status || "PENDING",processing_error:null }).eq("id",eventInsert.data.id);
    if (processed.error) throw new Error(processed.error.message);
    return NextResponse.json({ success:true, depositId, status:status || "PENDING" });
  } catch (error) {
    await supabase.from("payment_provider_events").update({ processing_error:error instanceof Error?error.message:"Payment reconciliation failed" }).eq("id",eventInsert.data.id);
    return NextResponse.json({ success:false, error:error instanceof Error?error.message:"Payment reconciliation failed." }, { status:500 });
  }
}
