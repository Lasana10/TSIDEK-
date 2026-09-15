"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Filter,
  Landmark,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type Matter = {
  id: string;
  title: string;
  clientName: string;
  matterType: string;
  status: string;
  riskLevel: string;
  jurisdiction: string;
  leadLawyer?: string;
  projectManager?: string;
  physicalFileId?: string;
  synopsis?: string;
  primaryTrack?: string;
  nextDraft?: string;
  securityClassification?: string;
  ethicalWallEnabled?: boolean;
};

type MatterResponse = {
  matters?: Matter[];
  success?: boolean;
  error?: string;
};

type CreateMatterForm = {
  title: string;
  clientName: string;
  matterType: string;
  jurisdiction: string;
  riskLevel: string;
  synopsis: string;
};

const EMPTY_FORM: CreateMatterForm = {
  title: "",
  clientName: "",
  matterType: "General matter",
  jurisdiction: "OHADA",
  riskLevel: "Medium",
  synopsis: "",
};

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateMatterForm>(EMPTY_FORM);

  const loadMatters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/matters", { cache: "no-store", credentials: "include" });
      const payload = (await response.json()) as MatterResponse;
      if (!response.ok) throw new Error(payload.error || "Unable to load matters.");
      setMatters(payload.matters ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load matters.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatters();
  }, [loadMatters]);

  const statusOptions = useMemo(() => Array.from(new Set(matters.map((matter) => matter.status).filter(Boolean))).sort(), [matters]);
  const riskOptions = useMemo(() => Array.from(new Set(matters.map((matter) => matter.riskLevel).filter(Boolean))).sort(), [matters]);

  const visibleMatters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return matters.filter((matter) => {
      const matchesSearch = !needle || [matter.title, matter.clientName, matter.matterType, matter.jurisdiction, matter.leadLawyer, matter.physicalFileId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
      const matchesRisk = risk === "all" || matter.riskLevel === risk;
      const matchesStatus = status === "all" || matter.status === status;
      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [matters, query, risk, status]);

  const highRiskCount = matters.filter((matter) => /high|critical/i.test(matter.riskLevel)).length;
  const restrictedCount = matters.filter((matter) => matter.ethicalWallEnabled || /partner|confidential/i.test(matter.securityClassification ?? "")).length;
  const clientCount = new Set(matters.map((matter) => matter.clientName).filter(Boolean)).size;

  async function createMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/matters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createMatter", ...form }),
      });
      const payload = await response.json() as MatterResponse & { matterId?: string };
      if (!response.ok || !payload.matterId) throw new Error(payload.error || "Unable to create matter.");
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      window.location.assign(`/matters/${payload.matterId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create matter.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5f2] text-slate-900">
      <div className="mx-auto max-w-[1680px] px-4 py-5 md:px-7 md:py-8 xl:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-[#9ebbb2] hover:text-[#0b493b]"><ArrowLeft className="h-4 w-4" /> Command workspace</Link>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_26px_rgba(11,73,59,0.18)]"><Plus className="h-4 w-4" /> Open matter</button>
        </div>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] text-white shadow-[0_28px_80px_rgba(8,43,34,0.16)]">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="relative p-6 md:p-8 xl:p-10">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/5 bg-white/[0.03]" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/60"><BriefcaseBusiness className="h-3.5 w-3.5 text-[#dfc47f]" /> Matter operating system</div>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Every legal obligation belongs to a matter.</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Clients, deadlines, evidence, procedure, drafts, research, communications, finance, access and institutional memory converge here. No parallel case spreadsheet is required.</p>
                <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-white/70">
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">Source-preserving</span>
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">Human-supervised AI</span>
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">Role governed</span>
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">Cameroon • OHADA • CEMAC • OAPI</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 xl:border-l xl:border-t-0">
              <HeroMetric label="Accessible matters" value={matters.length} icon={BriefcaseBusiness} />
              <HeroMetric label="Clients represented" value={clientCount} icon={Landmark} />
              <HeroMetric label="High-risk" value={highRiskCount} icon={AlertTriangle} />
              <HeroMetric label="Controlled access" value={restrictedCount} icon={ShieldCheck} />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.04)] md:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 focus-within:border-[#7da797]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search matter, client, lawyer, file ID or jurisdiction…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <FilterSelect value={status} onChange={setStatus} label="Status" options={statusOptions} />
            <FilterSelect value={risk} onChange={setRisk} label="Risk" options={riskOptions} />
            <button onClick={() => { setQuery(""); setStatus("all"); setRisk("all"); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50"><Filter className="h-4 w-4" /> Reset</button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>{visibleMatters.length} of {matters.length} matters visible</span>
            <span className="hidden sm:inline">Only matters authorized for the active firm membership are returned.</span>
          </div>
        </section>

        {error ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="flex-1"><p className="font-bold">Matter operation could not complete</p><p className="mt-1 text-red-600">{error}</p></div><button onClick={() => void loadMatters()} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold">Retry</button></div> : null}

        <section className="mt-6">
          {loading ? (
            <div className="grid min-h-72 place-items-center rounded-[1.8rem] border border-slate-200 bg-white"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0b493b]" /><p className="mt-3 text-sm font-semibold text-slate-600">Loading governed matters…</p></div></div>
          ) : visibleMatters.length === 0 ? (
            <div className="grid min-h-80 place-items-center rounded-[1.8rem] border border-dashed border-slate-300 bg-white p-8 text-center"><div className="max-w-md"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf4f0] text-[#0b493b]"><BriefcaseBusiness className="h-6 w-6" /></div><h2 className="mt-4 text-xl font-semibold">No matters in this view</h2><p className="mt-2 text-sm leading-6 text-slate-500">Adjust the filters or open the first governed matter for this firm.</p><button onClick={() => setCreateOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white"><CirclePlus className="h-4 w-4" /> Open matter</button></div></div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleMatters.map((matter) => <MatterCard key={matter.id} matter={matter} />)}
            </div>
          )}
        </section>
      </div>

      {createOpen ? <CreateMatterDialog form={form} setForm={setForm} close={() => !creating && setCreateOpen(false)} submit={createMatter} creating={creating} /> : null}
    </main>
  );
}

function MatterCard({ matter }: { matter: Matter }) {
  const highRisk = /high|critical/i.test(matter.riskLevel);
  return (
    <Link href={`/matters/${matter.id}`} className="group rounded-[1.55rem] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#8fb5aa] hover:shadow-[0_20px_44px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[0.17em] text-[#0f5b49]">{matter.matterType || "Matter"}</p><h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-slate-950">{matter.title}</h2><p className="mt-1 truncate text-sm font-medium text-slate-500">{matter.clientName}</p></div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4f0] text-[#0f5b49]"><ChevronRight className="h-5 w-5 transition group-hover:translate-x-0.5" /></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge label={matter.status || "Active"} />
        <Badge label={`${matter.riskLevel || "Unrated"} risk`} danger={highRisk} />
        {matter.ethicalWallEnabled ? <Badge label="Ethical wall" controlled /> : null}
        {matter.securityClassification ? <Badge label={matter.securityClassification} controlled /> : null}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
        <Detail label="Jurisdiction" value={matter.jurisdiction || "Not set"} />
        <Detail label="Lead" value={matter.leadLawyer || "Unassigned"} />
        <Detail label="Physical file" value={matter.physicalFileId || "Digital-first"} />
        <Detail label="Next legal work" value={matter.nextDraft || matter.primaryTrack || "Open matter room"} />
      </div>
      {matter.synopsis ? <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">{matter.synopsis}</p> : null}
      <div className="mt-5 flex items-center gap-2 text-xs font-bold text-[#0f5b49]">Enter governed matter room <ArrowRight className="h-3.5 w-3.5" /></div>
    </Link>
  );
}

function Badge({ label, danger = false, controlled = false }: { label: string; danger?: boolean; controlled?: boolean }) {
  const classes = danger ? "bg-red-50 text-red-700" : controlled ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] ${classes}`}>{label}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 truncate font-semibold text-slate-700" title={value}>{value}</p></div>;
}

function HeroMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof BriefcaseBusiness }) {
  return <div className="bg-white/[0.045] p-5 md:p-6"><Icon className="h-4 w-4 text-[#dfc47f]" /><p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.17em] text-white/40">{label}</p></div>;
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) {
  return <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfcfb] px-3"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-700 outline-none"><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function CreateMatterDialog({ form, setForm, close, submit, creating }: { form: CreateMatterForm; setForm: (form: CreateMatterForm) => void; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => Promise<void>; creating: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#071d18]/55 p-4 backdrop-blur-sm" onMouseDown={close}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="my-6 w-full max-w-2xl rounded-[1.8rem] border border-white/60 bg-white p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-[#edf4f0] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#0b493b]"><Sparkles className="h-3.5 w-3.5" /> Governed matter opening</div><h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Open a real matter record</h2><p className="mt-1 text-sm leading-6 text-slate-500">The matter becomes the anchor for documents, deadlines, legal research, client service, finance and audit history.</p></div><button type="button" onClick={close} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Matter title" required value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="e.g. K-Metal SARL Debt Recovery" />
          <Field label="Client" required value={form.clientName} onChange={(value) => setForm({ ...form, clientName: value })} placeholder="Client or organization" />
          <Field label="Matter type" value={form.matterType} onChange={(value) => setForm({ ...form, matterType: value })} placeholder="Litigation, advisory, recovery…" />
          <Field label="Jurisdiction" value={form.jurisdiction} onChange={(value) => setForm({ ...form, jurisdiction: value })} placeholder="OHADA / Cameroon / Court" />
          <label><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">Risk level</span><select value={form.riskLevel} onChange={(event) => setForm({ ...form, riskLevel: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-3.5 py-3 text-sm outline-none focus:border-[#7da797]"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
          <div className="hidden md:block" />
          <label className="md:col-span-2"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">Opening synopsis</span><textarea value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} rows={4} placeholder="What happened, what the client needs, and the immediate professional objective…" className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-[#fbfcfb] px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#7da797]" /></label>
        </div>
        <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs leading-5 text-emerald-800"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Human-owned legal work.</strong> AI assistance remains review-gated; opening a matter does not automatically issue legal advice, file a document or communicate externally.</p></div></div>
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={close} disabled={creating} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={creating || !form.title.trim() || !form.clientName.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#082b22] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CirclePlus className="h-4 w-4" />}{creating ? "Opening…" : "Open matter"}</button></div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label><span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}{required ? " *" : ""}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-3.5 py-3 text-sm outline-none focus:border-[#7da797]" /></label>;
}
