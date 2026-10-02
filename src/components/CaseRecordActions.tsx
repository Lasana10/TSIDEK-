"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

export default function CaseRecordActions({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "archive" | "restore" | "remove">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function changeState(action: "archive" | "restore" | "remove") {
    const confirmation = action === "remove"
      ? "Remove this mistaken case from active records? This is only allowed when no legal or financial history exists."
      : action === "archive"
        ? "Archive this case? The record and history will be preserved."
        : "Restore this case to active work?";
    if (!window.confirm(confirmation)) return;

    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/record-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to update case record.");
      if (action === "restore") {
        router.refresh();
      } else {
        router.push("/matters");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update case record.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => changeState("archive")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          <Archive className="h-4 w-4" /> Archive
        </button>
        <button onClick={() => changeState("restore")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" /> Restore
        </button>
        <button onClick={() => changeState("remove")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> Remove mistaken case
        </button>
      </div>
      {message ? <p className="mt-3 text-xs font-semibold text-red-700">{message}</p> : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">Archive preserves the full legal record. Removal is blocked once documents, money or legal history exist.</p>
    </div>
  );
}
