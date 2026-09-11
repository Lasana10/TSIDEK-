"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, Building2, CheckCircle2, Clock3, FileCheck2, FileText, Landmark, Receipt, ShieldCheck, Sparkles, Users } from "lucide-react";

type WorkspacePayload = {
  success: boolean;
  error?: string;
  identity?: { actorName?: string | null; actorRole?: string | null; title?: string | null; firmId?: string | null };
  capabilities?: Record<string, boolean>;
  metrics?: Record<string, number>;
  queues?: Record<string, any[]>;
};

const money = (value: number) => new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(value || 0) + " XAF";

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspace", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch((error) => setData({ success: false, error: error instanceof Error ? error.message : "Unable to load workspace." }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-slate-700">Loading legal operating workspace…</main>;
  if (!data?.success) return <main className="min-h-screen bg-slate-50 p-6 text-slate-700"><div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8"><AlertTriangle className="h-6 w-6 text-red-600"/><h1 className="mt-4 text-2xl font-semibold">Workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{data?.error}</p><Link href="/auth" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open access</Link></div></main>;

  const q = data.queues ?? {};
  const m = data.metrics ?? {};
  const role = data.identity?.actorRole ?? "lawyer";

  const cards = [
    ["Active matters", m.activeMatters ?? 0, BriefcaseBusiness],
    ["Urgent tasks", m.urgentTasks ?? 0, Clock3],
    ["Review queue", m.reviewQueue ?? 0, FileCheck2],
    ["Open intake", m.openIntake ?? 0, Users],
    ["Client updates", m.pendingClientUpdates ?? 0, Landmark],
    ["High-risk matters", m.highRiskMatters ?? 0, ShieldCheck],
  ] as const;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f2_100%)] p-4 text-slate-800 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-[#082b22] p-6 text-white shadow-[0_24px_60px_rgba(0,43,34,0.18)] md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/70"><Sparkles className="h-3.5 w-3.5"/>Role-native command workspace</div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{data.identity?.title || role}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">A single operational surface for intake, matters, deadlines, evidence, review, client service, finance, closure and knowledge—scoped by the same firm and matter authorization model.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link href="/intake" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#082b22]">New intake</Link>
              <Link href="/studio" className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white">Firm Studio</Link>
              <Link href="/" className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white">Firm cockpit</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map(([label, value, Icon]) => <div key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-[#0f5b49]"/><p className="mt-4 text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p></div>)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <Queue title="Matter command" icon={BriefcaseBusiness} empty="No accessible matters yet." rows={(q.matters ?? []).map((item: any) => ({ id:item.id, title:item.title, subtitle:[item.client_name,item.matter_type,item.procedural_stage].filter(Boolean).join(" • "), badge:item.status, href:`/matters/${item.id}` }))}/>
            <Queue title="Work queue" icon={Clock3} empty="No open tasks." rows={(q.tasks ?? []).map((item: any) => ({ id:item.id, title:item.title, subtitle:item.deadline ? `Due ${new Date(item.deadline).toLocaleString()}` : "No deadline", badge:item.status || "open", href:item.matter_id ? `/matters/${item.matter_id}` : undefined }))}/>
            <Queue title="Drafting & review" icon={FileText} empty="No documents awaiting review." rows={(q.documents ?? []).map((item: any) => ({ id:item.id, title:item.title, subtitle:[item.document_type,item.version_label].filter(Boolean).join(" • "), badge:item.review_status || item.status, href:item.matter_id ? `/matters/${item.matter_id}` : undefined }))}/>
          </div>

          <div className="space-y-5">
            <Queue title="Intake & conflict" icon={Users} empty="No open intake." rows={(q.intake ?? []).map((item: any) => ({ id:item.id, title:item.prospect_name, subtitle:`Conflict: ${item.conflict_status || "pending"} • Engagement: ${item.engagement_status || "pending"}`, badge:item.risk_level || item.status, href:"/intake" }))}/>
            <Queue title="Client service" icon={Landmark} empty="No client updates pending." rows={(q.clientUpdates ?? []).map((item: any) => ({ id:item.id, title:item.title, subtitle:item.instruction_required ? `Instruction: ${item.instruction_status || "pending"}` : "No instruction required", badge:item.delivery_status || item.status, href:item.matter_id ? `/matters/${item.matter_id}` : undefined }))}/>
            {data.capabilities?.finance ? <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Receipt className="h-5 w-5 text-[#0f5b49]"/><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Finance command</p><h2 className="text-xl font-semibold text-slate-950">Outstanding {money(m.outstandingXaf ?? 0)}</h2></div></div><p className="mt-3 text-sm text-slate-600">{m.outstandingInvoices ?? 0} invoice(s) require collection, reconciliation or closure review.</p><div className="mt-4 space-y-2">{(q.invoices ?? []).slice(0,5).map((item:any)=><Link key={item.id} href={`/matters/${item.matter_id}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"><span>{money(Number(item.amount_xaf||0))}</span><span className="text-xs font-bold uppercase text-slate-400">{item.status}</span></Link>)}</div></div> : null}
            <Queue title="Closure & memory" icon={CheckCircle2} empty="No matters in closure review." rows={(q.closures ?? []).map((item:any)=>({ id:item.id, title:item.approved_at ? "Closure approved" : "Closure review", subtitle:[item.financial_reconciled&&"Finance",item.documents_archived&&"Archive",item.client_notified&&"Client",item.knowledge_reviewed&&"Knowledge"].filter(Boolean).join(" • ") || "Controls pending", badge:item.approved_at ? "approved" : "review", href:item.matter_id ? `/matters/${item.matter_id}` : undefined }))}/>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Capability enabled={Boolean(data.capabilities?.ethicalWalls)} title="Ethical walls" text="Governors can control screened access and restricted matters." />
          <Capability enabled={Boolean(data.capabilities?.approvals)} title="Partner approvals" text="Filing, AI-work and governance approval surfaces follow role authority." />
          <Capability enabled={Boolean(data.capabilities?.clientAccess)} title="Client access" text="Matter updates, instructions and portal grants follow matter authorization." />
          <Capability enabled={Boolean(data.capabilities?.studio)} title="Firm Studio" text="Brand, letterhead, bilingual defaults and form definitions are firm-specific." />
        </section>
      </div>
    </main>
  );
}

function Queue({ title, icon: Icon, rows, empty }: { title:string; icon:any; rows:{id:string;title:string;subtitle?:string;badge?:string;href?:string}[]; empty:string }) {
  return <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-[#0f5b49]"><Icon className="h-5 w-5"/></div><h2 className="text-xl font-semibold text-slate-950">{title}</h2></div><div className="mt-4 space-y-2">{rows.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p>:rows.map(row=>{const body=<div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-emerald-200"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{row.title}</p><p className="mt-1 truncate text-xs text-slate-500">{row.subtitle}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{row.badge||"open"}</span></div>; return row.href?<Link key={row.id} href={row.href}>{body}</Link>:<div key={row.id}>{body}</div>})}</div></div>
}

function Capability({ enabled, title, text }: { enabled:boolean; title:string; text:string }) {
  return <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#0f5b49]"/><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${enabled?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-400"}`}>{enabled?"Enabled":"Role limited"}</span></div><h3 className="mt-4 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>
}
