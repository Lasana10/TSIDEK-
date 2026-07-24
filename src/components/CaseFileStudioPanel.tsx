"use client";

import React, { startTransition, useMemo, useState } from "react";
import { Database, FileCog, FolderArchive, PenSquare, ScrollText } from "lucide-react";
import type { MatterWorkspaceData } from "@/lib/matters";
import type { MatterRoomData } from "@/lib/matter-room";

type SubmitState =
  | null
  | "field"
  | "file"
  | "template"
  | "draft";

type DraftPreview = {
  title: string;
  outputText: string;
  contextNote: string | null;
} | null;

export default function CaseFileStudioPanel({
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
  const [draftPreview, setDraftPreview] = useState<DraftPreview>(matterRoom.templateGenerations[0] ?? null);

  const [fieldLabel, setFieldLabel] = useState("Client address");
  const [fieldKey, setFieldKey] = useState("client_address");
  const [fieldValue, setFieldValue] = useState("");
  const [fieldGroup, setFieldGroup] = useState("Core facts");

  const [fileLabel, setFileLabel] = useState("Main pleading pack");
  const [fileCategory, setFileCategory] = useState("Pleadings");
  const [filePath, setFilePath] = useState(`vault/${matter.id}/pleadings`);
  const [fileProvider, setFileProvider] = useState("TSIDEK Vault");
  const [fileReferenceCode, setFileReferenceCode] = useState(matter.physicalFileId);
  const [fileVersionLabel, setFileVersionLabel] = useState("v1");
  const [fileStatus, setFileStatus] = useState<"Draft" | "Active" | "Archived">("Draft");

  const [templateTitle, setTemplateTitle] = useState(`${matter.matterType} Heritage Draft`);
  const [templatePracticeArea, setTemplatePracticeArea] = useState(matter.matterType);
  const [templateJurisdiction, setTemplateJurisdiction] = useState(matter.jurisdiction);
  const [templateLanguage, setTemplateLanguage] = useState<"FR" | "EN" | "Bilingual">("FR");
  const [templateBody, setTemplateBody] = useState("");
  const [templateFormNote, setTemplateFormNote] = useState("Keep the chamber structure and formal pleading form intact.");

  const [selectedTemplateId, setSelectedTemplateId] = useState(matterRoom.templateProfiles[0]?.id ?? "");
  const [draftTitle, setDraftTitle] = useState(`${matter.clientName} personalized draft`);
  const [draftContextNote, setDraftContextNote] = useState("Keep the form but adapt parties, amounts, and factual posture to this matter.");

  const canPersist = matterRoom.source !== "fallback";

  const groupedFields = useMemo(() => {
    const groups = new Map<string, MatterRoomData["caseFields"]>();
    for (const field of matterRoom.caseFields) {
      const items = groups.get(field.fieldGroup) ?? [];
      items.push(field);
      groups.set(field.fieldGroup, items);
    }
    return Array.from(groups.entries());
  }, [matterRoom.caseFields]);

  async function submitMatterAction(
    submitting: SubmitState,
    payload: Record<string, unknown>,
    onSuccess?: (body: { room?: MatterRoomData; draft?: DraftPreview }) => void
  ) {
    setSubmitState(submitting);
    onError(null);

    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as { room?: MatterRoomData; draft?: DraftPreview; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save case-file studio update.");
      }

      if (body.room) {
        startTransition(() => {
          onRoomChange(body.room!);
        });
      }

      onSuccess?.(body);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save case-file studio update.");
    } finally {
      setSubmitState(null);
    }
  }

  function normalizeFieldKey(value: string) {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }

  async function saveCaseField() {
    if (!fieldLabel.trim() || !fieldValue.trim()) {
      return;
    }

    const nextKey = fieldKey.trim() || normalizeFieldKey(fieldLabel);
    await submitMatterAction(
      "field",
      {
        action: "upsertCaseField",
        fieldKey: nextKey,
        fieldLabel: fieldLabel.trim(),
        fieldValue: fieldValue.trim(),
        fieldGroup: fieldGroup.trim() || "Core facts",
      },
      () => {
        setFieldKey(nextKey);
        setFieldValue("");
      }
    );
  }

  async function saveDigitalCaseFile() {
    if (!fileLabel.trim()) {
      return;
    }

    await submitMatterAction(
      "file",
      {
        action: "createDigitalCaseFile",
        fileLabel: fileLabel.trim(),
        fileCategory: fileCategory.trim(),
        storagePath: filePath.trim() || null,
        storageProvider: fileProvider.trim() || null,
        referenceCode: fileReferenceCode.trim() || null,
        versionLabel: fileVersionLabel.trim() || null,
        status: fileStatus,
      },
      () => {
        setFileVersionLabel("v1");
      }
    );
  }

  async function saveTemplate() {
    if (!templateTitle.trim()) {
      return;
    }

    await submitMatterAction(
      "template",
      {
        action: "createDocumentTemplate",
        title: templateTitle.trim(),
        practiceArea: templatePracticeArea.trim(),
        jurisdiction: templateJurisdiction.trim(),
        language: templateLanguage,
        templateBody: templateBody.trim() || null,
        preservedFormNote: templateFormNote.trim() || null,
      },
      (body) => {
        const nextId = body.room?.templateProfiles[0]?.id;
        if (nextId) {
          setSelectedTemplateId(nextId);
        }
      }
    );
  }

  async function generateDraft() {
    await submitMatterAction(
      "draft",
      {
        action: "generatePersonalizedDraft",
        templateId: selectedTemplateId || null,
        title: draftTitle.trim() || null,
        contextNote: draftContextNote.trim() || null,
      },
      (body) => {
        setDraftPreview(body.draft ?? null);
      }
    );
  }

  async function archiveDraft() {
    if (!draftPreview?.outputText) {
      return;
    }

    await submitMatterAction(
      "draft",
      {
        action: "archivePersonalizedDraft",
        title: draftPreview.title,
        outputText: draftPreview.outputText,
        contextNote: draftPreview.contextNote,
        storagePath: `vault/${matter.id}/drafts/${draftPreview.title}`.replace(/[^a-zA-Z0-9/_-]/g, "_"),
      },
      () => {
        setDraftPreview(null);
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Structured case fields</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Matter facts we can reuse everywhere</h3>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {groupedFields.map(([group, items]) => (
              <div key={group} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group}</p>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[1rem] bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.fieldLabel}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{item.fieldKey}</p>
                      </div>
                      <p className="text-sm text-slate-600">{item.fieldValue}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add or update case field</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Field label" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="field_key" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fieldGroup} onChange={(event) => setFieldGroup(event.target.value)} placeholder="Field group" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="Field value" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
            </div>
            <ActionFooter source={matterRoom.source} busy={submitState === "field"} labelBusy="Saving..." labelReady="Save case field" onClick={() => void saveCaseField()} />
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-[#f7fbf9] p-5">
          <div className="flex items-center gap-3">
            <FolderArchive className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Digital case file store</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">The digital twin of the physical file</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.digitalCaseFiles.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.fileLabel}</p>
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {item.fileCategory} • {item.storageProvider} • {item.versionLabel ?? "No version"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.storagePath ?? "Storage path not recorded"}</p>
                <p className="mt-3 text-xs text-slate-500">{item.referenceCode ?? "No reference code"} • {item.uploadedAt}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Register digital case file</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={fileLabel} onChange={(event) => setFileLabel(event.target.value)} placeholder="File label" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fileCategory} onChange={(event) => setFileCategory(event.target.value)} placeholder="Category" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="Storage path" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green md:col-span-2" />
              <input value={fileProvider} onChange={(event) => setFileProvider(event.target.value)} placeholder="Storage provider" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fileReferenceCode} onChange={(event) => setFileReferenceCode(event.target.value)} placeholder="Reference code" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              <input value={fileVersionLabel} onChange={(event) => setFileVersionLabel(event.target.value)} placeholder="Version" className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green" />
              <select value={fileStatus} onChange={(event) => setFileStatus(event.target.value as typeof fileStatus)} className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none focus:border-heritage-green">
                {["Draft", "Active", "Archived"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <ActionFooter source={matterRoom.source} busy={submitState === "file"} labelBusy="Saving..." labelReady="Register digital file" onClick={() => void saveDigitalCaseFile()} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <FileCog className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Template library</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Preserve form, change context</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.templateProfiles.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                    {item.language}
                  </span>
                </div>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {item.practiceArea} • {item.jurisdiction}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.preservedFormNote ?? "No preserved-form note recorded."}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add template profile</p>
            <div className="mt-3 grid gap-3">
              <input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Template title" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <div className="grid gap-3 md:grid-cols-2">
                <input value={templatePracticeArea} onChange={(event) => setTemplatePracticeArea(event.target.value)} placeholder="Practice area" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
                <input value={templateJurisdiction} onChange={(event) => setTemplateJurisdiction(event.target.value)} placeholder="Jurisdiction" className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              </div>
              <select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value as typeof templateLanguage)} className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green">
                {["FR", "EN", "Bilingual"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Paste your current template body here. Leave blank to use the built-in heritage draft." className="min-h-40 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
              <textarea value={templateFormNote} onChange={(event) => setTemplateFormNote(event.target.value)} placeholder="What form must remain untouched?" className="min-h-24 rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none focus:border-heritage-green" />
            </div>
            <ActionFooter source={matterRoom.source} busy={submitState === "template"} labelBusy="Saving..." labelReady="Save template" onClick={() => void saveTemplate()} />
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-[#0b211c] p-5 text-white">
          <div className="flex items-center gap-3">
            <PenSquare className="h-5 w-5 text-gold-accent" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Personalized drafting</p>
              <h3 className="mt-1 text-lg font-semibold">Generate a matter-specific draft from firm form</h3>
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3">
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none focus:border-gold-accent">
                <option value="" className="text-slate-900">Use latest available template</option>
                {matterRoom.templateProfiles.map((item) => (
                  <option key={item.id} value={item.id} className="text-slate-900">{item.title}</option>
                ))}
              </select>
              <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Draft title" className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
              <textarea value={draftContextNote} onChange={(event) => setDraftContextNote(event.target.value)} placeholder="Context note: keep form, adapt facts, parties, amounts..." className="min-h-28 rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent" />
            </div>
            <ActionFooter source={matterRoom.source} busy={submitState === "draft"} labelBusy="Generating..." labelReady="Generate personalized draft" dark onClick={() => void generateDraft()} />
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-gold-accent" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Draft preview</p>
                <p className="mt-1 text-sm font-semibold">{draftPreview?.title ?? "No draft generated yet"}</p>
              </div>
            </div>
            <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-[1rem] border border-white/10 bg-[#061611] p-4 text-sm leading-6 text-white/78">
              {draftPreview?.outputText ?? "Generate a personalized draft to preview the matter-specific output here."}
            </pre>
            {draftPreview?.contextNote ? (
              <p className="mt-3 text-xs leading-5 text-white/45">{draftPreview.contextNote}</p>
            ) : null}
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => void archiveDraft()}
                disabled={submitState === "draft" || !canPersist || !draftPreview?.outputText}
                className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#082921] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Archive to case file
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.templateGenerations.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-white/45">{item.generatedAt}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/72">{item.outputText}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionFooter({
  source,
  busy,
  labelBusy,
  labelReady,
  onClick,
  dark = false,
}: {
  source: MatterRoomData["source"];
  busy: boolean;
  labelBusy: string;
  labelReady: string;
  onClick: () => void;
  dark?: boolean;
}) {
  const canPersist = source !== "fallback";
  const persistenceLabel =
    source === "live"
      ? "Saved into Supabase matter workspace"
      : source === "prototype"
        ? "Saved into local prototype storage"
        : "Open a persisted matter room before saving";

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-slate-400"}`}>
        {persistenceLabel}
      </p>
      <button
        onClick={onClick}
        disabled={busy || !canPersist}
        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
          dark ? "bg-gold-accent text-[#082921]" : "bg-heritage-green text-white"
        }`}
      >
        {busy ? labelBusy : labelReady}
      </button>
    </div>
  );
}
