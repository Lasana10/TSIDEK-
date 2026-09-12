"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, Building2, FileText, GitBranch, Palette, Plus, Save, Scale, ShieldCheck, Sparkles } from "lucide-react";

type Brand = {
  display_name?: string;
  legal_name?: string;
  short_name?: string;
  motto?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  surface_color?: string;
  text_color?: string;
  default_language?: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  document_header_html?: string;
  document_footer_html?: string;
  email_signature_html?: string;
};

type FormDefinition = {
  id: string;
  name: string;
  form_key: string;
  module: string;
  status: string;
  version: number;
  description?: string;
};

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-900/5";

export default function FirmStudioPage() {
  const [brand, setBrand] = useState<Brand>({});
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newFormName, setNewFormName] = useState("");
  const [newFormModule, setNewFormModule] = useState("intake");

  useEffect(() => {
    fetch("/api/firm/studio")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || "Unable to load studio");
        setBrand(data.brand || {});
        setForms(data.forms || []);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load studio"))
      .finally(() => setLoading(false));
  }, []);

  const previewStyle = useMemo(() => ({
    background: brand.background_color || "#F8FAFC",
    color: brand.text_color || "#0F172A",
    borderColor: brand.primary_color || "#111827",
  }), [brand]);

  const update = (key: keyof Brand, value: string) => setBrand((current) => ({ ...current, [key]: value }));

  async function saveBrand() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/firm/studio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brand) });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Unable to save brand");
      setBrand(data.brand || brand);
      setMessage("Firm identity saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save brand");
    } finally { setSaving(false); }
  }

  async function createForm() {
    const name = newFormName.trim();
    if (!name) return;
    setSaving(true); setMessage("");
    try {
      const formKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const response = await fetch("/api/firm/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, formKey, module: newFormModule, schema: { fields: [] }, status: "draft" }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Unable to create form");
      setForms((current) => [...current, data.form]);
      setNewFormName("");
      setMessage("Custom form created. Open it below to design its fields and workflow.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to create form");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f8f6] p-6 text-slate-700">Loading firm studio…</main>;

  return (
    <main className="min-h-screen bg-[#f7f8f6] px-4 py-6 text-slate-700 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link>
            <div className="mt-4 flex items-center gap-3"><div className="rounded-2xl bg-emerald-950 p-3 text-white"><Building2 className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Firm Studio</p><h1 className="text-3xl font-semibold text-emerald-950">Govern how the firm works</h1></div></div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Brand, forms, legal classifications, workflows, interaction privacy and AI policy stay configurable here so everyday work remains simple.</p>
          </div>
          <button onClick={saveBrand} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save identity"}</button>
        </div>

        {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/studio/legal-parameters" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"><Scale className="h-5 w-5 text-emerald-900"/><h2 className="mt-4 text-lg font-semibold text-emerald-950">Legal parameters</h2><p className="mt-2 text-sm leading-6 text-slate-500">Matter types, jurisdictions, courts, procedure tracks, document types, fees, risk and confidentiality.</p></Link>
          <Link href="/studio/workflows" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"><GitBranch className="h-5 w-5 text-emerald-900"/><h2 className="mt-4 text-lg font-semibold text-emerald-950">Workflow Studio</h2><p className="mt-2 text-sm leading-6 text-slate-500">Edit the legal operating stages, guards, approvals and transition structure used by matters.</p></Link>
          <Link href="/studio/operations" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"><BrainCircuit className="h-5 w-5 text-emerald-900"/><h2 className="mt-4 text-lg font-semibold text-emerald-950">Privacy, interaction & AI</h2><p className="mt-2 text-sm leading-6 text-slate-500">Switch channels, recording, transcription and AI modes without exposing provider complexity to normal staff.</p></Link>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-5">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3"><Palette className="h-5 w-5 text-emerald-900" /><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Identity</p><h2 className="text-xl font-semibold text-emerald-950">Firm brand system</h2></div></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <input className={inputClass} value={brand.display_name || ""} onChange={(e) => update("display_name", e.target.value)} placeholder="Display name" />
                <input className={inputClass} value={brand.legal_name || ""} onChange={(e) => update("legal_name", e.target.value)} placeholder="Legal name" />
                <input className={inputClass} value={brand.short_name || ""} onChange={(e) => update("short_name", e.target.value)} placeholder="Short name" />
                <input className={inputClass} value={brand.motto || ""} onChange={(e) => update("motto", e.target.value)} placeholder="Motto" />
                <input className={inputClass} value={brand.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} placeholder="Logo asset URL" />
                <select className={inputClass} value={brand.default_language || "en"} onChange={(e) => update("default_language", e.target.value)}><option value="en">English</option><option value="fr">French</option><option value="bilingual">English + French</option></select>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {(["primary_color","secondary_color","accent_color"] as const).map((key) => <label key={key} className="rounded-2xl border border-slate-200 p-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{key.replace("_color", "")}<input type="color" className="mt-2 h-11 w-full cursor-pointer rounded-xl border-0 bg-transparent" value={brand[key] || (key === "primary_color" ? "#111827" : key === "secondary_color" ? "#7C3AED" : "#F59E0B")} onChange={(e) => update(key, e.target.value)} /></label>)}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-emerald-900" /><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Documents</p><h2 className="text-xl font-semibold text-emerald-950">Letterhead and communication identity</h2></div></div>
              <div className="mt-5 space-y-4">
                <textarea className={`${inputClass} min-h-28`} value={brand.document_header_html || ""} onChange={(e) => update("document_header_html", e.target.value)} placeholder="Document header HTML / structured letterhead content" />
                <textarea className={`${inputClass} min-h-24`} value={brand.document_footer_html || ""} onChange={(e) => update("document_footer_html", e.target.value)} placeholder="Document footer" />
                <textarea className={`${inputClass} min-h-24`} value={brand.email_signature_html || ""} onChange={(e) => update("email_signature_html", e.target.value)} placeholder="Firm email signature" />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[1.8rem] border-2 bg-white p-5 shadow-sm" style={previewStyle}>
              <div className="flex items-center justify-between gap-4"><div>{brand.logo_url ? <img src={brand.logo_url} alt="Firm logo" className="h-14 max-w-48 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white" style={{ background: brand.primary_color || "#111827" }}>{(brand.short_name || brand.display_name || "F").slice(0,2).toUpperCase()}</div>}</div><ShieldCheck className="h-5 w-5" /></div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] opacity-60">Live identity preview</p>
              <h2 className="mt-2 text-3xl font-semibold">{brand.display_name || "Your Firm"}</h2>
              <p className="mt-2 text-sm opacity-70">{brand.motto || "Your firm motto appears here."}</p>
              <div className="mt-6 h-2 rounded-full" style={{ background: brand.accent_color || "#F59E0B" }} />
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-900" /><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Form Studio</p><h2 className="text-xl font-semibold text-emerald-950">Firm-controlled forms</h2></div></div>
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_auto]"><input className={inputClass} value={newFormName} onChange={(e) => setNewFormName(e.target.value)} placeholder="e.g. Client KYC Review" /><select className={inputClass} value={newFormModule} onChange={(e) => setNewFormModule(e.target.value)}><option value="intake">Intake</option><option value="kyc">KYC</option><option value="conflict">Conflict</option><option value="engagement">Engagement</option><option value="matter">Matter</option><option value="finance">Finance</option><option value="closure">Closure</option></select><button onClick={createForm} disabled={!newFormName.trim() || saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-950 px-4 py-3 text-sm font-bold text-emerald-950"><Plus className="h-4 w-4" /> Add</button></div>
              <div className="mt-5 space-y-3">{forms.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No custom forms yet. Create the firm&apos;s first controlled form above.</div> : forms.map((form) => <Link key={form.id} href={`/studio/forms/${form.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-300"><div><p className="text-sm font-bold text-slate-800">{form.name}</p><p className="mt-1 text-xs text-slate-500">{form.module} · v{form.version} · {form.form_key}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">{form.status}</span></Link>)}</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
