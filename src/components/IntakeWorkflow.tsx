"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProspectRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  matter_type: string;
  jurisdiction: string;
  summary: string;
  status: string;
  matter_id?: string | null;
  created_at: string;
  conflict_checks?: Array<{
    status: string;
    matches?: Array<{ name: string; detail: string }>;
    decision_note?: string | null;
  }>;
  engagements?: Array<{
    status: string;
    scope_of_work?: string | null;
    fee_arrangement?: string | null;
    decision_note?: string | null;
  }>;
  matter_opening_checklists?: Array<{
    identity_complete: boolean;
    conflict_cleared: boolean;
    engagement_approved: boolean;
    responsible_lawyer_assigned: boolean;
    responsible_lawyer_id?: string | null;
    initial_deadline_reviewed: boolean;
    initial_deadline_note?: string | null;
    document_structure_created: boolean;
    document_structure_note?: string | null;
    opening_notes?: string | null;
    completed_at?: string | null;
  }>;
  prospect_parties?: Array<{
    name: string;
    party_role: string;
  }>;
  intake_decision_events?: Array<{
    id: string;
    event_type: string;
    summary: string;
    detail?: string | null;
    created_at: string;
  }>;
};

type LawyerOption = {
  id: string;
  full_name: string;
  role: string | null;
};

