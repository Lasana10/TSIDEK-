import { createServerSupabaseClient } from "@/lib/supabase-server";
import { deliverMatterUpdate } from "@/lib/communications";

type OutboxRow = {
  id: string;
  firm_id: string;
  matter_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
};

function retryDelaySeconds(attempt: number) {
  return Math.min(3600, Math.max(30, 30 * 2 ** Math.max(0, attempt - 1)));
}

async function processEvent(event: OutboxRow) {
  if (event.event_type === "client.update.delivery") {
    if (!event.matter_id) throw new Error("Client update delivery requires a matter_id.");
    const channel = String(event.payload.channel ?? "In-App") as "Email" | "WhatsApp" | "SMS" | "In-App";
    const title = String(event.payload.title ?? "Matter update");
    const message = String(event.payload.message ?? "");
    if (!message.trim()) throw new Error("Client update delivery requires a message.");
    const result = await deliverMatterUpdate({ matterId: event.matter_id, channel, title, message });
    if (!result.delivered && channel !== "In-App") throw new Error(result.note);
    return { delivery: result };
  }

  throw new Error(`Unsupported outbox event type: ${event.event_type}`);
}

export async function processOutboxBatch(limit = 20) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase service credentials are required for the outbox worker.");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("domain_outbox_events")
    .select("id,firm_id,matter_id,event_type,payload,attempts")
    .in("status", ["pending", "failed"])
    .lte("available_at", now)
    .order("available_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new Error(error.message);

  const events = (data ?? []) as OutboxRow[];
  const results: Array<{ id: string; status: "delivered" | "failed" | "dead_letter"; error?: string }> = [];

  for (const event of events) {
    const claim = await supabase
      .from("domain_outbox_events")
      .update({ status: "processing", locked_at: new Date().toISOString(), locked_by: "tsidek-outbox-worker", attempts: event.attempts + 1 })
      .eq("id", event.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;

    try {
      await processEvent(event);
      await supabase.from("domain_outbox_events").update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error: null,
      }).eq("id", event.id);
      results.push({ id: event.id, status: "delivered" });
    } catch (error) {
      const attempts = event.attempts + 1;
      const terminal = attempts >= 5;
      const message = error instanceof Error ? error.message : "Outbox delivery failed.";
      const availableAt = new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString();
      await supabase.from("domain_outbox_events").update({
        status: terminal ? "dead_letter" : "failed",
        available_at: availableAt,
        locked_at: null,
        locked_by: null,
        last_error: message.slice(0, 1000),
      }).eq("id", event.id);
      results.push({ id: event.id, status: terminal ? "dead_letter" : "failed", error: message });
    }
  }

  return { processed: results.length, results };
}
