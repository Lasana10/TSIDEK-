"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, ShieldAlert } from "lucide-react";

type ChangeRequest = { id:string; status:string; reason:string; requested_at:string };

export default function CaseRecordActions({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "archive" | "restore" | "request_remove">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  async function loadRequests() {
    try {
      const response = await fetch(`/api/matters/${matterId}/record-state`, { cache:"no-store", credentials:"include" });
      const payload = await response.json() as { success?:boolean; requests?:ChangeRequest[] };
      if (response.ok && payload.success) setRequests(payload.requests ?? []);
    } catch { /* governance history is advisory to the control itself */ }
  }

  useEffect(() => { void loadRequests(); }, [matterId]);

  async function changeState(action: "archive" | "restore" | "request_remove") {
    let reason = "";
    if (action === "request_remove") {
      reason = window.prompt("Why was this case created by mistake? This request will require Firm Owner / Managing Partner approval.")?.trim() || "";
      if (!reason) return;
      if (reason.length < 8) { setMessage("Please give a clear reason for the removal request."); return; }
    } else {
      const confirmation = action === "archive"
        ? "Archive this case? The full legal record and audit history will be preserved."
        : "Restore this case to active work?";
      if (!window.confirm(confirmation)) return;
    }

    setBusy(action); setMessage(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/record-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to update case record.");
      if (action === "request_remove") {
        setMessage("Removal request submitted. The case remains active until Firm Owner / Managing Partner approval.");
        await loadRequests();
      } else if (action === "restore") {
        router.refresh();
      } else {
        router.push("/matters"); router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update case record.");
    } finally { setBusy(null); }
  }

  const pending = requests.find((item) => item.status === "pending");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => changeState("archive")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          <Archive className="h-4 w-4" /> Archive
        </button>
        <button onClick={() => changeState("restore")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" /> Restore
        </button>
        <button onClick={() => changeState("request_remove")} disabled={busy !== null || Boolean(pending)} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">
          <ShieldAlert className="h-4 w-4" /> {pending ? "Removal approval pending" : "Request removal"}
        </button>
      </div>
      {message ? <p className="mt-3 text-xs font-semibold text-slate-700">{message}</p> : null}
      {pending ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-amber-700">Governance hold</p><p className="mt-1 text-xs leading-5 text-amber-900">Removal requested: {pending.reason}. The case has not been removed.</p></div> : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">Archive preserves the legal record. Removal is reserved for genuinely mistaken empty cases and requires a separate Firm Owner / Managing Partner decision.</p>
    </div>
  );
}