type WorkflowState = {
  prospectId: string;
  name: string;
  conflictStatus: string;
  matches: Array<{ name: string; detail: string }>;
  engagementStatus: string;
  checklist: {
    identityComplete: boolean;
    conflictCleared: boolean;
    engagementApproved: boolean;
    responsibleLawyerAssigned: boolean;
    responsibleLawyerId: string | null;
    initialDeadlineReviewed: boolean;
    initialDeadlineNote: string;
    documentStructureCreated: boolean;
    documentStructureNote: string;
    openingNotes: string;
    completedAt: string | null;
  };
  events: Array<{
    id: string;
    eventType: string;
    summary: string;
    detail: string | null;
    createdAt: string;
  }>;
  matterId?: string | null;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-heritage-green focus:ring-2 focus:ring-heritage-green/10";

const checklistMeta = [
  {
    key: "identityComplete",
    label: "Client identity and contact are complete",
    help: "At least one reliable client contact route must exist before opening work.",
  },
  {
    key: "responsibleLawyerAssigned",
    label: "Responsible lawyer assigned",
    help: "Someone must own the matter before work begins.",
  },
  {
    key: "initialDeadlineReviewed",
    label: "Initial deadline review completed",
    help: "The first procedural or commercial timing review must be recorded.",
  },
  {
    key: "documentStructureCreated",
    label: "Document structure prepared",
    help: "The matter vault and file structure must be ready before activation.",
  },
] as const;

function deriveWorkflowState(prospect: ProspectRecord): WorkflowState {
  const conflict = prospect.conflict_checks?.[0];
  const engagement = prospect.engagements?.[0];
  const checklist = prospect.matter_opening_checklists?.[0];

  return {
    prospectId: prospect.id,
    name: prospect.name,
    conflictStatus: conflict?.status ?? "Pending",
    matches: Array.isArray(conflict?.matches) ? conflict.matches : [],
    engagementStatus: engagement?.status ?? "Draft",
    checklist: {
      identityComplete: Boolean(checklist?.identity_complete ?? prospect.email ?? prospect.phone),
      conflictCleared: Boolean(checklist?.conflict_cleared),
      engagementApproved: Boolean(checklist?.engagement_approved),
      responsibleLawyerAssigned: Boolean(checklist?.responsible_lawyer_assigned),
      responsibleLawyerId: checklist?.responsible_lawyer_id ?? null,
      initialDeadlineReviewed: Boolean(checklist?.initial_deadline_reviewed),
      initialDeadlineNote: checklist?.initial_deadline_note ?? "",
      documentStructureCreated: Boolean(checklist?.document_structure_created),
      documentStructureNote: checklist?.document_structure_note ?? "",
      openingNotes: checklist?.opening_notes ?? "",
      completedAt: checklist?.completed_at ?? null,
    },
    events: (prospect.intake_decision_events ?? [])
      .map((event) => ({
        id: event.id,
        eventType: event.event_type,
        summary: event.summary,
        detail: event.detail ?? null,
        createdAt: event.created_at,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    matterId: prospect.matter_id ?? null,
  };
}

export default function IntakeWorkflow() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    matterType: "General legal matter",
    jurisdiction: "OHADA",
    summary: "",
    opposingParty: "",
    scopeOfWork: "",
    feeArrangement: "",
  });
  const [state, setState] = useState<WorkflowState | null>(null);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [lawyers, setLawyers] = useState<LawyerOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingProspects, setLoadingProspects] = useState(true);
  const [message, setMessage] = useState("");

  const conflictCleared = state?.conflictStatus === "Cleared" || state?.conflictStatus === "Waived";
  const canOpen =
    Boolean(
      state &&
        conflictCleared &&
        state.engagementStatus === "Approved" &&
        state.checklist.identityComplete &&
        state.checklist.responsibleLawyerAssigned &&
        state.checklist.initialDeadlineReviewed &&
        state.checklist.documentStructureCreated
    );

  const selectedProspect = useMemo(
    () => prospects.find((prospect) => prospect.id === state?.prospectId) ?? null,
    [prospects, state?.prospectId]
  );

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function hydrateFromProspect(prospect: ProspectRecord) {
    const opposingParty =
      prospect.prospect_parties?.find((party) => party.party_role !== "Prospective client")?.name ?? "";
    const engagement = prospect.engagements?.[0];

    setForm({
      name: prospect.name ?? "",
      email: prospect.email ?? "",
      phone: prospect.phone ?? "",
      matterType: prospect.matter_type ?? "General legal matter",
      jurisdiction: prospect.jurisdiction ?? "OHADA",
      summary: prospect.summary ?? "",
      opposingParty,
      scopeOfWork: engagement?.scope_of_work ?? "",
      feeArrangement: engagement?.fee_arrangement ?? "",
    });
    setState(deriveWorkflowState(prospect));
  }

  async function loadProspects(selectProspectId?: string) {
    setLoadingProspects(true);
    try {
      const response = await fetch("/api/intake");
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        prospects?: ProspectRecord[];
        lawyers?: LawyerOption[];
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to load intake prospects.");
      }
      const nextProspects = result.prospects ?? [];
      setProspects(nextProspects);
      setLawyers(result.lawyers ?? []);

      const chosen =
        (selectProspectId ? nextProspects.find((item) => item.id === selectProspectId) : null) ??
        (state?.prospectId ? nextProspects.find((item) => item.id === state.prospectId) : null);

      if (chosen) {
        hydrateFromProspect(chosen);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load intake prospects.");
    } finally {
      setLoadingProspects(false);
    }
  }

  useEffect(() => {
    void loadProspects();
  }, []);

  async function call(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "The intake action could not be completed.");
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The intake action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createProspect() {
    const result = await call("createProspect", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      matterType: form.matterType,
      jurisdiction: form.jurisdiction,
      summary: form.summary,
      parties: form.opposingParty ? [{ name: form.opposingParty, partyRole: "Opposing party" }] : [],
    });
    if (!result?.prospect?.id) return;
    const prospectId = result.prospect.id as string;
    const check = await call("runConflictCheck", { prospectId });
    setState({
      prospectId,
      name: form.name,
      conflictStatus: check?.conflictCheck?.status ?? "Pending",
      matches: check?.conflictCheck?.matches ?? [],
      engagementStatus: "Draft",
      checklist: {
        identityComplete: Boolean(form.email.trim() || form.phone.trim()),
        conflictCleared: false,
        engagementApproved: false,
        responsibleLawyerAssigned: false,
        responsibleLawyerId: null,
        initialDeadlineReviewed: false,
        initialDeadlineNote: "",
        documentStructureCreated: false,
        documentStructureNote: "",
        openingNotes: "",
        completedAt: null,
      },
      events: [],
      matterId: null,
    });
    await loadProspects(prospectId);
  }

  async function decideConflict(status: "Cleared" | "Waived") {
    if (!state) return;
    const result = await call("decideConflict", {
      prospectId: state.prospectId,
      status,
      decisionNote: status === "Cleared" ? "Reviewed by responsible lawyer." : "Waiver recorded by authorised lawyer.",
    });
    if (result) {
      setState((current) =>
        current
          ? {
              ...current,
              conflictStatus: status,
              checklist: { ...current.checklist, conflictCleared: true },
              events: current.events,
            }
          : current
      );
      await loadProspects(state.prospectId);
    }
  }

  async function approveEngagement() {
    if (!state) return;
    const result = await call("saveEngagement", {
      prospectId: state.prospectId,
      scopeOfWork: form.scopeOfWork || form.summary,
      feeArrangement: form.feeArrangement || "To be agreed",
      approve: true,
      decisionNote: "Engagement approved for matter opening.",
    });
    if (result) {
      setState((current) =>
        current
          ? {
              ...current,
              engagementStatus: "Approved",
              checklist: { ...current.checklist, engagementApproved: true },
              events: current.events,
            }
          : current
      );
      await loadProspects(state.prospectId);
    }
  }

  async function updateChecklist(
    key:
      | "identityComplete"
      | "responsibleLawyerAssigned"
      | "initialDeadlineReviewed"
      | "documentStructureCreated",
    value: boolean
  ) {
    if (!state) return;
    const payload =
      key === "identityComplete"
        ? { identityComplete: value }
        : key === "responsibleLawyerAssigned"
          ? { responsibleLawyerAssigned: value }
          : key === "initialDeadlineReviewed"
            ? { initialDeadlineReviewed: value }
            : key === "documentStructureCreated"
              ? { documentStructureCreated: value }
              : null;

    if (!payload) return;

    const result = await call("updateChecklist", {
      prospectId: state.prospectId,
      ...payload,
      responsibleLawyerId: state.checklist.responsibleLawyerId,
      initialDeadlineNote: state.checklist.initialDeadlineNote,
      documentStructureNote: state.checklist.documentStructureNote,
      openingNotes: state.checklist.openingNotes,
    });

    if (result?.checklist) {
      setState((current) =>
        current
          ? {
              ...current,
              checklist: {
                ...current.checklist,
                identityComplete: result.checklist.identity_complete,
                conflictCleared: result.checklist.conflict_cleared,
                engagementApproved: result.checklist.engagement_approved,
                responsibleLawyerAssigned: result.checklist.responsible_lawyer_assigned,
                responsibleLawyerId: result.checklist.responsible_lawyer_id ?? null,
                initialDeadlineReviewed: result.checklist.initial_deadline_reviewed,
                initialDeadlineNote: result.checklist.initial_deadline_note ?? "",
                documentStructureCreated: result.checklist.document_structure_created,
                documentStructureNote: result.checklist.document_structure_note ?? "",
                openingNotes: result.checklist.opening_notes ?? "",
                completedAt: result.checklist.completed_at ?? null,
              },
            }
          : current
      );
      await loadProspects(state.prospectId);
    }
  }

  async function saveChecklistContext(patch: Partial<WorkflowState["checklist"]>) {
    if (!state) return;

    const nextChecklist = { ...state.checklist, ...patch };
    const result = await call("updateChecklist", {
      prospectId: state.prospectId,
      responsibleLawyerAssigned: nextChecklist.responsibleLawyerAssigned,
      responsibleLawyerId: nextChecklist.responsibleLawyerId,
      initialDeadlineReviewed: nextChecklist.initialDeadlineReviewed,
      initialDeadlineNote: nextChecklist.initialDeadlineNote,
      documentStructureCreated: nextChecklist.documentStructureCreated,
      documentStructureNote: nextChecklist.documentStructureNote,
      openingNotes: nextChecklist.openingNotes,
      identityComplete: nextChecklist.identityComplete,
    });

    if (result?.checklist) {
      setState((current) =>
        current
          ? {
              ...current,
              checklist: {
                ...current.checklist,
                identityComplete: result.checklist.identity_complete,
                conflictCleared: result.checklist.conflict_cleared,
                engagementApproved: result.checklist.engagement_approved,
                responsibleLawyerAssigned: result.checklist.responsible_lawyer_assigned,
                responsibleLawyerId: result.checklist.responsible_lawyer_id ?? null,
                initialDeadlineReviewed: result.checklist.initial_deadline_reviewed,
                initialDeadlineNote: result.checklist.initial_deadline_note ?? "",
                documentStructureCreated: result.checklist.document_structure_created,
                documentStructureNote: result.checklist.document_structure_note ?? "",
                openingNotes: result.checklist.opening_notes ?? "",
                completedAt: result.checklist.completed_at ?? null,
              },
            }
          : current
      );
      await loadProspects(state.prospectId);
    }
  }

  async function openMatter() {
    if (!state) return;
    const result = await call("openMatter", {
      prospectId: state.prospectId,
      opposingPartyName: form.opposingParty,
    });
    if (result?.matterId) {
      setState((current) => (current ? { ...current, matterId: result.matterId } : current));
      await loadProspects(state.prospectId);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-heritage-green">Controlled matter opening</p>
            <h1 className="mt-3 max-w-3xl text-4xl heading-serif text-heritage-green md:text-6xl">
              Intake that protects the firm before work begins.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Capture the enquiry, name the connected parties, run a conflict review, approve the engagement, confirm the opening checklist, and only then open the matter room.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                Prospective client name
                <input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Person or organisation" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Matter type
                <select className={inputClass} value={form.matterType} onChange={(event) => update("matterType", event.target.value)}>
                  <option>General legal matter</option>
                  <option>Litigation</option>
                  <option>Corporate transaction</option>
                  <option>Labour matter</option>
                  <option>Intellectual property</option>
                  <option>Debt recovery / OHADA</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Email
                <input className={inputClass} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="client@example.com" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Phone
                <input className={inputClass} value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+237 ..." />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Jurisdiction
                <input className={inputClass} value={form.jurisdiction} onChange={(event) => update("jurisdiction", event.target.value)} />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Opposing or related party
                <input className={inputClass} value={form.opposingParty} onChange={(event) => update("opposingParty", event.target.value)} placeholder="Add the first connected party" />
              </label>
            </div>
            <label className="mt-5 block text-xs font-bold text-slate-600">
              Issue summary
              <textarea
                className={`${inputClass} min-h-32`}
                value={form.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder="What is the client asking the firm to do?"
              />
            </label>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void createProspect()}
                disabled={busy || !form.name.trim() || !form.summary.trim()}
                className="rounded-full bg-heritage-green px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Working..." : "Create intake record"}
              </button>
              <span className="text-xs text-slate-400">No matter is opened at this stage.</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#fcfcfb] p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Pipeline memory</p>
                <h2 className="mt-2 text-2xl heading-serif text-heritage-green">Resume existing prospects</h2>
              </div>
              <button
                onClick={() => void loadProspects()}
                disabled={loadingProspects}
                className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 disabled:opacity-40"
              >
                {loadingProspects ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {prospects.length === 0 && !loadingProspects && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                  No saved prospects yet. The first intake record will appear here.
                </div>
              )}
              {prospects.map((prospect) => {
                const derived = deriveWorkflowState(prospect);
                const isSelected = state?.prospectId === prospect.id;
                return (
                  <button
                    key={prospect.id}
                    onClick={() => hydrateFromProspect(prospect)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected ? "border-heritage-green bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{prospect.name}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {prospect.matter_type} • {prospect.jurisdiction} • {prospect.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                          Conflict {derived.conflictStatus}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                          Engagement {derived.engagementStatus}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{prospect.summary}</p>
                    {prospect.matter_id && (
                      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-heritage-green">
                        Matter already opened
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl bg-heritage-green p-6 text-white shadow-xl md:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/50">Opening gate</p>
          <h2 className="mt-3 text-2xl heading-serif">A defensible chain from enquiry to matter.</h2>

          <div className="mt-8 space-y-4 text-sm">
            <Step number="01" label={`Prospect captured${state ? `: ${state.name}` : ""}`} done={Boolean(state)} />
            <Step number="02" label={`Conflict review: ${state?.conflictStatus ?? "Not started"}`} done={conflictCleared} />
            <Step number="03" label={`Engagement: ${state?.engagementStatus ?? "Not started"}`} done={state?.engagementStatus === "Approved"} />
            <Step
              number="04"
              label="Opening checklist confirmed"
              done={Boolean(
                state?.checklist.identityComplete &&
                  state?.checklist.responsibleLawyerAssigned &&
                  state?.checklist.initialDeadlineReviewed &&
                  state?.checklist.documentStructureCreated
              )}
            />
            <Step number="05" label="Matter room opened" done={Boolean(state?.matterId)} />
          </div>

          {state && !state.matterId && (
            <div className="mt-8 border-t border-white/15 pt-6">
              {state.matches.length > 0 && (
                <div className="rounded-2xl border border-amber-300/40 bg-amber-200/10 p-4 text-sm text-amber-100">
                  <p className="font-bold">Potential matches require review</p>
                  {state.matches.map((match) => (
                    <p key={`${match.name}-${match.detail}`} className="mt-2 text-xs text-amber-100/80">
                      {match.name}: {match.detail}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => void decideConflict("Cleared")}
                  disabled={busy || !state.matches.length}
                  className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-heritage-green disabled:opacity-40"
                >
                  Clear after review
                </button>
                <button
                  onClick={() => void decideConflict("Waived")}
                  disabled={busy || !state.matches.length}
                  className="rounded-full border border-white/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-40"
                >
                  Record waiver
                </button>
              </div>

              {state.conflictStatus === "Pending" && (
                <button
                  onClick={() => void decideConflict("Cleared")}
                  disabled={busy}
                  className="mt-3 rounded-full border border-emerald-200/40 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100"
                >
                  Confirm no conflict found
                </button>
              )}

              {conflictCleared && (
                <div className="mt-6 space-y-3">
                  <input
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                    value={form.scopeOfWork}
                    onChange={(event) => update("scopeOfWork", event.target.value)}
                    placeholder="Scope of work"
                  />
                  <input
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                    value={form.feeArrangement}
                    onChange={(event) => update("feeArrangement", event.target.value)}
                    placeholder="Fee arrangement"
                  />
                  <button
                    onClick={() => void approveEngagement()}
                    disabled={busy}
                    className="rounded-full bg-ochre px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-heritage-green"
                  >
                    Approve engagement
                  </button>
                </div>
              )}

              {state.engagementStatus === "Approved" && (
                <div className="mt-6 space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Matter opening checklist</p>
                  <label className="block">
                    <span className="text-xs font-bold text-white/80">Responsible lawyer</span>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                      value={state.checklist.responsibleLawyerId ?? ""}
                      onChange={(event) =>
                        setState((current) =>
                          current
                            ? {
                                ...current,
                                checklist: {
                                  ...current.checklist,
                                  responsibleLawyerId: event.target.value || null,
                                  responsibleLawyerAssigned: Boolean(event.target.value),
                                },
                              }
                            : current
                        )
                      }
                    >
                      <option value="">Select the lead lawyer</option>
                      {lawyers.map((lawyer) => (
                        <option key={lawyer.id} value={lawyer.id}>
                          {lawyer.full_name} {lawyer.role ? `(${lawyer.role})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() =>
                      void saveChecklistContext({
                        responsibleLawyerId: state.checklist.responsibleLawyerId,
                        responsibleLawyerAssigned: Boolean(state.checklist.responsibleLawyerId),
                      })
                    }
                    disabled={busy}
                    className="rounded-full border border-white/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-40"
                  >
                    Save lead assignment
                  </button>
                  {checklistMeta.map((item) => (
                    <label key={item.key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <input
                        type="checkbox"
                        checked={state.checklist[item.key]}
                        onChange={(event) => void updateChecklist(item.key, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-white/20"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">{item.help}</p>
                      </div>
                    </label>
                  ))}
                  <textarea
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                    value={state.checklist.initialDeadlineNote}
                    onChange={(event) =>
                      setState((current) =>
                        current
                          ? {
                              ...current,
                              checklist: { ...current.checklist, initialDeadlineNote: event.target.value },
                            }
                          : current
                      )
                    }
                    placeholder="Initial deadline note: limitation periods, hearing windows, filing urgency..."
                  />
                  <textarea
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                    value={state.checklist.documentStructureNote}
                    onChange={(event) =>
                      setState((current) =>
                        current
                          ? {
                              ...current,
                              checklist: { ...current.checklist, documentStructureNote: event.target.value },
                            }
                          : current
                      )
                    }
                    placeholder="Document structure note: vault folders, annex logic, physical originals, OneDrive linkage..."
                  />
                  <textarea
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                    value={state.checklist.openingNotes}
                    onChange={(event) =>
                      setState((current) =>
                        current
                          ? {
                              ...current,
                              checklist: { ...current.checklist, openingNotes: event.target.value },
                            }
                          : current
                      )
                    }
                    placeholder="Opening strategy note: first action plan, risk framing, client expectations..."
                  />
                  <button
                    onClick={() =>
                      void saveChecklistContext({
                        initialDeadlineNote: state.checklist.initialDeadlineNote,
                        documentStructureNote: state.checklist.documentStructureNote,
                        openingNotes: state.checklist.openingNotes,
                      })
                    }
                    disabled={busy}
                    className="rounded-full border border-white/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white disabled:opacity-40"
                  >
                    Save opening notes
                  </button>
                </div>
              )}

              {canOpen && (
                <button
                  onClick={() => void openMatter()}
                  disabled={busy}
                  className="mt-6 w-full rounded-2xl bg-white px-4 py-4 text-xs font-black uppercase tracking-[0.16em] text-heritage-green"
                >
                  Open active matter
                </button>
              )}
            </div>
          )}

          {state?.matterId && (
            <div className="mt-8 space-y-3">
              <Link
                href={`/matters/${state.matterId}`}
                className="block rounded-2xl bg-white px-4 py-4 text-center text-xs font-black uppercase tracking-[0.16em] text-heritage-green"
              >
                Enter matter room
              </Link>
              <p className="text-xs leading-6 text-white/65">
                This prospect has been converted into a live matter and can now continue through documents, deadlines, collaboration, and controlled client communication.
              </p>
            </div>
          )}

          {selectedProspect && (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Selected prospect</p>
              <p className="mt-2 text-sm font-semibold text-white">{selectedProspect.name}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{selectedProspect.summary}</p>
            </div>
          )}

          {state?.events.length ? (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Decision history</p>
              <div className="mt-3 space-y-3">
                {state.events.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">{event.summary}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                      {event.eventType} • {new Date(event.createdAt).toLocaleString("en-GB")}
                    </p>
                    {event.detail ? <p className="mt-2 text-xs leading-5 text-white/70">{event.detail}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {message && (
            <p className="mt-6 rounded-xl border border-rose-200/30 bg-rose-200/10 p-3 text-xs text-rose-100">{message}</p>
          )}
        </aside>
      </div>
    </main>
  );
}

function Step({ number, label, done }: { number: string; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${
          done ? "bg-ochre text-heritage-green" : "bg-white/10 text-white/50"
        }`}
      >
        {number}
      </span>
      <span className={done ? "text-white" : "text-white/55"}>{label}</span>
    </div>
  );
}
