"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";

type Controls = {
  obligations: any[];
  approvals: any[];
  documents: any[];
  communications: any[];
};

export default function MatterControlDesk({ matterId }: { matterId: string }) {
  const [controls, setControls] = useState<Controls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/controls`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to load controls.");
      setControls(data.controls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load controls.");
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-sm text-slate-500">
      <div className="flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading governed controls…</div>
    </div>;
  }

  if (error || !controls) {
    return <div className="rounded-[1.6rem] border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-semibold text-red-900">Controls unavailable</p>
      <p className="mt-1 text-sm text-red-800">{error}</p>
      <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-900">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>;
  }

  const cards = [
    { label: "Obligations", value: controls.obligations.filter(x => !["SATISFIED","WAIVED","CANCELLED"].includes(x.status)).length, icon: CalendarClock },
    { label: "Pending approvals", value: controls.approvals.filter(x => x.status === "PENDING").length, icon: BadgeCheck },
    { label: "Authoritative docs", value: controls.documents.filter(x => ["APPROVED","ISSUED","FILED","SENT"].includes(x.lifecycle_state)).length, icon: FileCheck2 },
    { label: "Open communications", value: controls.communications.filter(x => !["DELIVERED","ACKNOWLEDGED","REPLIED"].includes(x.lifecycle_state)).length, icon: MessageSquareText },
  ];

  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Governed controls</p>
          <h2 className="mt-1 text-xl heading-serif text-heritage-green">Operational control desk</h2>
        </div>
        <button onClick={() => void load()} className="rounded-full border border-slate-200 p-2 text-slate-500">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[1.2rem] bg-slate-50 p-4">
            <Icon className="h-4 w-4 text-heritage-green" />
            <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
