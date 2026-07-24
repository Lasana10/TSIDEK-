"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Mic, ShieldAlert, Sparkles, UserPlus } from "lucide-react";

type IntakeClassification = {
  matterType: string;
  riskLevel: string;
  primaryTrack: string;
  nextDraft: string;
  suggestedProvision: number;
  rationale: string;
};

function classifyIntake(problemText: string, jurisdiction: string): IntakeClassification {
  const text = problemText.toLowerCase();

  if (text.includes("salary") || text.includes("dismiss") || text.includes("employment")) {
    return {
      matterType: "Labor dispute",
      riskLevel: "High",
      primaryTrack: `Urgent labor rights assessment in ${jurisdiction}`,
      nextDraft: "Demand letter and labor chronology memo",
      suggestedProvision: 350000,
      rationale: "Employment disputes usually need urgent chronology work, documentary proof, and fast client guidance.",
    };
  }

  if (text.includes("debt") || text.includes("invoice") || text.includes("payment") || text.includes("recovery")) {
    return {
      matterType: "Debt recovery / OHADA",
      riskLevel: "Medium",
      primaryTrack: `Structured recovery strategy in ${jurisdiction}`,
      nextDraft: "Demand package and assignation working draft",
      suggestedProvision: 750000,
      rationale: "Recovery matters benefit from fast document indexing, chronology building, and pre-filing pressure.",
    };
  }

  if (text.includes("insurance") || text.includes("claim") || text.includes("coverage")) {
    return {
      matterType: "Insurance dispute",
      riskLevel: "High",
      primaryTrack: `Coverage analysis and escalation path in ${jurisdiction}`,
      nextDraft: "Coverage memo and escalation brief",
      suggestedProvision: 650000,
      rationale: "Insurance disputes often require policy interpretation, chronology validation, and annex review.",
    };
  }

  if (text.includes("company") || text.includes("registration") || text.includes("shareholder") || text.includes("board")) {
    return {
      matterType: "Corporate advisory",
      riskLevel: "Medium",
      primaryTrack: `Corporate structuring and compliance support in ${jurisdiction}`,
      nextDraft: "Corporate memo and action checklist",
      suggestedProvision: 500000,
      rationale: "Corporate files usually need careful document assembly and structured follow-up rather than immediate litigation.",
    };
  }

  return {
    matterType: "General legal matter",
    riskLevel: "Medium",
    primaryTrack: `Initial matter assessment in ${jurisdiction}`,
    nextDraft: "Initial legal assessment note",
    suggestedProvision: 400000,
    rationale: "The intake needs a first-pass legal assessment before a more specific track is assigned.",
  };
}

