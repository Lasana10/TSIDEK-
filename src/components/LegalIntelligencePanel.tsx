"use client";

import React, { startTransition, useMemo, useState } from "react";
import {
  BrainCircuit,
  ClipboardCheck,
  FileSearch,
  Filter,
  Landmark,
  Scale,
} from "lucide-react";
import type { MatterWorkspaceData } from "@/lib/matters";
import type {
  MatterComplianceChecklistItem,
  MatterRoomData,
} from "@/lib/matter-room";

type SubmitState =
  | null
  | "case-prep"
  | "jurisprudence"
  | "register"
  | "compliance"
  | "knowledge";

export default function LegalIntelligencePanel({
  matter,
  matterRoom,
  onRoomChange,
  onError,
}: {
  matter: MatterWorkspaceData;
  matterRoom: MatterRoomData;
  onRoomChange: (room: MatterRoomData) => void;
  onError: (message: string | null) => void;
}) {
  const [submitState, setSubmitState] = useState<SubmitState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("All topics");

  const [prepType, setPrepType] = useState<"Hearing" | "Filing" | "Witness" | "Client briefing" | "Research">("Hearing");
  const [prepTitle, setPrepTitle] = useState("");
  const [prepOwner, setPrepOwner] = useState(matter.projectManager);
  const [prepDueDate, setPrepDueDate] = useState("");
  const [prepNotes, setPrepNotes] = useState("");

  const [jurisTitle, setJurisTitle] = useState("");
  const [jurisForum, setJurisForum] = useState(matter.jurisdiction);
  const [jurisJurisdiction, setJurisJurisdiction] = useState(matter.jurisdiction);
  const [jurisDecisionDate, setJurisDecisionDate] = useState("");
  const [jurisTopics, setJurisTopics] = useState("OHADA, Procedure");
  const [jurisHolding, setJurisHolding] = useState("");
  const [jurisCitation, setJurisCitation] = useState("");
  const [jurisSourceType, setJurisSourceType] = useState<"Official reporter" | "Online research" | "Private scan" | "Internal memo">("Online research");
  const [jurisSourceUrl, setJurisSourceUrl] = useState("");
  const [jurisRelevance, setJurisRelevance] = useState<"Core authority" | "Useful" | "Watchlist">("Useful");

  const [registerBody, setRegisterBody] = useState("Bar / Regulatory body");
  const [registerType, setRegisterType] = useState("Registration follow-up");
  const [registerReference, setRegisterReference] = useState("");
  const [registerJurisdiction, setRegisterJurisdiction] = useState(matter.jurisdiction);
  const [registerStatus, setRegisterStatus] = useState<"Draft" | "Filed" | "Pending response" | "Resolved">("Draft");
  const [registerFilingDate, setRegisterFilingDate] = useState("");
  const [registerFollowUpDate, setRegisterFollowUpDate] = useState("");
  const [registerHistory, setRegisterHistory] = useState("");

  const [complianceLabel, setComplianceLabel] = useState("");
  const [complianceOwner, setComplianceOwner] = useState(matter.projectManager);
  const [complianceDueDate, setComplianceDueDate] = useState("");
  const [complianceEvidence, setComplianceEvidence] = useState("");

  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeType, setKnowledgeType] = useState<"Precedent note" | "Book scan" | "Statute extract" | "Checklist" | "Strategy note">("Book scan");
  const [knowledgeTags, setKnowledgeTags] = useState("scan, doctrine");
  const [knowledgeSummary, setKnowledgeSummary] = useState("");
  const [knowledgeStoragePath, setKnowledgeStoragePath] = useState("rag-sources/ready-made-documents/");
  const [knowledgeSensitivity, setKnowledgeSensitivity] = useState<"Internal" | "Restricted" | "Training-safe">("Restricted");

  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const item of matterRoom.jurisprudenceEntries) {
      for (const topic of item.legalTopics) {
        topics.add(topic);
      }
    }
    return ["All topics", ...Array.from(topics).sort()];
  }, [matterRoom.jurisprudenceEntries]);

  const filteredJurisprudence = useMemo(() => {
    return matterRoom.jurisprudenceEntries.filter((item) => {
      const matchesQuery =
        !searchQuery.trim() ||
        [item.title, item.forum, item.jurisdiction, item.citation, item.holdingSummary]
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());

      const matchesTopic =
        topicFilter === "All topics" || item.legalTopics.some((topic) => topic === topicFilter);

      return matchesQuery && matchesTopic;
    });
  }, [matterRoom.jurisprudenceEntries, searchQuery, topicFilter]);

  async function submitMatterAction(
    submitting: SubmitState,
    payload: Record<string, unknown>,
    onSuccess?: () => void
  ) {
    setSubmitState(submitting);
    onError(null);

    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as { room?: MatterRoomData; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save matter intelligence update.");
      }

      if (body.room) {
        startTransition(() => {
          onRoomChange(body.room!);
        });
      }

      onSuccess?.();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save matter intelligence update.");
    } finally {
      setSubmitState(null);
    }
  }

  async function createPreparationItem() {
    if (!prepTitle.trim()) {
      return;
    }

    await submitMatterAction(
      "case-prep",
      {
        action: "createCasePreparation",
        preparationType: prepType,
        title: prepTitle.trim(),
        ownerName: prepOwner.trim() || null,
        dueDate: prepDueDate || null,
        notes: prepNotes.trim() || null,
      },
      () => {
        setPrepTitle("");
        setPrepDueDate("");
        setPrepNotes("");
      }
    );
  }

  async function createJurisprudence() {
    if (!jurisTitle.trim() || !jurisHolding.trim()) {
      return;
    }

    await submitMatterAction(
      "jurisprudence",
      {
        action: "createJurisprudenceEntry",
        title: jurisTitle.trim(),
        forum: jurisForum.trim(),
        jurisdiction: jurisJurisdiction.trim(),
        decisionDate: jurisDecisionDate || null,
        legalTopics: jurisTopics.split(",").map((item) => item.trim()).filter(Boolean),
        holdingSummary: jurisHolding.trim(),
        citation: jurisCitation.trim() || null,
        sourceType: jurisSourceType,
        sourceUrl: jurisSourceUrl.trim() || null,
        relevanceLabel: jurisRelevance,
      },
      () => {
        setJurisTitle("");
        setJurisDecisionDate("");
        setJurisHolding("");
        setJurisCitation("");
        setJurisSourceUrl("");
      }
    );
  }

  async function createRegisterEntry() {
    if (!registerReference.trim()) {
      return;
    }

    await submitMatterAction(
      "register",
      {
        action: "createCouncilRegisterEntry",
        bodyName: registerBody.trim(),
        registerType: registerType.trim(),
        referenceCode: registerReference.trim(),
        jurisdiction: registerJurisdiction.trim(),
        status: registerStatus,
        filingDate: registerFilingDate || null,
        followUpDate: registerFollowUpDate || null,
        historyNote: registerHistory.trim() || null,
      },
      () => {
        setRegisterReference("");
        setRegisterFilingDate("");
        setRegisterFollowUpDate("");
        setRegisterHistory("");
      }
    );
  }

  async function createComplianceItem() {
    if (!complianceLabel.trim()) {
      return;
    }

    await submitMatterAction(
      "compliance",
      {
        action: "createComplianceChecklistItem",
        checklistTitle: matterRoom.complianceChecklist?.title ?? "Matter compliance checklist",
        checklistType: matterRoom.complianceChecklist?.checklistType ?? "Matter compliance",
        label: complianceLabel.trim(),
        ownerName: complianceOwner.trim() || null,
        dueDate: complianceDueDate || null,
        evidenceNote: complianceEvidence.trim() || null,
      },
      () => {
        setComplianceLabel("");
        setComplianceDueDate("");
        setComplianceEvidence("");
      }
    );
  }

  async function updateComplianceItemStatus(item: MatterComplianceChecklistItem, status: MatterComplianceChecklistItem["status"]) {
    await submitMatterAction("compliance", {
      action: "updateComplianceChecklistItemStatus",
      checklistItemId: item.id,
      status,
    });
  }

  async function createKnowledge() {
    if (!knowledgeTitle.trim() || !knowledgeSummary.trim()) {
      return;
    }

    await submitMatterAction(
      "knowledge",
      {
        action: "createKnowledgeEntry",
        title: knowledgeTitle.trim(),
        entryType: knowledgeType,
        tags: knowledgeTags.split(",").map((item) => item.trim()).filter(Boolean),
        summary: knowledgeSummary.trim(),
        storagePath: knowledgeStoragePath.trim() || null,
        sensitivity: knowledgeSensitivity,
      },
      () => {
        setKnowledgeTitle("");
        setKnowledgeSummary("");
        setKnowledgeStoragePath("rag-sources/ready-made-documents/");
      }
    );
  }

  const liveMode = matterRoom.source === "live";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Case preparation</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Hearing, filing, witness, and client prep</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {matterRoom.casePreparation.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {item.preparationType} • {item.ownerName} • {item.dueDate ?? "No due date"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.notes}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add preparation item</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select value={prepType} onChange={(event) => setPrepType(event.target.value as typeof prepType)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green">
                {["Hearing", "Filing", "Witness", "Client briefing", "Research"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input value={prepOwner} onChange={(event) => setPrepOwner(event.target.value)} placeholder="Owner name" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={prepTitle} onChange={(event) => setPrepTitle(event.target.value)} placeholder="Preparation title" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
              <input type="date" value={prepDueDate} onChange={(event) => setPrepDueDate(event.target.value)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <textarea value={prepNotes} onChange={(event) => setPrepNotes(event.target.value)} placeholder="Why this preparation item matters" className="min-h-24 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
            </div>
            <ActionFooter
              liveMode={liveMode}
              busy={submitState === "case-prep"}
              busyLabel="Saving..."
              readyLabel="Add preparation item"
              onClick={() => void createPreparationItem()}
            />
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-[#0b211c] p-5 text-white">
          <div className="flex items-center gap-3">
            <Landmark className="h-5 w-5 text-gold-accent" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Registers and councils</p>
              <h3 className="mt-1 text-lg font-semibold">Regulatory, filing, and body history</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.councilRegisters.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{item.referenceCode}</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-accent">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-white/45">
                  {item.bodyName} • {item.registerType} • {item.jurisdiction}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/72">{item.historyNote}</p>
                <p className="mt-3 text-xs text-white/45">Filed {item.filingDate ?? "n/a"} • Follow-up {item.followUpDate ?? "n/a"}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Log register history</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={registerBody} onChange={(event) => setRegisterBody(event.target.value)} placeholder="Body or council" className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
              <input value={registerType} onChange={(event) => setRegisterType(event.target.value)} placeholder="Register type" className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
              <input value={registerReference} onChange={(event) => setRegisterReference(event.target.value)} placeholder="Reference code" className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
              <input value={registerJurisdiction} onChange={(event) => setRegisterJurisdiction(event.target.value)} placeholder="Jurisdiction" className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
              <input type="date" value={registerFilingDate} onChange={(event) => setRegisterFilingDate(event.target.value)} className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none focus:border-gold-accent" />
              <input type="date" value={registerFollowUpDate} onChange={(event) => setRegisterFollowUpDate(event.target.value)} className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none focus:border-gold-accent" />
              <select value={registerStatus} onChange={(event) => setRegisterStatus(event.target.value as typeof registerStatus)} className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none focus:border-gold-accent">
                {["Draft", "Filed", "Pending response", "Resolved"].map((item) => (
                  <option key={item} value={item} className="text-slate-900">{item}</option>
                ))}
              </select>
              <textarea value={registerHistory} onChange={(event) => setRegisterHistory(event.target.value)} placeholder="History note or follow-up context" className="min-h-24 rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent md:col-span-2" />
            </div>
            <ActionFooter
              liveMode={liveMode}
              dark
              busy={submitState === "register"}
              busyLabel="Saving..."
              readyLabel="Log register entry"
              onClick={() => void createRegisterEntry()}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <FileSearch className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Jurisprudence</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Search, filter, and retain African authorities</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Filter className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">Search stored authorities</span>
              </div>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Forum, citation, issue, or holding..." className="mt-2 w-full bg-transparent text-sm outline-none" />
            </label>
            <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green">
              {allTopics.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {filteredJurisprudence.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">{item.relevanceLabel}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.sourceType}</span>
                  {item.legalTopics.map((topic) => (
                    <span key={`${item.id}-${topic}`} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {topic}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {item.forum} • {item.jurisdiction} • {item.decisionDate ?? "Date not recorded"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.holdingSummary}</p>
                <p className="mt-3 text-xs text-slate-500">{item.citation}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Store authority</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={jurisTitle} onChange={(event) => setJurisTitle(event.target.value)} placeholder="Decision or authority title" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
              <input value={jurisForum} onChange={(event) => setJurisForum(event.target.value)} placeholder="Forum / court / body" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={jurisJurisdiction} onChange={(event) => setJurisJurisdiction(event.target.value)} placeholder="Jurisdiction" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input type="date" value={jurisDecisionDate} onChange={(event) => setJurisDecisionDate(event.target.value)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={jurisCitation} onChange={(event) => setJurisCitation(event.target.value)} placeholder="Citation" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={jurisTopics} onChange={(event) => setJurisTopics(event.target.value)} placeholder="Topics, comma separated" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
              <textarea value={jurisHolding} onChange={(event) => setJurisHolding(event.target.value)} placeholder="Holding, ratio, or practical takeaway" className="min-h-24 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
              <select value={jurisSourceType} onChange={(event) => setJurisSourceType(event.target.value as typeof jurisSourceType)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green">
                {["Official reporter", "Online research", "Private scan", "Internal memo"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select value={jurisRelevance} onChange={(event) => setJurisRelevance(event.target.value as typeof jurisRelevance)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green">
                {["Core authority", "Useful", "Watchlist"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input value={jurisSourceUrl} onChange={(event) => setJurisSourceUrl(event.target.value)} placeholder="Source URL or archive note" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
            </div>
            <ActionFooter
              liveMode={liveMode}
              busy={submitState === "jurisprudence"}
              busyLabel="Saving..."
              readyLabel="Store authority"
              onClick={() => void createJurisprudence()}
            />
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-heritage-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Compliance checklist</p>
                <h3 className="mt-1 text-lg font-semibold text-heritage-green">Deontology, filing quality, and follow-up</h3>
              </div>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
              <p className="text-sm font-semibold text-slate-900">
                {matterRoom.complianceChecklist?.title ?? "Matter compliance checklist"}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                {matterRoom.complianceChecklist?.overallStatus ?? "In progress"}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {(matterRoom.complianceChecklist?.items ?? []).map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <select
                      value={item.status}
                      disabled={!liveMode || submitState === "compliance"}
                      onChange={(event) => void updateComplianceItemStatus(item, event.target.value as MatterComplianceChecklistItem["status"])}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 outline-none"
                    >
                      {["Pending", "Satisfied", "Escalated"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {item.ownerName} • {item.dueDate ?? "No due date"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.evidenceNote}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add checklist item</p>
              <div className="mt-3 grid gap-3">
                <input value={complianceLabel} onChange={(event) => setComplianceLabel(event.target.value)} placeholder="Checklist line item" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={complianceOwner} onChange={(event) => setComplianceOwner(event.target.value)} placeholder="Owner" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
                  <input type="date" value={complianceDueDate} onChange={(event) => setComplianceDueDate(event.target.value)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
                </div>
                <textarea value={complianceEvidence} onChange={(event) => setComplianceEvidence(event.target.value)} placeholder="Evidence note, bar rule, or follow-up reason" className="min-h-24 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              </div>
              <ActionFooter
                liveMode={liveMode}
                busy={submitState === "compliance"}
                busyLabel="Saving..."
                readyLabel="Add checklist item"
                onClick={() => void createComplianceItem()}
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-[#f7fbf9] p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-heritage-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Private knowledge bank</p>
                <h3 className="mt-1 text-lg font-semibold text-heritage-green">Your growing cabinet brain</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {matterRoom.knowledgeEntries.map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                      {item.sensitivity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {item.entryType} • {item.createdAt}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={`${item.id}-${tag}`} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Store private knowledge</p>
              <div className="mt-3 grid gap-3">
                <input value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder="Book scan, statute note, precedent digest..." className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value as typeof knowledgeType)} className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green">
                    {["Precedent note", "Book scan", "Statute extract", "Checklist", "Strategy note"].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select value={knowledgeSensitivity} onChange={(event) => setKnowledgeSensitivity(event.target.value as typeof knowledgeSensitivity)} className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green">
                    {["Internal", "Restricted", "Training-safe"].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <input value={knowledgeTags} onChange={(event) => setKnowledgeTags(event.target.value)} placeholder="Tags, comma separated" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
                <input value={knowledgeStoragePath} onChange={(event) => setKnowledgeStoragePath(event.target.value)} placeholder="rag-sources/ready-made-documents/source-file.pdf" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
                <p className="rounded-[1rem] border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  Place prepared source files in rag-sources/ready-made-documents, then register the source here. OCR, embeddings, and source-grounded retrieval are the next worker layer.
                </p>
                <textarea value={knowledgeSummary} onChange={(event) => setKnowledgeSummary(event.target.value)} placeholder="Summarize the useful rule, practical takeaway, or scanned authority..." className="min-h-28 rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              </div>
              <ActionFooter
                liveMode={liveMode}
                busy={submitState === "knowledge"}
                busyLabel="Saving..."
                readyLabel="Store knowledge entry"
                onClick={() => void createKnowledge()}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionFooter({
  liveMode,
  busy,
  busyLabel,
  readyLabel,
  onClick,
  dark = false,
}: {
  liveMode: boolean;
  busy: boolean;
  busyLabel: string;
  readyLabel: string;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-slate-400"}`}>
        {liveMode ? "Writes into the live matter intelligence store" : "Live backend required for persistence"}
      </p>
      <button
        onClick={onClick}
        disabled={busy || !liveMode}
        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          dark ? "bg-gold-accent text-[#082921]" : "bg-heritage-green"
        }`}
      >
        {busy ? busyLabel : readyLabel}
      </button>
    </div>
  );
}
