import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/outbox-worker.server";

function authorized(request: Request) {
  const secret = process.env.TSIDEK_CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: "TSIDEK_CRON_SECRET is not configured." };
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-tsidek-cron-secret") ?? "";
  if (provided !== secret) return { ok: false, status: 401, error: "Unauthorized." };
  return { ok: true, status: 200, error: null };
}

export async function POST(request: Request) {
  const guard = authorized(request);
  if (!guard.ok) return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 20;
    const result = await processOutboxBatch(limit);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Outbox processing failed." }, { status: 500 });
  }
}
