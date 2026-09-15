"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, Database, FileStack, Receipt, ShieldCheck, UserPlus, Workflow, Network, Sparkles } from "lucide-react";
import AuthSessionPill from "@/components/AuthSessionPill";
import FirmCockpit from "@/components/FirmCockpit";

const workingTracks = [
  { title: "Intake & client opening", status: "Operational", description: "Recognise existing clients, capture new legal requests, clear conflicts, progress KYC and engagement, then open the matter without re-registering the same person.", cta: "Open intake", href: "/intake", icon: UserPlus },
  { title: "Matter command rooms", status: "Operational", description: "Run documents, evidence, deadlines, delegation, procedure, finance, client updates and institutional memory from the matter itself.", cta: "Open matters", href: "#matters", icon: BriefcaseBusiness },
  { title: "Firm access & governance", status: "Operational", description: "Session-backed identity, firm membership, role permissions, ethical walls and controlled onboarding keep every workspace tied to a real firm context.", cta: "Access controls", href: "/auth", icon: Building2 },
  { title: "Case file studio", status: "Operational", description: "Structure digital case files, register core case fields, work from templates and produce matter-linked drafts without separating drafting from the file.", cta: "Use in a matter", href: "#matters", icon: FileStack },
  { title: "Matter finance", status: "Operational", description: "Create invoices, track provisions and balances, preserve changes in the audit trail and connect mobile-money collection to the matter ledger.", cta: "Use in a matter", href: "#matters", icon: Receipt },
  { title: "Legal intelligence", status: "Governed AI", description: "Research and AI work are routed by firm privacy policy across OpenRouter, Gemini or local AI, with provider runs and activity provenance recorded.", cta: "Open Law Bank", href: "/law-bank", icon: Sparkles },
];

const infrastructure = [
  "Secure Vault / Supabase private storage",
  "Nextcloud WebDAV",
  "Meta WhatsApp Cloud API",
  "Firebase Cloud Messaging",
  "OpenRouter governed AI",
  "pawaPay mobile-money collection",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper-white text-slate-700">
      <section className="border-b border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(197,160,89,0.20),_transparent_31%),radial-gradient(circle_at_82%_8%,_rgba(15,74,59,0.13),_transparent_26%),linear-gradient(135deg,_#f7f5ef_0%,_#fbfaf6_44%,_#edf5f1_100%)] px-4 py-6 md:px-6 xl:px-8">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <div className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/82 p-6 shadow-[0_24px_70px_rgba(0,54,41,0.09)] backdrop-blur lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-5xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-heritage-green/10 bg-heritage-green/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-heritage-green"><ShieldCheck className="h-3.5 w-3.5" />Edanate Lawyers · TSIDKENU Legal OS</div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Matter-first legal operating system</p>
                <h1 className="mt-3 max-w-5xl text-4xl heading-serif text-heritage-green md:text-6xl">One controlled workspace for the full life of legal work.</h1>
              </div>
              <p className="max-w-4xl text-sm leading-7 text-slate-600 md:text-base">From first contact to conflict review, matter opening, evidence, procedure, collaboration, AI-assisted research, billing, client communication and closure, TSIDKENU keeps legal work connected to the same governed record.</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/intake" className="inline-flex items-center gap-2 rounded-full bg-[#082b22] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg">Start legal intake <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/system" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-heritage-green"><Network className="h-4 w-4" />System & integrations</Link>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[330px]"><AuthSessionPill /><div className="rounded-[1.5rem] bg-[#082b22] p-5 text-white shadow-[0_18px_38px_rgba(0,54,41,0.16)]"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Operating spine</p><p className="mt-2 text-lg font-semibold">Contact → Assessment → Matter → Work → Finance → Closure</p><p className="mt-2 text-sm leading-6 text-white/72">The product is organised around the legal lifecycle, not isolated feature screens.</p></div></div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="grid gap-4 md:grid-cols-3">{workingTracks.map((track) => (<Link key={track.title} href={track.href} className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-heritage-green/25 hover:shadow-[0_18px_36px_rgba(0,54,41,0.08)]"><div className="flex items-center justify-between gap-3"><div className="rounded-2xl bg-heritage-green/6 p-3 text-heritage-green"><track.icon className="h-5 w-5" /></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{track.status}</span></div><h2 className="mt-4 text-xl heading-serif text-heritage-green">{track.title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{track.description}</p><div className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500"><span>{track.cta}</span><ArrowRight className="h-3.5 w-3.5 text-heritage-green transition group-hover:translate-x-0.5" /></div></Link>))}</div>

            <div className="rounded-[1.6rem] border border-slate-200 bg-[#0a3026] p-5 text-white shadow-[0_20px_50px_rgba(0,54,41,0.14)]"><div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3 text-gold-accent"><Network className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Connected infrastructure</p><h2 className="mt-1 text-lg font-semibold">Provider-neutral by design</h2></div></div><p className="mt-4 text-sm leading-6 text-white/70">TSIDKENU keeps the legal record and governance layer independent from the infrastructure provider underneath it.</p><div className="mt-5 space-y-2">{infrastructure.map((item) => (<div key={item} className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/5 px-4 py-3"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /><span className="text-sm text-white/88">{item}</span></div>))}</div></div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 md:px-6 xl:px-8"><div className="mx-auto max-w-[1700px] space-y-4"><div id="matters" className="flex items-start justify-between gap-4 rounded-[1.7rem] border border-slate-200 bg-white p-5"><div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Operating cockpit</p><h2 className="mt-2 text-2xl heading-serif text-heritage-green">Run active legal work from the matter room</h2><p className="mt-3 text-sm leading-7 text-slate-600">Matter rooms combine collaboration, file structure, deadlines, evidence, procedure, finance, compliance and institutional recall so work does not fragment across disconnected tools.</p></div><div className="hidden rounded-[1.3rem] bg-[#082b22] px-4 py-3 text-white lg:block"><div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-gold-accent" /><span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Core route</span></div><p className="mt-2 text-sm font-semibold">Cockpit → Matter → Specialist workspaces</p></div></div><FirmCockpit /></div></section>
    </main>
  );
}
