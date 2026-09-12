"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, FileCheck2, RefreshCcw, ReceiptText, Scale } from "lucide-react";

type PracticePayload = {
  success: boolean;
  error?: string;
  timeEntries?: Array<Record<string, unknown>>;
  docketEvents?: Array<Record<string, unknown>>;
  reviewEvents?: Array<Record<string, unknown>>;
  reconciliations?: Array<Record<string, unknown>>;
  metrics?: { billableMinutes?: number; estimatedUnbilledXaf?: number };
};

export default function PracticeExecutionPanel({ matterId }: { matterId: string }) {
  const [data, setData] = useState<PracticePayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/matters/${matterId}/practice`, { cache: "no-store" });
    const payload = await response.json();
    setData(payload);
  }, [matterId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(action: string, payload: Record<string, unknown>) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Action failed.");
      setMessage("Saved to the matter execution record.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const money = useMemo(() => new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(data?.metrics?.estimatedUnbilledXaf ?? 0), [data]);

  return (
    <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#0f5b49]"><Scale className="h-5 w-5"/><span className="text-[10px] font-black uppercase tracking-[0.2em]">Practice execution</span></div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Time, docket, review and reconciliation</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Operational records stay attached to the matter and inherit the same firm, matter-member and ethical-wall controls.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><RefreshCcw className="h-4 w-4"/>Refresh</button>
      </div>

      {message ? <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div> : null}
      {!data?.success && data?.error ? <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{data.error}</div> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Clock3} label="Unbilled time" value={`${data?.metrics?.billableMinutes ?? 0} min`} />
        <Metric icon={ReceiptText} label="Estimated unbilled" value={`${money} XAF`} />
        <Metric icon={CalendarClock} label="Docket events" value={String(data?.docketEvents?.length ?? 0)} />
        <Metric icon={FileCheck2} label="Review events" value={String(data?.reviewEvents?.length ?? 0)} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 p-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void submit("time", { description: form.get("description"), minutes: Number(form.get("minutes")), hourlyRateXaf: Number(form.get("rate")), activityType: form.get("activity") });
          event.currentTarget.reset();
        }}>
          <h3 className="font-semibold text-slate-950">Record billable work</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="description" required placeholder="Work performed" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select name="activity" className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="legal_work">Legal work</option><option value="research">Research</option><option value="drafting">Drafting</option><option value="hearing">Hearing</option><option value="client_meeting">Client meeting</option><option value="filing">Filing</option></select>
            <input name="minutes" required min="1" type="number" placeholder="Minutes" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="rate" min="0" type="number" placeholder="Hourly rate XAF" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button disabled={busy === "time"} className="mt-3 rounded-xl bg-[#0f5b49] px-4 py-2 text-sm font-semibold text-white">{busy === "time" ? "Saving…" : "Save time entry"}</button>
        </form>

        <form className="rounded-2xl border border-slate-200 p-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void submit("docket", { eventType: form.get("eventType"), title: form.get("title"), courtOrAuthority: form.get("court"), scheduledAt: form.get("scheduledAt") || null, nextAction: form.get("nextAction") });
          event.currentTarget.reset();
        }}>
          <h3 className="font-semibold text-slate-950">Add docket / hearing event</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select name="eventType" className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="hearing">Hearing</option><option value="filing">Filing</option><option value="service">Service</option><option value="order">Order</option><option value="judgment">Judgment</option><option value="appeal">Appeal</option><option value="meeting">Meeting</option><option value="deadline">Deadline</option></select>
            <input name="title" required placeholder="Event title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="court" placeholder="Court / authority" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="scheduledAt" type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input name="nextAction" placeholder="Next action" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          </div>
          <button disabled={busy === "docket"} className="mt-3 rounded-xl bg-[#0f5b49] px-4 py-2 text-sm font-semibold text-white">{busy === "docket" ? "Saving…" : "Add docket event"}</button>
        </form>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Upcoming docket</h3><div className="mt-3 space-y-2">{(data?.docketEvents ?? []).slice(0,6).map((item) => <RecordRow key={String(item.id)} title={String(item.title ?? "Event")} meta={[item.event_type, item.status, item.scheduled_at ? new Date(String(item.scheduled_at)).toLocaleString() : null].filter(Boolean).join(" • ")} />)}{!(data?.docketEvents?.length) ? <Empty text="No docket events yet."/> : null}</div></div>
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Recent execution record</h3><div className="mt-3 space-y-2">{(data?.timeEntries ?? []).slice(0,6).map((item) => <RecordRow key={String(item.id)} title={String(item.description ?? "Work entry")} meta={`${item.minutes ?? 0} min • ${item.billing_status ?? "unbilled"}`} />)}{!(data?.timeEntries?.length) ? <Empty text="No time entries yet."/> : null}</div></div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><Icon className="h-4 w-4 text-[#0f5b49]"/><p className="mt-3 text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p></div>; }
function RecordRow({ title, meta }: { title: string; meta: string }) { return <div className="rounded-xl border border-slate-100 px-3 py-2"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{text}</p>; }
