"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Landmark,
  LibraryBig,
  Menu,
  MessageSquareText,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type QueueItem = Record<string, unknown>;
type WorkspacePayload = {
  success: boolean;
  error?: string;
  identity?: {
    actorName?: string | null;
    actorRole?: string | null;
    title?: string | null;
    firmId?: string | null;
  };
  capabilities?: Record<string, boolean>;
  metrics?: Record<string, number>;
  queues?: Record<string, QueueItem[]>;
};
type GateState = "resolving-session" | "resolving-context" | "ready" | "unauthenticated" | "unauthorized" | "error";
type QueueRow = { id: string; title: string; subtitle?: string; badge?: string; href?: string };

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const money = (value: number) => `${new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(value || 0)} XAF`;
const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asBoolean = (value: unknown) => Boolean(value);

const navigation: NavItem[] = [
  { href: "/workspace", label: "Command", icon: Gauge, description: "Today, risk and priority" },
  { href: "/matters", label: "Matters", icon: BriefcaseBusiness, description: "Matter lifecycle" },
  { href: "/interactions", label: "Interactions", icon: MessageSquareText, description: "Calls, visits and meetings" },
  { href: "/intake", label: "Client cycle", icon: Users, description: "Prospects, conflicts and onboarding" },
  { href: "/digitisation", label: "Digitisation", icon: Archive, description: "Legacy files and evidence" },
  { href: "/law-bank", label: "Law Bank", icon: LibraryBig, description: "Sources and precedent" },
  { href: "/people", label: "People", icon: CircleUserRound, description: "Teams and performance" },
  { href: "/studio", label: "Firm Studio", icon: Building2, description: "Firm configuration" },
];

const roleCopy: Record<string, { eyebrow: string; heading: string; summary: string; focus: string[] }> = {
  partner: {
    eyebrow: "Partner command",
    heading: "Firm oversight without losing matter detail.",
    summary: "Approvals, risk, client service, financial exposure and team execution are surfaced before they become problems.",
    focus: ["High-risk matters", "Pending approvals", "Outstanding fees"],
  },
  owner: {
    eyebrow: "Firm command",
    heading: "Operate the firm from one legal control surface.",
    summary: "See institutional risk, workload, client obligations, collections and governance from a single verified workspace.",
    focus: ["Firm risk", "Team execution", "Revenue control"],
  },
  lawyer: {
    eyebrow: "Lawyer desk",
    heading: "Your matters, deadlines and client obligations first.",
    summary: "Work from the next professional action: what is due, what needs review, who is waiting and which file needs judgment.",
    focus: ["Due work", "Client instructions", "Drafts to review"],
  },
  intern: {
    eyebrow: "Supervised practice",
    heading: "Assigned work with clear supervision and review gates.",
    summary: "Research, drafting and file tasks stay connected to the supervising lawyer, source trail and approval path.",
    focus: ["Assigned tasks", "Research queue", "Review feedback"],
  },
  paralegal: {
    eyebrow: "Paralegal desk",
    heading: "Move files forward with traceable operational control.",
    summary: "Intake, evidence, filings, deadlines and client records stay structured around the responsible matter team.",
    focus: ["File readiness", "Deadlines", "Client records"],
  },
  admin: {
    eyebrow: "Operations desk",
    heading: "Keep people, records and firm operations moving.",
    summary: "Access, intake, records, billing support and institutional workflows are organized around verified firm authority.",
    focus: ["Access requests", "Records", "Operations queue"],
  },
  finance: {
    eyebrow: "Finance desk",
    heading: "Collections and reconciliation connected to legal work.",
    summary: "Invoices, outstanding balances and closure controls remain tied to matters instead of living in a separate accounting silo.",
    focus: ["Outstanding invoices", "Reconciliation", "Matter closure"],
  },
};

