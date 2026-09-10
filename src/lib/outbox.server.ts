import { createHash, randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function enqueueClientUpdateDelivery(input: {
  scope: RequestScope;
  matterId: string;
  communicationId?: string | null;
  channel: "Email" | "WhatsApp" | "SMS" | "In-app";
  title: string;
  message: string;
}) {
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  if (!input.message.trim()) throw new Error("A delivery message is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");

  const nonce = input.communicationId || randomUUID();
  const idempotencyKey = `client-update:${input.matterId}:${nonce}:${digest(`${input.channel}:${input.title}:${input.message}`).slice(0, 24)}`;
  const { data, error } = await supabase.from("domain_outbox_events").upsert({
    firm_id: input.scope.firmId,
    matter_id: input.matterId,
    event_type: "client.update.delivery",
    aggregate_type: "matter_communication",
    aggregate_id: input.communicationId ?? null,
    payload: {
      channel: input.channel,
      title: input.title,
      message: input.message,
      communicationId: input.communicationId ?? null,
      requestedBy: input.scope.actorLawyerId,
    },
    status: "pending",
    idempotency_key: idempotencyKey,
    available_at: new Date().toISOString(),
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id,status,idempotency_key").maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { id: null, status: "pending", idempotency_key: idempotencyKey };
}
