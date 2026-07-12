"use client"
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import MatterWorkspace from "@/components/MatterWorkspace";
import { seededMatterWorkspaceRecords, type MatterWorkspaceData } from "@/lib/matters";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileArchive,
  FolderKanban,
  Hash,
  MessageSquare,
  ShieldCheck,
  SquareStack,
  Users,
  Workflow,
} from "lucide-react";

type PermissionKey =
  | "openMatters"
  | "assignWork"
  | "approveFilings"
  | "viewBilling"
  | "manageEvidence"
  | "editDeadlines"
  | "inviteCollaborators"
  | "exportAudit";

type Role = {
  id: string;
  title: string;
  focus: string;
  users: number;
  accent: string;
  permissions: PermissionKey[];
};

const permissions: { key: PermissionKey; label: string; hint: string }[] = [
  { key: "openMatters", label: "Open matters", hint: "Create and classify new cases" },
  { key: "assignWork", label: "Assign work", hint: "Delegate tasks across the team" },
  { key: "approveFilings", label: "Approve filings", hint: "Sign off before court submission" },
  { key: "viewBilling", label: "View billing", hint: "Access provisions, invoices, and recovery" },
  { key: "manageEvidence", label: "Manage evidence", hint: "Register digital and paper exhibits" },
  { key: "editDeadlines", label: "Edit deadlines", hint: "Adjust procedural calendars and alerts" },
  { key: "inviteCollaborators", label: "Invite collaborators", hint: "Share a matter with external counsel" },
  { key: "exportAudit", label: "Export audit trail", hint: "Download human and AI activity history" },
];

const initialRoles: Role[] = [
  {
    id: "partner",
    title: "Partner",
    focus: "Owns matter strategy, approvals, and final accountability.",
    users: 4,
    accent: "from-[#0d4a3a] to-[#1b725a]",
    permissions: permissions.map((item) => item.key),
  },
  {
    id: "lawyer",
    title: "Lawyer",
    focus: "Drives legal reasoning, drafting, client advice, and court readiness.",
    users: 9,
    accent: "from-[#315e51] to-[#628774]",
    permissions: ["openMatters", "assignWork", "manageEvidence", "editDeadlines", "viewBilling"],
  },
  {
    id: "project-manager",
    title: "Project Manager",
    focus: "Coordinates timelines, handoffs, hearing prep, and delivery rhythm.",
    users: 3,
    accent: "from-[#7a5b25] to-[#b88d43]",
    permissions: ["assignWork", "manageEvidence", "editDeadlines", "inviteCollaborators", "exportAudit"],
  },
  {
    id: "paralegal",
    title: "Paralegal",
    focus: "Keeps documents, exhibits, service records, and reminders aligned.",
    users: 6,
    accent: "from-[#43695f] to-[#81a497]",
    permissions: ["openMatters", "manageEvidence", "editDeadlines"],
  },
  {
    id: "intern",
    title: "Intern",
    focus: "Prepares research, clauses, and structured drafts for review.",
    users: 5,
    accent: "from-[#c8b07a] to-[#e1d3aa]",
    permissions: ["manageEvidence"],
  },
];

const feed = [
  {
    time: "10:32",
    actor: "Marie Ekani",
    role: "Intern",
    text: "Requested deadline verification for the opposition filing.",
    status: "AI assisted",
  },
  {
    time: "10:35",
    actor: "John Nkoa",
    role: "Lawyer",
    text: "Flagged Ascension Day overlap and requested manual holiday review.",
    status: "Human review",
  },
  {
    time: "10:38",
    actor: "Amina Bello",
    role: "Project Manager",
    text: "Moved service-of-process follow-up to urgent lane and notified clerk.",
    status: "Workflow update",
  },
  {
    time: "10:42",
    actor: "Sarah Mvondo",
    role: "Partner",
    text: "Approved final deadline and authorized filing packet preparation.",
    status: "Approved",
  },
];

const taskLanes = [
  {
    title: "Open Intake",
    count: 6,
    cards: [
      "Salary non-payment intake from Douala",
      "Insurance recovery bundle awaiting retainer",
    ],
  },
  {
    title: "Active Preparation",
    count: 4,
    cards: [
      "Mise en demeure exhibits cross-check",
      "Board resolution annex review",
    ],
  },
  {
    title: "Partner Review",
    count: 2,
    cards: [
      "Assignation package for K-Metal SARL",
      "Settlement terms before client approval",
    ],
  },
];

const physicalFiles = [
  {
    id: "TSK-CM-2026-041",
    label: "Blue archive jacket",
    location: "Shelf B2 / Cabinet 4",
    custody: "Paralegal desk sign-out",
  },
  {
    id: "TSK-CM-2026-042",
    label: "Red urgent hearing folder",
    location: "Litigation room / Tray 2",
    custody: "Project manager overnight hold",
  },
];