function normalizeRole(role: string) {
  const value = role.toLowerCase();
  if (value.includes("partner")) return "partner";
  if (value.includes("owner") || value.includes("founder")) return "owner";
  if (value.includes("intern")) return "intern";
  if (value.includes("paralegal")) return "paralegal";
  if (value.includes("admin")) return "admin";
  if (value.includes("finance") || value.includes("bursar") || value.includes("account")) return "finance";
  return "lawyer";
}

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [gate, setGate] = useState<GateState>("resolving-session");
  const [gateError, setGateError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const load = useCallback(async () => {
    setGate("resolving-session");
    setGateError(null);
    try {
      setGate("resolving-context");
      let response = await fetch("/api/workspace", { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        response = await fetch("/api/workspace", { cache: "no-store", credentials: "include" });
      }
      if (response.status === 401) {
        setGate("unauthenticated");
        window.location.replace(`/auth?redirectTo=${encodeURIComponent("/workspace")}`);
        return;
      }
      if (response.status === 409) {
        setGate("unauthorized");
        window.location.replace("/onboarding");
        return;
      }
      const payload = (await response.json()) as WorkspacePayload;
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load workspace.");
      setData(payload);
      setGate("ready");
    } catch (error) {
      setGate("error");
      setGateError(error instanceof Error ? error.message : "Unable to load workspace.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const role = data?.identity?.actorRole ?? "lawyer";
  const roleKey = normalizeRole(role);
  const experience = roleCopy[roleKey] ?? roleCopy.lawyer;
  const queues = data?.queues ?? {};
  const metrics = data?.metrics ?? {};

  const matterRows = useMemo<QueueRow[]>(() =>
    (queues.matters ?? []).map((item) => ({
      id: asString(item.id),
      title: asString(item.title) || "Untitled matter",
      subtitle: [asString(item.client_name), asString(item.matter_type), asString(item.procedural_stage)].filter(Boolean).join(" • "),
      badge: asString(item.status) || "active",
      href: asString(item.id) ? `/matters/${asString(item.id)}` : undefined,
    })), [queues.matters]);

  const taskRows = useMemo<QueueRow[]>(() =>
    (queues.tasks ?? []).map((item) => {
      const deadline = asString(item.deadline);
      const matterId = asString(item.matter_id);
      return {
        id: asString(item.id),
        title: asString(item.title) || "Matter task",
        subtitle: deadline ? `Due ${new Date(deadline).toLocaleString()}` : "No deadline recorded",
        badge: asString(item.status) || "open",
        href: matterId ? `/matters/${matterId}` : undefined,
      };
    }), [queues.tasks]);

  const documentRows = useMemo<QueueRow[]>(() =>
    (queues.documents ?? []).map((item) => {
      const matterId = asString(item.matter_id);
      return {
        id: asString(item.id),
        title: asString(item.title) || "Document",
        subtitle: [asString(item.document_type), asString(item.version_label)].filter(Boolean).join(" • "),
        badge: asString(item.review_status) || asString(item.status) || "draft",
        href: matterId ? `/matters/${matterId}` : undefined,
      };
    }), [queues.documents]);

  const intakeRows = useMemo<QueueRow[]>(() =>
    (queues.intake ?? []).map((item) => ({
      id: asString(item.id),
      title: asString(item.prospect_name) || "Prospective client",
      subtitle: `Conflict: ${asString(item.conflict_status) || "pending"} • Engagement: ${asString(item.engagement_status) || "pending"}`,
      badge: asString(item.risk_level) || asString(item.status) || "review",
      href: "/intake",
    })), [queues.intake]);

  const clientRows = useMemo<QueueRow[]>(() =>
    (queues.clientUpdates ?? []).map((item) => {
      const matterId = asString(item.matter_id);
      return {
        id: asString(item.id),
        title: asString(item.title) || "Client update",
        subtitle: asBoolean(item.instruction_required) ? `Instruction: ${asString(item.instruction_status) || "pending"}` : "No instruction required",
        badge: asString(item.delivery_status) || asString(item.status) || "open",
        href: matterId ? `/matters/${matterId}` : undefined,
      };
    }), [queues.clientUpdates]);

  const closureRows = useMemo<QueueRow[]>(() =>
    (queues.closures ?? []).map((item) => {
      const matterId = asString(item.matter_id);
      const approved = Boolean(item.approved_at);
      return {
        id: asString(item.id),
        title: approved ? "Closure approved" : "Closure review",
        subtitle: approved ? "Institutional memory ready" : "Final checks required before matter closure",
        badge: approved ? "approved" : "review",
        href: matterId ? `/matters/${matterId}` : undefined,
      };
    }), [queues.closures]);

  if (gate === "resolving-session" || gate === "resolving-context") {
    return <WorkspaceLoading context={gate === "resolving-context"} />;
  }

  if (gate !== "ready" || !data?.success) {
    return <WorkspaceError state={gate} error={gateError || data?.error} retry={load} />;
  }

  const statCards = [
    ["Active matters", metrics.activeMatters ?? 0, BriefcaseBusiness],
    ["Urgent work", metrics.urgentTasks ?? 0, Clock3],
    ["Review queue", metrics.reviewQueue ?? 0, FileCheck2],
    ["Open intake", metrics.openIntake ?? 0, Users],
    ["Client updates", metrics.pendingClientUpdates ?? 0, Landmark],
    ["High risk", metrics.highRiskMatters ?? 0, ShieldCheck],
  ] as const;

  return (
    <main className="min-h-screen bg-[#f3f5f2] text-slate-900">
      <div className="mx-auto min-h-screen max-w-[1920px] xl:grid xl:grid-cols-[286px_minmax(0,1fr)]">
        <DesktopSidebar role={role} actorName={data.identity?.actorName} capabilities={data.capabilities} />

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 bg-[#071d18]/45 backdrop-blur-sm xl:hidden" onClick={() => setMobileNavOpen(false)}>
            <div className="h-full w-[86%] max-w-sm bg-[#082b22] p-5 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between">
                <BrandMark />
                <button onClick={() => setMobileNavOpen(false)} className="rounded-xl border border-white/10 p-2 text-white/70" aria-label="Close navigation"><X className="h-5 w-5" /></button>
              </div>
              <nav className="mt-8 space-y-1">
                {navigation.map((item) => <SidebarLink key={item.href} item={item} active={item.href === "/workspace"} />)}
              </nav>
            </div>
          </div>
        ) : null}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8faf7]/90 px-4 py-3 backdrop-blur-xl md:px-7 xl:px-9">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 xl:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
              <div className="hidden min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-400 shadow-[0_8px_24px_rgba(15,23,42,0.03)] md:flex">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">Search matters, clients, documents or law…</span>
                <span className="ml-auto rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Global</span>
              </div>
              <Link href="/interactions" className="ml-auto hidden items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(11,73,59,0.18)] sm:inline-flex md:ml-0"><Plus className="h-4 w-4" /> New activity</Link>
              <button className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700" aria-label="Notifications"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" /></button>
              <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e4eee9] text-xs font-black text-[#0b493b]">{initials(data.identity?.actorName)}</div>
                <div className="max-w-36">
                  <p className="truncate text-xs font-bold text-slate-900">{data.identity?.actorName || "Firm member"}</p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{role}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-6 px-4 py-5 md:px-7 md:py-7 xl:px-9 xl:py-8">
            <section className="overflow-hidden rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] text-white shadow-[0_28px_80px_rgba(8,43,34,0.18)]">
              <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
                <div className="relative p-6 md:p-8 xl:p-10">
                  <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/5 bg-white/[0.03]" />
                  <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-[#c5a059]/10 blur-3xl" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/65"><Sparkles className="h-3.5 w-3.5 text-[#d9ba78]" />{experience.eyebrow}</span>
                      <span className="rounded-full border border-emerald-300/10 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Firm context verified</span>
                    </div>
                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-white/45">Good to see you, {firstName(data.identity?.actorName)}</p>
                    <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-0.035em] md:text-5xl">{experience.heading}</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 md:text-[15px]">{experience.summary}</p>
                    <div className="mt-7 flex flex-wrap gap-2">
                      {experience.focus.map((item) => <span key={item} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-white/75">{item}</span>)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-white/[0.045] p-5 xl:border-l xl:border-t-0 xl:p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Quick actions</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <QuickAction href="/interactions" icon={MessageSquareText} title="Record interaction" text="Call, visit, meeting or referral" primary />
                    <QuickAction href="/intake" icon={Users} title="Open client cycle" text="Conflict and engagement workflow" />
                    <QuickAction href="/digitisation" icon={Archive} title="Digitise a file" text="Preserve and structure legacy records" />
                    <QuickAction href="/law-bank" icon={BookOpenCheck} title="Open Law Bank" text="Verified sources and precedent" />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {statCards.map(([label, value, Icon]) => <MetricCard key={label} label={label} value={value} icon={Icon} />)}
            </section>

            <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.7fr)]">
              <div className="space-y-6">
                <SectionHeader eyebrow="Work in motion" title="Today’s legal command" description="The queues below are ordered around execution, professional judgment and the next accountable action." actionHref="/matters" actionLabel="All matters" />
                <div className="grid gap-5 xl:grid-cols-2">
                  <Queue title="Matter command" icon={BriefcaseBusiness} empty="No accessible matters yet." rows={matterRows} accent="Matter" />
                  <Queue title="Work due" icon={Clock3} empty="No open tasks." rows={taskRows} accent="Deadline" />
                  <Queue title="Drafting & review" icon={FileText} empty="No documents awaiting review." rows={documentRows} accent="Document" />
                  <Queue title="Client obligations" icon={Landmark} empty="No client updates pending." rows={clientRows} accent="Client" />
                </div>
              </div>

              <aside className="space-y-5">
                <SectionHeader eyebrow="Control lane" title="Risk, intake & closure" description="Items that can block a matter or create institutional exposure." />
                <Queue title="Intake & conflict" icon={Users} empty="No open intake." rows={intakeRows} accent="Gate" compact />
                {data.capabilities?.finance ? (
                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Receipt className="h-5 w-5" /></div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Financial exposure</span>
                    </div>
                    <p className="mt-6 text-[11px] font-black uppercase tracking-[0.17em] text-slate-400">Outstanding</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{money(metrics.outstandingXaf ?? 0)}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-500">{metrics.outstandingInvoices ?? 0} invoice(s) require collection, reconciliation or closure review.</p>
                  </div>
                ) : null}
                <Queue title="Closure & memory" icon={CheckCircle2} empty="No matters in closure review." rows={closureRows} accent="Memory" compact />
              </aside>
            </section>

            <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] md:p-6">
              <SectionHeader eyebrow="Firm operating layer" title="Your authorized surfaces" description="Navigation and controls follow the active firm membership rather than a cosmetic role selector." />
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Capability enabled={Boolean(data.capabilities?.ethicalWalls)} icon={ShieldCheck} title="Ethical walls" text="Screened access and restricted matters." />
                <Capability enabled={Boolean(data.capabilities?.approvals)} icon={FileCheck2} title="Approvals" text="Professional and governance review gates." />
                <Capability enabled={Boolean(data.capabilities?.clientAccess)} icon={Landmark} title="Client access" text="Matter updates, instructions and portal grants." />
                <Capability enabled={Boolean(data.capabilities?.studio)} icon={Settings2} title="Firm Studio" text="Brand, workflows, privacy and firm controls." />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function DesktopSidebar({ role, actorName, capabilities }: { role: string; actorName?: string | null; capabilities?: Record<string, boolean> }) {
  return (
    <aside className="hidden min-h-screen border-r border-white/8 bg-[#082b22] text-white xl:sticky xl:top-0 xl:flex xl:h-screen xl:flex-col">
      <div className="p-6"><BrandMark /></div>
      <div className="mx-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Active firm workspace</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c5a059] text-xs font-black text-[#082b22]">EL</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Edanate Lawyers</p>
            <p className="truncate text-[10px] font-semibold text-white/45">Cameroon • OHADA</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-white/35" />
        </div>
      </div>
      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-4 pb-6">
        <p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[0.24em] text-white/25">Operate</p>
        {navigation.map((item) => <SidebarLink key={item.href} item={item} active={item.href === "/workspace"} />)}
      </nav>
      <div className="border-t border-white/10 p-5">
        <div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-xs font-black">{initials(actorName)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{actorName || "Firm member"}</p>
            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-white/35">{role}</p>
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${capabilities ? "bg-emerald-400" : "bg-slate-500"}`} />
        </div>
      </div>
    </aside>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#c5a059]/30 bg-[#c5a059]/10 text-[#e0c68f] shadow-inner"><Landmark className="h-5 w-5" /></div>
      <div><p className="text-sm font-black tracking-[0.16em] text-white">TSIDKENU</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Legal operating system</p></div>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-white text-[#082b22] shadow-sm" : "text-white/62 hover:bg-white/[0.06] hover:text-white"}`}>
      <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-[#0f5b49]" : "text-white/42 group-hover:text-white/70"}`} />
      <div className="min-w-0"><p className="text-xs font-bold">{item.label}</p><p className={`mt-0.5 truncate text-[9px] ${active ? "text-slate-400" : "text-white/28"}`}>{item.description}</p></div>
    </Link>
  );
}

function QuickAction({ href, icon: Icon, title, text, primary = false }: { href: string; icon: LucideIcon; title: string; text: string; primary?: boolean }) {
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition ${primary ? "border-[#d4b36c]/40 bg-[#d4b36c] text-[#082b22] hover:bg-[#dfc47f]" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"}`}>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${primary ? "bg-[#082b22]/10" : "bg-white/[0.06]"}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1"><p className="text-xs font-bold">{title}</p><p className={`mt-0.5 truncate text-[10px] ${primary ? "text-[#082b22]/60" : "text-white/38"}`}>{text}</p></div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
    </Link>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="group rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-[#8fb5aa] hover:shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0f5b49]"><Icon className="h-4.5 w-4.5" /></div><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">Live</span></div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, actionHref, actionLabel }: { eyebrow: string; title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#0f5b49]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2><p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p></div>
      {actionHref && actionLabel ? <Link href={actionHref} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#0f5b49]">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></Link> : null}
    </div>
  );
}

function Queue({ title, icon: Icon, rows, empty, accent, compact = false }: { title: string; icon: LucideIcon; rows: QueueRow[]; empty: string; accent: string; compact?: boolean }) {
  const visibleRows = compact ? rows.slice(0, 4) : rows.slice(0, 5);
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0f5b49]"><Icon className="h-4.5 w-4.5" /></div><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{accent}</p><h3 className="mt-0.5 text-base font-bold text-slate-950">{title}</h3></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{rows.length}</span></div>
      <div className="mt-4 space-y-1.5">
        {visibleRows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4"><p className="text-sm font-medium text-slate-500">{empty}</p><p className="mt-1 text-xs text-slate-400">Nothing requires action in this lane.</p></div> : visibleRows.map((row) => {
          const body = <div className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f4f8f6]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>{row.subtitle ? <p className="mt-1 truncate text-[11px] text-slate-500">{row.subtitle}</p> : null}</div><span className="max-w-24 shrink-0 truncate rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">{row.badge || "open"}</span><ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0f5b49]" /></div>;
          return row.href ? <Link key={row.id || row.title} href={row.href}>{body}</Link> : <div key={row.id || row.title}>{body}</div>;
        })}
      </div>
      {rows.length > visibleRows.length ? <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">+ {rows.length - visibleRows.length} more in this queue</p> : null}
    </div>
  );
}

function Capability({ enabled, icon: Icon, title, text }: { enabled: boolean; icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-[#fbfcfb] p-4">
      <div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-2.5 ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}><Icon className="h-4 w-4" /></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{enabled ? "Enabled" : "Role limited"}</span></div>
      <h3 className="mt-4 text-sm font-bold text-slate-950">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function WorkspaceLoading({ context }: { context: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f2] p-6">
      <div className="w-full max-w-md rounded-[1.8rem] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#082b22] text-[#d7bb7e]"><Landmark className="h-5 w-5" /></div><div><p className="text-xs font-black tracking-[0.15em] text-slate-950">TSIDKENU</p><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Secure workspace</p></div></div>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#0f5b49]" /></div>
        <p className="mt-5 text-sm font-bold text-slate-800">{context ? "Resolving firm authority…" : "Restoring secure session…"}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{context ? "Checking active firm, membership and role before opening legal work." : "Re-establishing your verified Supabase identity."}</p>
      </div>
    </main>
  );
}

function WorkspaceError({ state, error, retry }: { state: GateState; error?: string; retry: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f2] p-6 text-slate-800">
      <div className="w-full max-w-xl rounded-[1.8rem] border border-amber-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700"><AlertTriangle className="h-6 w-6" /></div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Access resolution</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{state === "unauthorized" ? "Workspace access is not established" : "Workspace unavailable"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{error || "The workspace could not be resolved."}</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void retry()} className="rounded-xl bg-[#082b22] px-4 py-2.5 text-sm font-bold text-white">Retry workspace</button>{state === "unauthenticated" ? <Link href="/auth?redirectTo=%2Fworkspace" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Open access</Link> : null}</div>
      </div>
    </main>
  );
}

function initials(name?: string | null) {
  if (!name) return "TS";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TS";
}

function firstName(name?: string | null) {
  if (!name) return "counsel";
  return name.trim().split(/\s+/)[0] || "counsel";
}