export default function ClientIntake() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Cameroon / OHADA");
  const [problemText, setProblemText] = useState("");
  const [statusMode, setStatusMode] = useState<"Lead" | "Onboarding">("Lead");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMatterId, setCreatedMatterId] = useState<string | null>(null);

  const classification = useMemo(
    () => classifyIntake(problemText, jurisdiction),
    [problemText, jurisdiction]
  );

  async function createMatterFromIntake() {
    if (!clientName.trim() || !problemText.trim()) {
      setError("Client name and problem summary are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const title = `${clientName.trim()} intake`;
      const synopsis = [
        `Client contact: ${contactName.trim() || "Not provided"}.`,
        `Initial intake summary: ${problemText.trim()}`,
        `Classification rationale: ${classification.rationale}`,
      ].join(" ");

      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createMatter",
          title,
          clientName: clientName.trim(),
          matterType: classification.matterType,
          jurisdiction,
          riskLevel: classification.riskLevel,
          status: statusMode,
          synopsis,
          primaryTrack: classification.primaryTrack,
          riskToMonitor: "Validate evidence pack and client chronology",
          aiUsageRule: "Initial intake suggestions require lawyer review before client advice",
          nextDraft: classification.nextDraft,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; matterId?: string; error?: string };

      if (!response.ok || !payload.success || !payload.matterId) {
        throw new Error(payload.error ?? "Unable to create matter from intake.");
      }

      setCreatedMatterId(payload.matterId);
      router.push(`/matters/${payload.matterId}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create matter from intake.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,_#082b22_0%,_#0d4335_56%,_#c5a059_170%)] p-8 text-white shadow-[0_24px_54px_rgba(0,54,41,0.18)]">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/55">Structured intake</p>
            <h1 className="mt-4 text-4xl heading-serif text-white">Turn a first client story into a real matter workspace.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74">
              This intake surface now feeds the matter backend instead of stopping at animation. We classify the issue,
              shape the first working track, and open a real matter room for the team.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
                <UserPlus className="h-5 w-5 text-gold-accent" />
                <p className="mt-3 text-sm font-semibold">Lead to matter</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Creating from intake now generates a real matter record with synopsis, track, risk level, and next draft.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
                <BriefcaseBusiness className="h-5 w-5 text-gold-accent" />
                <p className="mt-3 text-sm font-semibold">Matter-first workflow</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Once the intake is created, the real work continues in the matter room where documents and collaboration live.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-[2rem] p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Intake form</p>
            <h2 className="mt-3 text-2xl heading-serif text-heritage-green">Capture the client issue and open the file</h2>

            <div className="mt-8 grid gap-4">
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client or entity name"
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-4 text-sm outline-none focus:border-heritage-green"
              />
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Contact person"
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-4 text-sm outline-none focus:border-heritage-green"
              />
              <input
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value)}
                placeholder="Jurisdiction"
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-4 text-sm outline-none focus:border-heritage-green"
              />
              <textarea
                value={problemText}
                onChange={(event) => setProblemText(event.target.value)}
                placeholder="Describe the client problem, dispute, urgency, and any known evidence..."
                className="min-h-40 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-4 text-sm outline-none focus:border-heritage-green"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStatusMode("Lead")}
                  className={`rounded-[1rem] border px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                    statusMode === "Lead"
                      ? "border-heritage-green bg-heritage-green text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  Save as lead
                </button>
                <button
                  type="button"
                  onClick={() => setStatusMode("Onboarding")}
                  className={`rounded-[1rem] border px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                    statusMode === "Onboarding"
                      ? "border-heritage-green bg-heritage-green text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  Open as matter
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-6 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            {createdMatterId ? (
              <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Matter created successfully. Opening the matter room now.
              </div>
            ) : null}

            <div className="mt-8">
              <button
                onClick={() => void createMatterFromIntake()}
                disabled={isSubmitting || !clientName.trim() || !problemText.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-heritage-green px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Creating matter..." : "Create intake matter"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-heritage-green/6 p-3 text-heritage-green">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Classification result</p>
                <h3 className="mt-1 text-lg font-semibold text-heritage-green">First-pass matter framing</h3>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <InfoRow label="Matter type" value={classification.matterType} />
              <InfoRow label="Risk level" value={classification.riskLevel} />
              <InfoRow label="Primary track" value={classification.primaryTrack} />
              <InfoRow label="Next draft" value={classification.nextDraft} />
              <InfoRow label="Suggested provision" value={`${classification.suggestedProvision.toLocaleString()} XAF`} />
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-slate-200 bg-[#0b211c] p-6 text-white shadow-[0_20px_44px_rgba(0,0,0,0.16)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-gold-accent">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Human control</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Why this intake path is safer</h3>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <PolicyRow
                icon={CheckCircle2}
                title="Backend-backed creation"
                body="The intake no longer dies in the UI. It writes a real matter through the existing matter API."
              />
              <PolicyRow
                icon={ShieldAlert}
                title="No fake legal advice"
                body="The classification is an operational triage aid, not a legal conclusion. Lawyers still own legal judgment."
              />
              <PolicyRow
                icon={BriefcaseBusiness}
                title="Matter room continuity"
                body="The value is continuity: intake leads directly into documents, tasks, collaboration, and compliance in the same system."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function PolicyRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-gold-accent" />
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/72">{body}</p>
    </div>
  );
}
