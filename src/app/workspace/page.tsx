"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Archive, ArrowRight, Bell, BookOpenCheck, BriefcaseBusiness, Building2,
  CheckCircle2, ChevronRight, CircleUserRound, Clock3, FileCheck2, FileText, Gauge,
  Landmark, LibraryBig, Menu, MessageSquareText, Plus, Receipt, Search, Settings2,
  ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { TSIDKENU_PRODUCT_LOGO } from "@/lib/tsidkenu-brand";

type QueueItem = Record<string, unknown>;
type WorkspacePayload = {
  success: boolean;
  error?: string;
  identity?: {
    actorName?: string | null;
    actorRole?: string | null;
    title?: string | null;
    firmId?: string | null;
    firmName?: string | null;
    firmCountry?: string | null;
    defaultLanguage?: string | null;
  };
  capabilities?: Record<string, boolean>;
  metrics?: Record<string, number>;
  queues?: Record<string, QueueItem[]>;
};
type GateState = "resolving" | "ready" | "unauthenticated" | "unauthorized" | "error";
type QueueRow = { id: string; title: string; subtitle?: string; badge?: string; href?: string };
type NavItem = { href: string; label: string; icon: LucideIcon; description: string };

const navigation: NavItem[] = [
  { href: "/workspace", label: "Command", icon: Gauge, description: "Today, risk and priority" },
  { href: "/matters", label: "Matters", icon: BriefcaseBusiness, description: "Matter lifecycle" },
  { href: "/interactions", label: "Interactions", icon: MessageSquareText, description: "Calls, visits and meetings" },
  { href: "/intake", label: "Client cycle", icon: Users, description: "Prospects and conflicts" },
  { href: "/digitisation", label: "Digitisation", icon: Archive, description: "Evidence and legacy files" },
  { href: "/law-bank", label: "Law Bank", icon: LibraryBig, description: "Sources and precedent" },
  { href: "/people", label: "People", icon: CircleUserRound, description: "Teams and performance" },
  { href: "/studio", label: "Firm Studio", icon: Building2, description: "Firm configuration" },
];

const roleCopy: Record<string, { eyebrow: string; heading: string; summary: string; focus: string[] }> = {
  owner: { eyebrow: "Firm command", heading: "Operate the firm from one legal control surface.", summary: "Risk, workload, client obligations, collections and governance are surfaced before they become problems.", focus: ["Firm risk", "Team execution", "Revenue control"] },
  partner: { eyebrow: "Partner command", heading: "Firm oversight without losing matter detail.", summary: "Approvals, high-risk files, client service and professional review stay visible in one place.", focus: ["High-risk matters", "Pending approvals", "Outstanding fees"] },
  lawyer: { eyebrow: "Lawyer desk", heading: "Your matters, deadlines and client obligations first.", summary: "Work from the next professional action instead of hunting through disconnected tools.", focus: ["Due work", "Client instructions", "Drafts to review"] },
  intern: { eyebrow: "Supervised practice", heading: "Assigned work with clear review gates.", summary: "Research and drafting stay connected to the supervising lawyer, matter and source trail.", focus: ["Assigned tasks", "Research queue", "Review feedback"] },
  paralegal: { eyebrow: "Paralegal desk", heading: "Move files forward with traceable operational control.", summary: "Evidence, deadlines, intake and records stay structured around the responsible matter team.", focus: ["File readiness", "Deadlines", "Client records"] },
  admin: { eyebrow: "Operations desk", heading: "Keep people, records and firm operations moving.", summary: "Access, records, billing support and institutional workflows follow verified firm authority.", focus: ["Access requests", "Records", "Operations queue"] },
  finance: { eyebrow: "Finance desk", heading: "Collections and reconciliation connected to legal work.", summary: "Invoices and balances stay tied to matters instead of living in a separate accounting silo.", focus: ["Outstanding invoices", "Reconciliation", "Matter closure"] },
};