export default function CooperationHub() {
  const [roles, setRoles] = useState(initialRoles);
  const [activeRoleId, setActiveRoleId] = useState(initialRoles[0].id);
  const [matterMode, setMatterMode] = useState<"contentious" | "advisory">("contentious");
  const [matters, setMatters] = useState<MatterWorkspaceData[]>(seededMatterWorkspaceRecords);

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  const featuredMatter = matters[0];

  useEffect(() => {
    let cancelled = false;

    async function loadMatters() {
      try {
        const response = await fetch("/api/matters", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { matters?: MatterWorkspaceData[] };
        if (!cancelled && payload.matters?.length) {
          setMatters(payload.matters);
        }
      } catch {
        // Seeded fallback already covers the UI when live backend config is absent.
      }
    }

    void loadMatters();

    return () => {
      cancelled = true;
    };
  }, []);

  const togglePermission = (permission: PermissionKey) => {
    setRoles((current) =>
      current.map((role) =>
        role.id !== activeRoleId
          ? role
          : {
              ...role,
              permissions: role.permissions.includes(permission)
                ? role.permissions.filter((item) => item !== permission)
                : [...role.permissions, permission],
            }
      )
    );
  };

  return (
    <section className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(197,160,89,0.18),_transparent_36%),linear-gradient(135deg,_#f8f5ef_0%,_#ffffff_45%,_#edf4f1_100%)] p-8 shadow-[0_30px_80px_rgba(0,54,41,0.08)]">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_top,_rgba(0,54,41,0.16),_transparent_58%)] md:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-heritage-green/15 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-heritage-green">
                  Cooperation Engine
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Human-led AI
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl leading-tight text-heritage-green heading-serif md:text-5xl">
                  Build the matter room where partner, lawyer, project manager, and clerk actually work together.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  This workspace turns TSIDEK from a collection of legal modules into a coordinated operating layer:
                  role design, permissions, structured intake, physical file linkage, and a visible audit trail.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard icon={Users} label="Active practitioners" value="27" hint="Across 5 custom roles" />
                <MetricCard icon={Workflow} label="Open coordination tasks" value="14" hint="6 blocked, 8 progressing" />
                <MetricCard icon={ShieldCheck} label="Human approvals" value="93%" hint="Before external action" />
              </div>
            </div>

            <div className="relative rounded-[1.75rem] border border-[#d7dfdb] bg-white/90 p-6 shadow-[0_16px_42px_rgba(0,54,41,0.08)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Matter launch profile</p>
                  <h2 className="mt-2 text-lg font-bold text-heritage-green">Case opening protocol</h2>
                </div>
                <div className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-heritage-green">
                  Route-backed
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-[1.25rem] bg-[#f3f5f2] p-2">
                  <button
                    onClick={() => setMatterMode("contentious")}
                    className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                      matterMode === "contentious"
                        ? "bg-white text-heritage-green shadow-sm"
                        : "text-slate-400"
                    }`}
                  >
                    Contentious
                  </button>
                  <button
                    onClick={() => setMatterMode("advisory")}
                    className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                      matterMode === "advisory"
                        ? "bg-white text-heritage-green shadow-sm"
                        : "text-slate-400"
                    }`}
                  >
                    Advisory
                  </button>
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-[#fcfcfb] p-5">
                  <Field label="Client / Entity" value={featuredMatter.clientName} />
                  <Field label="Matter type" value={matterMode === "contentious" ? featuredMatter.matterType : "Commercial advisory retainer"} />
                  <Field label="Lead lawyer" value={featuredMatter.leadLawyer} />
                  <Field label="Project manager" value={featuredMatter.projectManager} />
                  <Field label="Physical file ID" value={featuredMatter.physicalFileId} mono />
                </div>

                <Link
                  href={`/matters/${featuredMatter.id}`}
                  className="flex items-center justify-between rounded-[1.25rem] bg-[#082921] px-5 py-4 text-white transition hover:bg-[#0d3128]"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Paper-digital link</p>
                    <p className="mt-1 text-sm font-semibold">Open full matter room for this file</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gold-accent" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {matters.map((matter) => (
            <Link
              key={matter.id}
              href={`/matters/${matter.id}`}
              className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-heritage-green/25 hover:shadow-[0_18px_38px_rgba(0,54,41,0.06)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{matter.status}</p>
                  <h2 className="mt-2 text-xl heading-serif text-heritage-green">{matter.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{matter.jurisdiction}</p>
                </div>
                <ExternalLink className="h-5 w-5 text-slate-300" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoTile icon={Hash} label="Physical file" value={matter.physicalFileId} />
                <InfoTile icon={ClipboardList} label="Lead team" value={`${matter.leadLawyer} / ${matter.projectManager}`} />
              </div>
            </Link>
          ))}
        </div>

        {featuredMatter && <MatterWorkspace matter={featuredMatter} />}

        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Role Builder</p>
                  <h2 className="mt-2 text-2xl heading-serif text-heritage-green">Firm-specific operating roles</h2>
                </div>
                <div className="rounded-full bg-[#f3f5f2] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Fully customizable
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {roles.map((role) => {
                  const active = role.id === activeRoleId;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setActiveRoleId(role.id)}
                      className={`text-left rounded-[1.5rem] border p-5 transition ${
                        active
                          ? "border-heritage-green bg-[#f7fbf9] shadow-[0_12px_30px_rgba(0,54,41,0.08)]"
                          : "border-slate-200 bg-white hover:border-heritage-green/30"
                      }`}
                    >
                      <div className={`mb-4 h-2 rounded-full bg-gradient-to-r ${role.accent}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{role.title}</h3>
                          <p className="mt-2 text-xs leading-6 text-slate-500">{role.focus}</p>
                        </div>
                        {active && <CheckCircle2 className="mt-1 h-5 w-5 text-heritage-green" />}
                      </div>
                      <div className="mt-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        <span>{role.users} users</span>
                        <span>{role.permissions.length} powers</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Permission Matrix</p>
                  <h2 className="mt-2 text-2xl heading-serif text-heritage-green">{activeRole.title} authority profile</h2>
                </div>
                <div className="rounded-full border border-heritage-green/10 bg-heritage-green/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-heritage-green">
                  Live preview
                </div>
              </div>

              <div className="grid gap-3">
                {permissions.map((item) => {
                  const enabled = activeRole.permissions.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => togglePermission(item.key)}
                      className={`flex items-center justify-between gap-4 rounded-[1.25rem] border px-5 py-4 text-left transition ${
                        enabled
                          ? "border-heritage-green/20 bg-[#f6fbf8]"
                          : "border-slate-200 bg-[#fcfcfb]"
                      }`}
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{item.label}</h3>
                        <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                      </div>
                      <div
                        className={`h-8 w-14 rounded-full p-1 transition ${
                          enabled ? "bg-heritage-green" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`h-6 w-6 rounded-full bg-white transition ${
                            enabled ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Matter board</p>
                  <h2 className="mt-2 text-2xl heading-serif text-heritage-green">Cooperation lanes</h2>
                </div>
                <FolderKanban className="h-5 w-5 text-heritage-green" />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {taskLanes.map((lane) => (
                  <div key={lane.title} className="rounded-[1.5rem] border border-slate-200 bg-[#fbfbfa] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">{lane.title}</h3>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-heritage-green">
                        {lane.count}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {lane.cards.map((card) => (
                        <motion.div
                          whileHover={{ y: -2 }}
                          key={card}
                          className="rounded-[1.2rem] border border-white bg-white p-4 shadow-sm"
                        >
                          <p className="text-sm font-semibold text-slate-800">{card}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Case file integrity</p>
                  <h2 className="mt-2 text-2xl heading-serif text-heritage-green">Digital and physical linkage</h2>
                </div>
                <FileArchive className="h-5 w-5 text-heritage-green" />
              </div>

              <div className="space-y-4">
                {physicalFiles.map((file) => (
                  <div key={file.id} className="rounded-[1.4rem] border border-slate-200 bg-[#fcfcfb] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-heritage-green/6 p-3 text-heritage-green">
                          <Hash className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{file.id}</h3>
                          <p className="text-xs text-slate-500">{file.label}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Tracked
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <InfoTile icon={SquareStack} label="Storage location" value={file.location} />
                      <InfoTile icon={ClipboardList} label="Custody" value={file.custody} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#0b211c] p-7 text-white shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Matter feed</p>
                  <h2 className="mt-2 text-2xl heading-serif text-white">Visible human and AI activity</h2>
                </div>
                <MessageSquare className="h-5 w-5 text-gold-accent" />
              </div>

              <div className="space-y-4">
                {feed.map((item) => (
                  <div key={`${item.time}-${item.actor}`} className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.actor}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                          {item.role} • {item.time}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-accent">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-white/72">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-2xl bg-heritage-green/6 p-3 text-heritage-green">
          <Icon className="h-5 w-5" />
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-heritage-green">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <span className={`text-right text-sm text-slate-700 ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-white bg-white p-4">
      <div className="mb-3 flex items-center gap-3 text-heritage-green">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
