"use client";

import React, { useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Search, Sparkles, Workflow } from "lucide-react";
import type { MatterWorkspaceData } from "@/lib/matters";

type MatterListPayload = {
  matters?: MatterWorkspaceData[];
  error?: string;
};

type SessionPayload = {
  authenticated: boolean;
  needsOnboarding?: boolean;
};

export default function FirmCockpit() {
  const router = useRouter();
  const [matters, setMatters] = useState<MatterWorkspaceData[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createClientName, setCreateClientName] = useState("");
  const [createMatterType, setCreateMatterType] = useState("Commercial matter");
  const [createJurisdiction, setCreateJurisdiction] = useState("OHADA");
  const [createRiskLevel, setCreateRiskLevel] = useState("Medium");
  const [createStatus, setCreateStatus] = useState("Onboarding");
  const [createSynopsis, setCreateSynopsis] = useState("");
  const [createPrimaryTrack, setCreatePrimaryTrack] = useState("Matter onboarding and first working draft");
  const [createRiskToMonitor, setCreateRiskToMonitor] = useState("To be determined");
  const [createAiUsageRule, setCreateAiUsageRule] = useState("AI suggestions require human review");
  const [createNextDraft, setCreateNextDraft] = useState("Initial working draft");

  useEffect(() => {
    let cancelled = false;

    async function ensureOnboardingComplete() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) {
          return false;
        }

        const payload = (await response.json()) as SessionPayload;
        if (payload.authenticated && payload.needsOnboarding) {
          router.replace("/onboarding");
          return true;
        }
      } catch {
        // Let the matter load continue if the session check fails.
      }

      return false;
    }

    async function loadMatters() {
      try {
        if (await ensureOnboardingComplete()) {
          return;
        }

        const response = await fetch("/api/matters", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json()) as MatterListPayload;
          throw new Error(payload.error ?? "Unable to load matters");
        }

        const payload = (await response.json()) as MatterListPayload;
        if (!cancelled) {
          setMatters(payload.matters ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Live matters are not available yet. Showing the current prototype view.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMatters();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMatters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return matters;
    }

    return matters.filter((matter) =>
      [matter.title, matter.clientName, matter.jurisdiction, matter.status, matter.riskLevel]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [matters, query]);

  const highlightedMatter = visibleMatters[0];

  async function createMatter() {
    if (!createTitle.trim() || !createClientName.trim()) {
      setError("Matter title and client name are required.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createMatter",
          title: createTitle.trim(),
          clientName: createClientName.trim(),
          matterType: createMatterType.trim(),
          jurisdiction: createJurisdiction.trim(),
          riskLevel: createRiskLevel,
          status: createStatus,
          synopsis: createSynopsis.trim(),
          primaryTrack: createPrimaryTrack.trim(),
          riskToMonitor: createRiskToMonitor.trim(),
          aiUsageRule: createAiUsageRule.trim(),
          nextDraft: createNextDraft.trim(),
        }),
      });

      const payload = (await response.json()) as { success?: boolean; matterId?: string; error?: string };
      if (!response.ok || !payload.success || !payload.matterId) {
        throw new Error(payload.error ?? "Unable to create matter.");
      }

      startTransition(() => {
        router.push(`/matters/${payload.matterId}`);
        router.refresh();
      });
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Unable to create matter.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1700px] px-4 pt-6 md:px-6 xl:px-8">
      <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,_#092c24_0%,_#0f4a39_58%,_#1f6b52_100%)] p-6 text-white shadow-[0_24px_60px_rgba(0,54,41,0.16)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              Live case launchpad
            </div>
            <h2 className="max-w-3xl text-3xl font-semibold heading-serif md:text-4xl">
              Open a matter, work the file, and jump straight into a section that changes the case.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/72">
              This is the real front door now. Open a matter room, go directly to documents, intelligence, or collaboration,
              and use the prototype as a working legal system instead of a gallery of screens.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <MetricPill label="Live matters" value={`${visibleMatters.length || 0}`} />
            <MetricPill label="Direct routes" value="Documents / Intelligence / Collaboration" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_260px]">
          <label className="rounded-[1.4rem] border border-white/10 bg-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-white/50">
              <Search className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">Search matters</span>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Client, matter, jurisdiction, status..."
              className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>

          <Link
            href={highlightedMatter ? `/matters/${highlightedMatter.id}` : "/"}
            className="inline-flex items-center justify-between rounded-[1.4rem] bg-white px-5 py-4 text-[#0c3229] transition hover:bg-amber-50"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Continue working</p>
              <p className="mt-1 text-sm font-semibold">{highlightedMatter ? highlightedMatter.clientName : "Open a matter"}</p>
            </div>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {isLoading ? (
            <LoadingMatterCards />
          ) : visibleMatters.length ? (
            visibleMatters.map((matter) => (
              <article
                key={matter.id}
                className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-heritage-green/25 hover:shadow-[0_18px_40px_rgba(0,54,41,0.08)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-heritage-green">
                        {matter.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {matter.jurisdiction}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Risk: {matter.riskLevel}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl heading-serif text-heritage-green">{matter.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {matter.clientName} • Lead: {matter.leadLawyer} • PM: {matter.projectManager}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <QuickFact icon={FileText} label="Next draft" value={matter.nextDraft} />
                      <QuickFact icon={Workflow} label="Primary track" value={matter.primaryTrack} />
                      <QuickFact icon={Sparkles} label="AI rule" value={matter.aiUsageRule} />
                    </div>
                  </div>

                  <div className="grid gap-2 lg:w-[260px]">
                    <Link href={`/matters/${matter.id}`} className="rounded-2xl bg-heritage-green px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white">
                      Open matter
                    </Link>
                    <Link href={`/matters/${matter.id}?tab=documents`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                      Documents
                    </Link>
                    <Link href={`/matters/${matter.id}?tab=intelligence`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                      Intelligence
                    </Link>
                    <Link href={`/matters/${matter.id}?tab=collaboration`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                      Collaboration
                    </Link>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.7rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No matters matched your search.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div id="new-matter" className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Open a new matter</p>
            <h3 className="mt-2 text-lg font-semibold text-heritage-green">Matter intake that actually creates a case</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Matter title"
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
              />
              <input
                value={createClientName}
                onChange={(event) => setCreateClientName(event.target.value)}
                placeholder="Client name"
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={createMatterType}
                  onChange={(event) => setCreateMatterType(event.target.value)}
                  placeholder="Matter type"
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                />
                <input
                  value={createJurisdiction}
                  onChange={(event) => setCreateJurisdiction(event.target.value)}
                  placeholder="Jurisdiction"
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={createRiskLevel}
                  onChange={(event) => setCreateRiskLevel(event.target.value)}
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                >
                  {["Low", "Medium", "High"].map((item) => (
                    <option key={item} value={item}>
                      Risk: {item}
                    </option>
                  ))}
                </select>
                <select
                  value={createStatus}
                  onChange={(event) => setCreateStatus(event.target.value)}
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                >
                  {["Lead", "Onboarding", "Active", "In Court", "Closed"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={createSynopsis}
                onChange={(event) => setCreateSynopsis(event.target.value)}
                placeholder="Short matter synopsis"
                className="min-h-24 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
              />
              <textarea
                value={createPrimaryTrack}
                onChange={(event) => setCreatePrimaryTrack(event.target.value)}
                placeholder="Primary track"
                className="min-h-20 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={createRiskToMonitor}
                  onChange={(event) => setCreateRiskToMonitor(event.target.value)}
                  placeholder="Risk to monitor"
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                />
                <input
                  value={createNextDraft}
                  onChange={(event) => setCreateNextDraft(event.target.value)}
                  placeholder="Next draft"
                  className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
                />
              </div>
              <textarea
                value={createAiUsageRule}
                onChange={(event) => setCreateAiUsageRule(event.target.value)}
                placeholder="AI usage rule"
                className="min-h-20 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-3 text-sm outline-none focus:border-heritage-green"
              />
              <button
                onClick={() => void createMatter()}
                disabled={isCreating}
                className="rounded-2xl bg-heritage-green px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create and open matter"}
              </button>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">What matters do here</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>1. Open the matter room.</p>
              <p>2. Jump directly to documents, intelligence, or collaboration.</p>
              <p>3. Register files, notes, tasks, and follow-ups in one place.</p>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-[#0b211c] p-5 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Launch check</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-white/72">
              <p>The strongest working path is now the matter route, not the module gallery.</p>
              <p>Use the direct links above to verify that each section does real work.</p>
            </div>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 text-xs text-slate-500">{error}</p>}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-white/10 bg-white/10 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function QuickFact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-heritage-green" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function LoadingMatterCards() {
  return (
    <div className="space-y-4">
      {[0, 1].map((item) => (
        <div key={item} className="h-44 animate-pulse rounded-[1.7rem] bg-white" />
      ))}
    </div>
  );
}
