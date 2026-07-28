"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, Database, FileStack, Receipt, ShieldCheck, UserPlus, Workflow } from "lucide-react";
import AuthSessionPill from "@/components/AuthSessionPill";
import FirmCockpit from "@/components/FirmCockpit";

const workingTracks = [
  {
    title: "Governed intake",
    status: "Live path",
    description:
      "Capture the enquiry, register connected parties, run conflict review, approve engagement terms, complete the opening checklist, then open the matter.",
    cta: "Open intake route",
    href: "/intake",
    icon: UserPlus,
  },
  {
    title: "Matter rooms",
    status: "Live path",
    description:
      "Work documents, tasks, deadlines, comments, physical file custody, compliance, jurisprudence, finance, and institutional memory from one controlled matter route.",
    cta: "Open a matter below",
    href: "#matters",
    icon: BriefcaseBusiness,
  },
  {
    title: "Controlled onboarding",
    status: "Live path",
    description:
      "Email OTP, session-backed identity, and explicit firm onboarding are wired so the legal workspace starts from a real firm context.",
    cta: "Go to access",
    href: "/auth",
    icon: Building2,
  },
  {
    title: "Case file studio",
    status: "Backed by API",
    description:
      "Inside each matter room, the case file studio can register case fields, digital case files, template profiles, and personalized draft generations.",
    cta: "Use it from a matter room",
    href: "#new-matter",
    icon: FileStack,
  },
  {
    title: "Matter finance",
    status: "Live path",
    description:
      "Inside each matter, create invoices, track paid and outstanding amounts, and preserve finance changes in the matter audit trail.",
    cta: "Use from a matter room",
    href: "#matters",
    icon: Receipt,
  },
  {
    title: "RAG source inbox",
    status: "Staging path",
    description:
      "Place prepared jurisprudence, statutes, book scans, templates, and firm notes in a controlled local shelf before OCR, chunking, and embeddings.",
    cta: "Open source inbox",
    href: "/rag-inbox",
    icon: Database,
  },
];

const controlledModules = [
  "AI prediction claims",
  "Standalone billing outside matters",
  "Uncontrolled document warehouse",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper-white text-slate-700">
      <section className="border-b border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(197,160,89,0.18),_transparent_32%),linear-gradient(135deg,_#f7f5ef_0%,_#fbfaf6_42%,_#eef5f1_100%)] px-4 py-6 md:px-6 xl:px-8">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <div className="flex flex-col gap-5 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_22px_60px_rgba(0,54,41,0.08)] backdrop-blur lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-heritage-green/10 bg-heritage-green/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-heritage-green">
                <ShieldCheck className="h-3.5 w-3.5" />
                Governed operating path
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">TSIDEK OS</p>
                <h1 className="mt-3 text-4xl heading-serif text-heritage-green md:text-5xl">
                  A legal operating system where intake, matters, documents, finance, and memory stay connected.
                </h1>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                The strongest path is now explicit: authenticate, start with governed intake, clear conflict and engagement,
                open the matter room, then run documents, collaboration, compliance, finance, and institutional memory from that route.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[320px]">
              <AuthSessionPill />
              <div className="rounded-[1.5rem] bg-[#082b22] p-5 text-white shadow-[0_18px_38px_rgba(0,54,41,0.16)]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Readiness</p>
                <p className="mt-2 text-lg font-semibold">Matter workflow is the real demo path.</p>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  The lead demo is the real legal chain: intake gate, matter room, document control, finance ledger, and audit trail.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-3">
              {workingTracks.map((track) => (
                <Link
                  key={track.title}
                  href={track.href}
                  className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-heritage-green/25 hover:shadow-[0_18px_36px_rgba(0,54,41,0.08)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl bg-heritage-green/6 p-3 text-heritage-green">
                      <track.icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {track.status}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl heading-serif text-heritage-green">{track.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{track.description}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    <span>{track.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-heritage-green" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="rounded-[1.6rem] border border-slate-200 bg-[#f8fbf9] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gold-accent/15 p-3 text-[#8f6b21]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Product discipline</p>
                  <h2 className="mt-1 text-lg font-semibold text-heritage-green">Things we should not oversell yet</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                TSIDEK should win by being reliable. These areas remain controlled until the supporting data, permissions, and evidence chain are strong enough.
              </p>
              <div className="mt-5 space-y-3">
                {controlledModules.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
                    <span className="text-sm text-slate-700">{item}</span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                      Next phase
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 md:px-6 xl:px-8">
        <div className="mx-auto max-w-[1700px] space-y-4">
          <div id="matters" className="flex items-start justify-between gap-4 rounded-[1.7rem] border border-slate-200 bg-white p-5">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Operating cockpit</p>
              <h2 className="mt-2 text-2xl heading-serif text-heritage-green">Run active legal work from the matter room</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Matter rooms are the main operating surface for team collaboration, case file structure, live comments,
                task orchestration, document registration, physical file linkage, finance, compliance controls, and recall memory.
              </p>
            </div>
            <div className="hidden rounded-[1.3rem] bg-[#082b22] px-4 py-3 text-white lg:block">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-gold-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Current lead path</span>
              </div>
              <p className="mt-2 text-sm font-semibold">Cockpit → Matter → Workspaces</p>
            </div>
          </div>

          <FirmCockpit />
        </div>
      </section>
    </main>
  );
}
