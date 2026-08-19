"use client";

import { BrainCircuit, CircleDollarSign, FileSearch, MessageSquareCheck, Archive } from "lucide-react";

const items = [
  ["Legal authority provenance", "Store source, citation, verification and proposition before relying on research.", FileSearch],
  ["Governed AI work product", "Record provider/model, source authorities, hashes and human approval state.", BrainCircuit],
  ["Finance ledger", "Separate receivable, revenue, disbursement and client-funds movements.", CircleDollarSign],
  ["Approved dispatch", "Substantive client advice cannot pass to SMTP/WhatsApp without approval.", MessageSquareCheck],
  ["Closure memory", "Matter lessons become institutional memory only after closure controls and lawyer approval.", Archive],
] as const;

export default function WorldClassOperationsPanel() {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-[#f8faf9] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deep governance</p>
      <h2 className="mt-1 text-xl heading-serif text-heritage-green">Source → work → approval → outcome</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map(([title, description, Icon]) => (
          <div key={title} className="rounded-[1.15rem] border border-slate-200 bg-white p-4">
            <Icon className="h-4 w-4 text-heritage-green" />
            <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