function normalizeRole(role: string) {
  const value = role.toLowerCase();
  if (value.includes("owner") || value.includes("founder")) return "owner";
  if (value.includes("partner")) return "partner";
  if (value.includes("intern")) return "intern";
  if (value.includes("paralegal")) return "paralegal";
  if (value.includes("admin")) return "admin";
  if (value.includes("finance") || value.includes("account")) return "finance";
  return "lawyer";
}
const asString = (value: unknown) => typeof value === "string" ? value : "";
const money = (value: number) => `${new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(value || 0)} XAF`;

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [gate, setGate] = useState<GateState>("resolving");
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const load = useCallback(async () => {
    setGate("resolving"); setError(null);
    try {
      let response = await fetch("/api/workspace", { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        response = await fetch("/api/workspace", { cache: "no-store", credentials: "include" });
      }
      if (response.status === 401) { setGate("unauthenticated"); window.location.replace("/auth?redirectTo=%2Fworkspace"); return; }
      if (response.status === 409) { setGate("unauthorized"); window.location.replace("/onboarding"); return; }
      const payload = await response.json() as WorkspacePayload;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load workspace.");
      setData(payload); setGate("ready");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load workspace."); setGate("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (gate === "resolving") return <Loading />;
  if (gate !== "ready" || !data?.success) return <Failure error={error || data?.error} retry={load} />;

  const role = data.identity?.actorRole ?? "lawyer";
  const experience = roleCopy[normalizeRole(role)] ?? roleCopy.lawyer;
  const metrics = data.metrics ?? {};
  const queues = data.queues ?? {};
  const firmName = data.identity?.firmName || "Active firm";
  const firmCountry = data.identity?.firmCountry || "";

  const queue = (key: string, titleField: string, subtitle: (item: QueueItem) => string, href: (item: QueueItem) => string | undefined): QueueRow[] =>
    (queues[key] ?? []).map((item) => ({ id: asString(item.id), title: asString(item[titleField]) || "Untitled", subtitle: subtitle(item), badge: asString(item.status) || asString(item.review_status) || "open", href: href(item) }));

  const matterRows = queue("matters", "title", (i) => [asString(i.client_name), asString(i.matter_type), asString(i.procedural_stage)].filter(Boolean).join(" • "), (i) => asString(i.id) ? `/matters/${asString(i.id)}` : undefined);
  const taskRows = queue("tasks", "title", (i) => asString(i.deadline) ? `Due ${new Date(asString(i.deadline)).toLocaleString()}` : "No deadline recorded", (i) => asString(i.matter_id) ? `/matters/${asString(i.matter_id)}` : undefined);
  const documentRows = queue("documents", "title", (i) => [asString(i.document_type), asString(i.version_label)].filter(Boolean).join(" • "), (i) => asString(i.matter_id) ? `/matters/${asString(i.matter_id)}` : undefined);
  const intakeRows = queue("intake", "prospect_name", (i) => `Conflict: ${asString(i.conflict_status) || "pending"} • Engagement: ${asString(i.engagement_status) || "pending"}`, () => "/intake");

  return (
    <main className="min-h-screen bg-[#eef2ef] text-slate-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)] 2xl:grid-cols-[286px_minmax(0,1fr)]">
        <Sidebar firmName={firmName} firmCountry={firmCountry} role={role} actorName={data.identity?.actorName} />
        {mobileNavOpen && <MobileNav firmName={firmName} close={() => setMobileNavOpen(false)} />}

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f9f7]/92 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[1700px] items-center gap-3 px-4 sm:px-6 xl:px-8">
              <button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-400 shadow-sm sm:max-w-xl">
                <Search className="h-4 w-4 shrink-0" /><span className="truncate text-sm">Search matters, clients, documents or law</span>
              </div>
              <Link href="/interactions" className="hidden items-center gap-2 rounded-xl bg-[#083b30] px-4 py-2.5 text-sm font-bold text-white sm:inline-flex"><Plus className="h-4 w-4" /> New activity</Link>
              <button className="rounded-xl border border-slate-200 bg-white p-2.5" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
            </div>
          </header>

          <div className="mx-auto max-w-[1700px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
            <section className="overflow-hidden rounded-[1.7rem] bg-[#07372d] text-white shadow-[0_24px_70px_rgba(7,55,45,.16)]">
              <div className="grid xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="relative p-6 sm:p-8 xl:p-10">
                  <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/5 bg-white/[.025]" />
                  <div className="relative">
                    <div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-white/65">{experience.eyebrow}</span><span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-100">{firmName}</span></div>
                    <p className="mt-6 text-xs font-bold uppercase tracking-[.17em] text-white/45">Good to see you, {firstName(data.identity?.actorName)}</p>
                    <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-.04em] sm:text-4xl xl:text-5xl">{experience.heading}</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">{experience.summary}</p>
                    <div className="mt-6 flex flex-wrap gap-2">{experience.focus.map((item) => <span key={item} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-white/75">{item}</span>)}</div>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-white/[.045] p-5 xl:border-l xl:border-t-0 xl:p-6">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/40">Quick actions</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Quick href="/interactions" icon={MessageSquareText} title="Capture interaction" text="Notes, microphone, call or meeting" primary />
                    <Quick href="/intake" icon={Users} title="Open client cycle" text="Conflict and engagement workflow" />
                    <Quick href="/digitisation" icon={Archive} title="Digitise a file" text="Structure legacy evidence" />
                    <Quick href="/law-bank" icon={BookOpenCheck} title="Open Law Bank" text="Verified sources and precedent" />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <Metric label="Active matters" value={Number(metrics.activeMatters ?? 0)} icon={BriefcaseBusiness} />
              <Metric label="Urgent work" value={Number(metrics.urgentTasks ?? 0)} icon={Clock3} />
              <Metric label="Review queue" value={Number(metrics.reviewQueue ?? 0)} icon={FileCheck2} />
              <Metric label="Open intake" value={Number(metrics.openIntake ?? 0)} icon={Users} />
              <Metric label="Client updates" value={Number(metrics.pendingClientUpdates ?? 0)} icon={Landmark} />
              <Metric label="High risk" value={Number(metrics.highRiskMatters ?? 0)} icon={ShieldCheck} />
            </section>

            <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.7fr)]">
              <div className="grid gap-5 xl:grid-cols-2">
                <Queue title="Matter command" icon={BriefcaseBusiness} rows={matterRows} empty="No accessible matters yet." />
                <Queue title="Work due" icon={Clock3} rows={taskRows} empty="No open tasks." />
                <Queue title="Drafting & review" icon={FileText} rows={documentRows} empty="No documents awaiting review." />
                <Queue title="Client intake" icon={Users} rows={intakeRows} empty="No open intake." />
              </div>
              <aside className="space-y-5">
                {data.capabilities?.finance && <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-700 w-fit"><Receipt className="h-5 w-5" /></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Outstanding</p><p className="mt-1 text-3xl font-semibold">{money(Number(metrics.outstandingXaf ?? 0))}</p><p className="mt-2 text-sm leading-6 text-slate-500">{Number(metrics.outstandingInvoices ?? 0)} invoice(s) require attention.</p></div>}
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#0f5b49]">Authority</p><h2 className="mt-2 text-lg font-semibold">Role-governed workspace</h2><div className="mt-4 space-y-3"><Authority enabled={Boolean(data.capabilities?.ethicalWalls)} icon={ShieldCheck} label="Ethical walls" /><Authority enabled={Boolean(data.capabilities?.approvals)} icon={CheckCircle2} label="Approvals" /><Authority enabled={Boolean(data.capabilities?.studio)} icon={Settings2} label="Firm Studio" /></div></div>
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({ firmName, firmCountry, role, actorName }: { firmName: string; firmCountry: string; role: string; actorName?: string | null }) {
  return <aside className="hidden min-h-screen bg-[#062d25] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
    <div className="border-b border-white/8 px-5 py-5"><ProductMark /></div>
    <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[.055] p-4"><p className="text-[9px] font-black uppercase tracking-[.2em] text-white/35">Active firm</p><div className="mt-3 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d0ad66] text-xs font-black text-[#062d25]">{initials(firmName)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{firmName}</p><p className="truncate text-[10px] text-white/45">{firmCountry || "Firm workspace"}</p></div></div></div>
    <nav className="mt-5 flex-1 overflow-y-auto px-3">{navigation.map((item) => <Nav key={item.href} item={item} active={item.href === "/workspace"} />)}</nav>
    <div className="border-t border-white/8 p-4"><div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-xs font-black">{initials(actorName)}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{actorName || "Firm member"}</p><p className="truncate text-[9px] font-black uppercase tracking-[.13em] text-white/35">{role}</p></div></div></div>
  </aside>;
}
function MobileNav({ firmName, close }: { firmName: string; close: () => void }) { return <div className="fixed inset-0 z-50 bg-[#041c17]/55 backdrop-blur-sm lg:hidden" onClick={close}><div className="h-full w-[86%] max-w-sm bg-[#062d25] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><ProductMark /><button onClick={close} className="rounded-xl border border-white/10 p-2"><X className="h-5 w-5" /></button></div><p className="mt-6 text-xs font-semibold text-white/50">{firmName}</p><nav className="mt-4">{navigation.map((item) => <Nav key={item.href} item={item} active={item.href === "/workspace"} />)}</nav></div></div>; }
function ProductMark() { return <div className="flex items-center gap-3"><div className="h-11 w-28 overflow-hidden rounded-xl bg-[#0d3a30] px-1.5"><img src={TSIDKENU_PRODUCT_LOGO} alt="Tsidkenu" className="h-full w-full object-contain" /></div><div className="hidden 2xl:block"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">Legal OS</p></div></div>; }
function Nav({ item, active }: { item: NavItem; active: boolean }) { const Icon = item.icon; return <Link href={item.href} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-white text-[#062d25]" : "text-white/65 hover:bg-white/[.06] hover:text-white"}`}><Icon className="h-4.5 w-4.5 shrink-0" /><div className="min-w-0"><p className="text-xs font-bold">{item.label}</p><p className={`truncate text-[9px] ${active ? "text-slate-400" : "text-white/30"}`}>{item.description}</p></div></Link>; }
function Quick({ href, icon: Icon, title, text, primary = false }: { href: string; icon: LucideIcon; title: string; text: string; primary?: boolean }) { return <Link href={href} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${primary ? "border-[#d4b36c]/40 bg-[#d4b36c] text-[#062d25]" : "border-white/10 bg-white/[.04] text-white"}`}><div className="grid h-9 w-9 place-items-center rounded-xl bg-black/10"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">{title}</p><p className={`truncate text-[10px] ${primary ? "text-[#062d25]/60" : "text-white/40"}`}>{text}</p></div><ArrowRight className="h-4 w-4 opacity-45" /></Link>; }
function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) { return <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0f5b49] w-fit"><Icon className="h-4.5 w-4.5" /></div><p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">{label}</p></div>; }
function Queue({ title, icon: Icon, rows, empty }: { title: string; icon: LucideIcon; rows: QueueRow[]; empty: string }) { return <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0f5b49]"><Icon className="h-4.5 w-4.5" /></div><h2 className="text-base font-bold">{title}</h2><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{rows.length}</span></div><div className="mt-4 space-y-1">{rows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p> : rows.slice(0, 6).map((row) => { const body = <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f4f8f6]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.title}</p>{row.subtitle && <p className="mt-1 truncate text-[11px] text-slate-500">{row.subtitle}</p>}</div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{row.badge}</span><ChevronRight className="h-4 w-4 text-slate-300" /></div>; return row.href ? <Link key={row.id || row.title} href={row.href}>{body}</Link> : <div key={row.id || row.title}>{body}</div>; })}</div></div>; }
function Authority({ enabled, icon: Icon, label }: { enabled: boolean; icon: LucideIcon; label: string }) { return <div className="flex items-center gap-3"><div className={`rounded-lg p-2 ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}><Icon className="h-4 w-4" /></div><span className="text-sm font-semibold">{label}</span><span className={`ml-auto text-[9px] font-black uppercase ${enabled ? "text-emerald-700" : "text-slate-400"}`}>{enabled ? "Enabled" : "Limited"}</span></div>; }
function Loading() { return <main className="grid min-h-screen place-items-center bg-[#eef2ef] p-6"><div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"><ProductMarkDark /><div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#0f5b49]" /></div><p className="mt-4 text-sm font-bold">Opening secure workspace…</p></div></main>; }
function Failure({ error, retry }: { error?: string | null; retry: () => Promise<void> }) { return <main className="grid min-h-screen place-items-center bg-[#eef2ef] p-6"><div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-7 shadow-xl"><AlertTriangle className="h-6 w-6 text-amber-700" /><h1 className="mt-4 text-xl font-semibold">Workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-600">{error || "The workspace could not be resolved."}</p><button onClick={() => void retry()} className="mt-5 rounded-xl bg-[#07372d] px-4 py-2.5 text-sm font-bold text-white">Retry</button></div></main>; }
function ProductMarkDark() { return <div className="h-12 w-32 overflow-hidden rounded-xl bg-[#07372d] px-2"><img src={TSIDKENU_PRODUCT_LOGO} alt="Tsidkenu" className="h-full w-full object-contain" /></div>; }
function initials(name?: string | null) { if (!name) return "TS"; return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "TS"; }
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] || "counsel"; }
