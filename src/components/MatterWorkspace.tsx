"use client";

import React, { startTransition, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BellRing,
  BookMarked,
  CalendarClock,
  CircleAlert,
  FileDigit,
  FilePenLine,
  FileSearch,
  FileText,
  GanttChartSquare,
  Landmark,
  MemoryStick,
  MessageSquareText,
  QrCode,
  Receipt,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import CaseFileStudioPanel from "@/components/CaseFileStudioPanel";
import LegalIntelligencePanel from "@/components/LegalIntelligencePanel";
import { OHADA_RULES } from "@/lib/deadline-engine/rules";
import type { MatterDeadlinePreview } from "@/lib/deadlines";
import type { MatterWorkspaceData } from "@/lib/matters";
import type {
  MatterRoomComment,
  MatterRoomCustodyEvent,
  MatterRoomData,
  MatterInvoice,
  MatterRoomTask,
} from "@/lib/matter-room";
import type { ClientUpdateRecord, OperationalDashboard } from "@/lib/operations";
import type { MatterAccessStatus, MatterSecurityProfile } from "@/lib/matter-security";

export type WorkspaceTab =
  | "overview"
  | "documents"
  | "strategy"
  | "studio"
  | "intelligence"
  | "collaboration"
  | "governance"
  | "finance";
type MatterSubmitState =
  | null
  | "client-update"
  | "deadline"
  | "guidance"
  | "memory"
  | "chat"
  | "comment"
  | "task"
  | "document"
  | "document-upload"
  | "member"
  | "physical-file"
  | "custody"
  | "invoice";

const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "strategy", label: "Strategy" },
  { id: "studio", label: "Case File" },
  { id: "intelligence", label: "Intelligence" },
  { id: "collaboration", label: "Collaboration" },
  { id: "governance", label: "Governance" },
  { id: "finance", label: "Finance" },
];

const todayDateInput = new Date().toISOString().slice(0, 10);

function createFallbackMatterRoom(matter: MatterWorkspaceData): MatterRoomData {
  return {
    source: "fallback",
    matter,
    teamMembers: [
      {
        id: `${matter.id}-lead`,
        name: matter.leadLawyer,
        role: "Lead Lawyer",
        focus: "Owns the legal strategy and filing review path.",
        isPrimary: true,
      },
      {
        id: `${matter.id}-pm`,
        name: matter.projectManager,
        role: "Project Manager",
        focus: "Coordinates handoffs, deadlines, and file movement.",
        isPrimary: false,
      },
    ],
    assignableLawyers: [
      {
        id: `${matter.id}-lead`,
        name: matter.leadLawyer,
        role: "Lead Lawyer",
        alreadyAssigned: true,
      },
      {
        id: `${matter.id}-pm`,
        name: matter.projectManager,
        role: "Project Manager",
        alreadyAssigned: true,
      },
    ],
    documents: matter.documents.map((item, index) => ({
      id: `${matter.id}-document-${index + 1}`,
      title: item.name,
      documentType: item.type,
      documentStatus: item.state === "Finalized" ? "Final" : "Draft",
      reviewStatus: item.state === "Finalized" ? "Approved" : "Working",
      accessLevel: item.type === "Compliance" ? "Lead+Partner" : "Matter team",
      sharingPolicy: item.type === "Compliance" ? "Blocked" : "Internal only",
      versionLabel: `v${index + 1}`,
      storagePath: "Matter vault path pending live registry",
      oneDriveFileId: null,
      syncStatus: "Local only",
      aiSummary: item.state,
      requiresComplianceAudit: item.type === "Compliance",
      reviewNote: item.state === "Finalized" ? "Seeded finalized document imported into the workspace." : null,
      filedAt: null,
      createdAt: "Seeded record",
    })),
    tasks: matter.timeline.map((item, index) => ({
      id: `${matter.id}-seed-task-${index + 1}`,
      title: item.title,
      description: `Fallback task derived from the seeded matter timeline for ${matter.title}.`,
      deadline: item.date,
      status: "In Progress",
      assignedTo: item.owner,
    })),
    comments: matter.collaboration.map((item, index) => ({
      id: `${matter.id}-seed-comment-${index + 1}`,
      author: item.actor,
      role: item.role,
      body: item.note,
      commentType: "note",
      createdAt: `Seeded note ${index + 1}`,
    })),
    physicalFile: {
      fileCode: matter.physicalFileId,
      label: matter.physicalLabel,
      location: matter.physicalLocation,
      custodyStatus: matter.physicalCustody,
      qrPayload: null,
    },
    custodyEvents: [
      {
        id: `${matter.id}-seed-custody-1`,
        eventType: "registered",
        note: "Fallback physical file history is shown until live custody tracking is connected.",
        createdAt: "Now",
        actorName: "TSIDEK Workspace",
      },
    ],
    auditTrail: [
      {
        id: `${matter.id}-seed-audit-1`,
        actionType: "fallback_mode",
        description: "Matter room is rendering from fallback data until the live persistence layer is connected.",
        createdAt: "Now",
        actorName: "TSIDEK Workspace",
      },
    ],
    invoices: [
      {
        id: `${matter.id}-invoice-1`,
        amountXaf: 450000,
        status: "Sent",
        dueDate: matter.timeline[0]?.date ?? null,
        createdAt: "Seeded record",
      },
    ],
    casePreparation: [
      {
        id: `${matter.id}-prep-1`,
        preparationType: "Filing",
        title: `Finalize ${matter.nextDraft}`,
        ownerName: matter.leadLawyer,
        dueDate: matter.timeline[0]?.date ?? null,
        status: "In progress",
        notes: "Fallback preparation lane derived from the matter synopsis and timeline.",
      },
    ],
    jurisprudenceEntries: [
      {
        id: `${matter.id}-juris-1`,
        title: `${matter.jurisdiction} commercial reasoning pack`,
        forum: matter.jurisdiction,
        jurisdiction: matter.jurisdiction,
        decisionDate: null,
        legalTopics: ["Procedure", "Commercial recovery"],
        holdingSummary: matter.researchNotes[0] ?? "Research stack not yet synchronized from the live jurisprudence store.",
        citation: "Private research note",
        sourceType: "Internal memo",
        sourceUrl: null,
        relevanceLabel: "Useful",
      },
    ],
    councilRegisters: [
      {
        id: `${matter.id}-register-1`,
        bodyName: "Cabinet filing register",
        registerType: "Matter opening",
        referenceCode: matter.physicalFileId,
        jurisdiction: matter.jurisdiction,
        status: "Filed",
        filingDate: matter.timeline[0]?.date ?? null,
        followUpDate: matter.timeline[1]?.date ?? null,
        historyNote: "Fallback register history is shown until the live council/register log is connected.",
      },
    ],
    complianceChecklist: {
      id: `${matter.id}-compliance-1`,
      title: "Launch checklist",
      checklistType: "Matter compliance",
      overallStatus: "In progress",
      items: matter.governanceChecks.map((check, index) => ({
        id: `${matter.id}-compliance-item-${index + 1}`,
        label: check,
        ownerName: index === 0 ? matter.leadLawyer : matter.projectManager,
        dueDate: matter.timeline[index]?.date ?? null,
        status: index === 0 ? "Satisfied" : "Pending",
        evidenceNote: "Fallback checklist item based on the seeded governance baseline.",
      })),
    },
    knowledgeEntries: [
      {
        id: `${matter.id}-knowledge-1`,
        title: `${matter.clientName} strategic brief`,
        entryType: "Strategy note",
        tags: ["Matter summary", matter.jurisdiction],
        summary: matter.synopsis,
        storagePath: null,
        sensitivity: "Internal",
        createdAt: "Seeded note",
      },
    ],
    caseFields: [
      {
        id: `${matter.id}-field-1`,
        fieldKey: "client_address",
        fieldLabel: "Client address",
        fieldValue: "Douala, Cameroun",
        fieldGroup: "Core facts",
      },
      {
        id: `${matter.id}-field-2`,
        fieldKey: "adversary_name",
        fieldLabel: "Adversary name",
        fieldValue: "To be confirmed",
        fieldGroup: "Opposition",
      },
    ],
    digitalCaseFiles: [
      {
        id: `${matter.id}-digital-file-1`,
        fileLabel: "Master digital case room",
        fileCategory: "Matter vault",
        storagePath: `vault/${matter.id}/master`,
        storageProvider: "TSIDEK Vault",
        referenceCode: matter.physicalFileId,
        versionLabel: "v1",
        status: "Active",
        uploadedAt: "Seeded record",
      },
    ],
    templateProfiles: [
      {
        id: `${matter.id}-template-1`,
        title: "Assignation Paiement Heritage",
        practiceArea: matter.matterType,
        jurisdiction: matter.jurisdiction,
        language: "FR",
        templateBody: "Assignation pour {{clientName}} contre {{adversary_name}} concernant {{matterTitle}}.",
        preservedFormNote: "Preserve chamber structure, signature block, and formal tone.",
      },
    ],
    templateGenerations: [
      {
        id: `${matter.id}-generation-1`,
        title: `${matter.nextDraft} preview`,
        contextNote: "Fallback generation shown until live template persistence is connected.",
        outputText: `Projet pour ${matter.clientName} dans ${matter.jurisdiction}.`,
        generatedAt: "Seeded record",
      },
    ],
  };
}

export default function MatterWorkspace({
  matter,
  initialTab = "overview",
}: {
  matter: MatterWorkspaceData;
  initialTab?: WorkspaceTab;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [dashboard, setDashboard] = useState<OperationalDashboard | null>(null);
  const [room, setRoom] = useState<MatterRoomData>(() => createFallbackMatterRoom(matter));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [clientUpdate, setClientUpdate] = useState("");
  const [deadlineRuleDraft, setDeadlineRuleDraft] = useState("ASSIGNATION_AU_FOND");
  const [deadlineStartDraft, setDeadlineStartDraft] = useState(todayDateInput);
  const [deadlinePreview, setDeadlinePreview] = useState<MatterDeadlinePreview | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [taskDescriptionDraft, setTaskDescriptionDraft] = useState("");
  const [taskDeadlineDraft, setTaskDeadlineDraft] = useState("");
  const [taskAssigneeDraft, setTaskAssigneeDraft] = useState("");
  const [documentTitleDraft, setDocumentTitleDraft] = useState("");
  const [documentTypeDraft, setDocumentTypeDraft] = useState("Drafting");
  const [documentStatusDraft, setDocumentStatusDraft] =
    useState<"Draft" | "Final" | "Filed" | "Archived">("Draft");
  const [documentReviewStatusDraft, setDocumentReviewStatusDraft] =
    useState<"Working" | "Internal review" | "Approved" | "Needs revision">("Working");
  const [documentAccessLevelDraft, setDocumentAccessLevelDraft] =
    useState<"Matter team" | "Lead+Partner">("Matter team");
  const [documentSharingPolicyDraft, setDocumentSharingPolicyDraft] =
    useState<"Internal only" | "Client-share ready" | "Blocked">("Internal only");
  const [documentVersionLabelDraft, setDocumentVersionLabelDraft] = useState("v1");
  const [documentPathDraft, setDocumentPathDraft] = useState("");
  const [documentOneDriveIdDraft, setDocumentOneDriveIdDraft] = useState("");
  const [documentSummaryDraft, setDocumentSummaryDraft] = useState("");
  const [documentComplianceDraft, setDocumentComplianceDraft] = useState(false);
  const [documentReviewNoteDraft, setDocumentReviewNoteDraft] = useState("");
  const [fileCodeDraft, setFileCodeDraft] = useState(matter.physicalFileId);
  const [fileLabelDraft, setFileLabelDraft] = useState(matter.physicalLabel);
  const [fileLocationDraft, setFileLocationDraft] = useState(matter.physicalLocation);
  const [fileCustodyDraft, setFileCustodyDraft] = useState(matter.physicalCustody);
  const [fileQrDraft, setFileQrDraft] = useState("");
  const [custodyEventTypeDraft, setCustodyEventTypeDraft] =
    useState<MatterRoomCustodyEvent["eventType"]>("checked_out");
  const [custodyEventNoteDraft, setCustodyEventNoteDraft] = useState("");
  const [custodyEventLocationDraft, setCustodyEventLocationDraft] = useState(matter.physicalLocation);
  const [custodyEventStatusDraft, setCustodyEventStatusDraft] = useState(matter.physicalCustody);
  const [memberDraft, setMemberDraft] = useState("");
  const [chatMessageDraft, setChatMessageDraft] = useState("");
  const [guidanceSummaryDraft, setGuidanceSummaryDraft] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [memorySummaryDraft, setMemorySummaryDraft] = useState("");
  const [memoryDecisionDraft, setMemoryDecisionDraft] = useState("");
  const [memoryUnresolvedDraft, setMemoryUnresolvedDraft] = useState("");
  const [notificationBusyId, setNotificationBusyId] = useState<string | null>(null);
  const [clientUpdateBusyId, setClientUpdateBusyId] = useState<string | null>(null);
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [securityProfile, setSecurityProfile] = useState<MatterSecurityProfile | null>(null);
  const [securityClassificationDraft, setSecurityClassificationDraft] =
    useState<"Standard" | "Confidential" | "Partner-only">(matter.securityClassification);
  const [ethicalWallEnabledDraft, setEthicalWallEnabledDraft] = useState(matter.ethicalWallEnabled);
  const [accessOverrideLawyerIdDraft, setAccessOverrideLawyerIdDraft] = useState("");
  const [accessOverrideStatusDraft, setAccessOverrideStatusDraft] = useState<MatterAccessStatus>("screened");
  const [accessOverrideReasonDraft, setAccessOverrideReasonDraft] = useState("");
  const [invoiceAmountDraft, setInvoiceAmountDraft] = useState("");
  const [invoiceDueDateDraft, setInvoiceDueDateDraft] = useState("");
  const [invoiceStatusDraft, setInvoiceStatusDraft] = useState<MatterInvoice["status"]>("Draft");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<MatterSubmitState>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceData() {
      setIsRefreshing(true);
      setRoomError(null);

      try {
        const [roomResponse, operationsResponse] = await Promise.all([
          fetch(`/api/matters/${matter.id}`, { cache: "no-store" }),
          fetch("/api/operations", { cache: "no-store" }),
        ]);

        if (!cancelled && roomResponse.ok) {
          const roomPayload = (await roomResponse.json()) as { room?: MatterRoomData; security?: MatterSecurityProfile };
          if (roomPayload.room) {
            startTransition(() => {
              setRoom(roomPayload.room!);
              setTaskAssigneeDraft(roomPayload.room!.teamMembers[0]?.id ?? "");
            });
          }
          if (roomPayload.security) {
            const nextSecurity = roomPayload.security;
            startTransition(() => {
              setSecurityProfile(nextSecurity);
              setSecurityClassificationDraft(nextSecurity.securityClassification);
              setEthicalWallEnabledDraft(nextSecurity.ethicalWallEnabled);
            });
          }
        }

        if (!cancelled && operationsResponse.ok) {
          const operationsPayload = (await operationsResponse.json()) as OperationalDashboard;
          startTransition(() => {
            setDashboard(operationsPayload);
          });
        }
      } catch {
        if (!cancelled) {
          setRoomError("The live matter room could not be refreshed. Showing the last available workspace state.");
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    setRoom(createFallbackMatterRoom(matter));
    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [matter]);

  const matterRoom = room?.matter.id === matter.id ? room : createFallbackMatterRoom(matter);
  const canPersistMatterRoom = matterRoom.source !== "fallback";
  const matterRoomSourceLabel =
    matterRoom.source === "live"
      ? "Supabase room data"
      : matterRoom.source === "prototype"
        ? "Local prototype storage"
        : "Seeded fallback data";
  const saveActionLabel =
    matterRoom.source === "live"
      ? "Saved to Supabase"
      : matterRoom.source === "prototype"
        ? "Saved locally"
        : "Open persisted workspace";

  const matterOperations = useMemo(() => {
    const notifications = (dashboard?.notifications ?? []).filter((item) => item.matterId === matter.id);
    const clientUpdates = (dashboard?.clientUpdates ?? []).filter((item) => item.matterId === matter.id);
    const thread = (dashboard?.chatThreads ?? []).find((item) => item.matterId === matter.id) ?? null;
    const guidance = (dashboard?.guidanceProfiles ?? []).find((item) => item.matterId === matter.id) ?? null;
    const memory = (dashboard?.memorySnapshots ?? []).find((item) => item.matterId === matter.id) ?? null;

    return {
      notifications,
      clientUpdates,
      thread,
      guidance,
      memory,
    };
  }, [dashboard, matter.id]);

  const matterThreadLead = matterOperations.thread?.participants[0] ?? matter.leadLawyer;

  useEffect(() => {
    setGuidanceSummaryDraft(matterOperations.guidance?.guidanceSummary ?? "");
    setNextActionDraft(matterOperations.guidance?.nextAction ?? "");
    setMemorySummaryDraft(matterOperations.memory?.summary ?? "");
    setMemoryDecisionDraft(matterOperations.memory?.keyDecision ?? "");
    setMemoryUnresolvedDraft(matterOperations.memory?.unresolvedItems.join(", ") ?? "");
  }, [matterOperations.guidance, matterOperations.memory]);

  useEffect(() => {
    setFileCodeDraft(matterRoom.physicalFile.fileCode);
    setFileLabelDraft(matterRoom.physicalFile.label);
    setFileLocationDraft(matterRoom.physicalFile.location);
    setFileCustodyDraft(matterRoom.physicalFile.custodyStatus);
    setFileQrDraft(matterRoom.physicalFile.qrPayload ?? "");
    setCustodyEventLocationDraft(matterRoom.physicalFile.location);
    setCustodyEventStatusDraft(matterRoom.physicalFile.custodyStatus);
  }, [matterRoom.physicalFile]);

  useEffect(() => {
    setMemberDraft(
      matterRoom.assignableLawyers.find((lawyer) => !lawyer.alreadyAssigned)?.id ?? ""
    );
  }, [matterRoom.assignableLawyers]);

  async function refreshOperations() {
    const response = await fetch("/api/operations", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as OperationalDashboard;
    startTransition(() => {
      setDashboard(payload);
    });
  }

  async function refreshMatterRoom() {
    const response = await fetch(`/api/matters/${matter.id}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to refresh matter room");
    }

    const payload = (await response.json()) as { room?: MatterRoomData };
    if (payload.room) {
      startTransition(() => {
        setRoom(payload.room!);
      });
    }
  }

  async function submitClientUpdate() {
    if (!clientUpdate.trim()) {
      return;
    }

    setIsSubmitting("client-update");
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createClientUpdateDraft",
          matterId: matter.id,
          channel: matterOperations.guidance?.preferredChannel ?? "Email",
          title: `${matter.clientName} progress update`,
          message: clientUpdate.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to save client update draft");
      }

      await response.json();
      setClientUpdate("");
      setRoomNotice("Client update draft saved. Partner approval is required before dispatch.");
      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to save the client update draft.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function approveClientUpdateRecord(updateId: string) {
    setClientUpdateBusyId(updateId);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approveClientUpdate",
          updateId,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to approve client update.");
      }

      setRoomNotice("Client update approved for dispatch.");
      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to approve the client update.");
    } finally {
      setClientUpdateBusyId(null);
    }
  }

  async function dispatchClientUpdateRecord(updateId: string) {
    setClientUpdateBusyId(updateId);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispatchApprovedClientUpdate",
          updateId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        delivery?: { note?: string; delivered?: boolean; recipient?: string | null };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to dispatch client update.");
      }

      setRoomNotice(
        payload.delivery?.note ??
          (payload.delivery?.delivered
            ? "Client update sent successfully."
            : "Client update queued or recorded for follow-up.")
      );
      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to dispatch the client update.");
    } finally {
      setClientUpdateBusyId(null);
    }
  }

  async function acknowledgeClientUpdateRecord(updateId: string) {
    setClientUpdateBusyId(updateId);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledgeClientUpdate",
          updateId,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to record acknowledgement.");
      }

      setRoomNotice("Client acknowledgement recorded in the matter communication log.");
      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to record the client acknowledgement.");
    } finally {
      setClientUpdateBusyId(null);
    }
  }

  async function submitDeadlineCalculation() {
    if (!deadlineRuleDraft || !deadlineStartDraft) {
      return;
    }

    setIsSubmitting("deadline");
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculateDeadline",
          ruleKey: deadlineRuleDraft,
          startDate: deadlineStartDraft,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        preview?: MatterDeadlinePreview;
      };

      if (!response.ok || !payload.success || !payload.preview) {
        throw new Error(payload.error ?? "Unable to calculate the procedural deadline.");
      }

      setDeadlinePreview(payload.preview);
      setRoomNotice(`Deadline calculated for ${payload.preview.ruleName}: ${payload.preview.deadlineLabel}.`);
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "Unable to calculate the procedural deadline."
      );
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitGuidanceRefresh() {
    if (!guidanceSummaryDraft.trim() || !nextActionDraft.trim()) {
      return;
    }

    setIsSubmitting("guidance");
    setRoomError(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertGuidanceProfile",
          matterId: matter.id,
          qualityScore: matterOperations.guidance?.qualityScore ?? 80,
          scoreTrend: matterOperations.guidance?.scoreTrend ?? "Stable",
          preferredChannel: matterOperations.guidance?.preferredChannel ?? "Email",
          preferredTone: matterOperations.guidance?.preferredTone ?? "Concise and reassuring",
          questionnaireSummary:
            matterOperations.guidance?.questionnaireSummary ?? "Matter guidance refreshed from the workspace.",
          guidanceSummary: guidanceSummaryDraft.trim(),
          nextAction: nextActionDraft.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to save guidance refresh");
      }

      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to refresh guidance.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitMemoryCheckpoint() {
    if (!memorySummaryDraft.trim() || !memoryDecisionDraft.trim()) {
      return;
    }

    setIsSubmitting("memory");
    setRoomError(null);
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createMemorySnapshot",
          matterId: matter.id,
          summary: memorySummaryDraft.trim(),
          keyDecision: memoryDecisionDraft.trim(),
          unresolvedItems: memoryUnresolvedDraft
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          recalledFor: "Matter reopen and team handoff",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to capture memory checkpoint");
      }

      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to capture memory checkpoint.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitSecurityProfile() {
    setSecurityBusy(true);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSecurityProfile",
          securityClassification: securityClassificationDraft,
          ethicalWallEnabled: ethicalWallEnabledDraft,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        room?: MatterRoomData;
        security?: MatterSecurityProfile;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update matter security.");
      }

      if (payload.room) {
        setRoom(payload.room);
      }
      if (payload.security) {
        setSecurityProfile(payload.security);
      }
      setRoomNotice("Matter security profile updated.");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to update matter security.");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function submitAccessOverride() {
    if (!accessOverrideLawyerIdDraft.trim()) {
      return;
    }

    setSecurityBusy(true);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertAccessOverride",
          lawyerId: accessOverrideLawyerIdDraft.trim(),
          accessStatus: accessOverrideStatusDraft,
          reason: accessOverrideReasonDraft.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        room?: MatterRoomData;
        security?: MatterSecurityProfile;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save access override.");
      }

      if (payload.room) {
        setRoom(payload.room);
      }
      if (payload.security) {
        setSecurityProfile(payload.security);
      }
      setAccessOverrideLawyerIdDraft("");
      setAccessOverrideReasonDraft("");
      setRoomNotice("Matter access override recorded.");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to save matter access override.");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function submitMatterComment() {
    if (!commentDraft.trim()) {
      return;
    }

    setIsSubmitting("comment");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createComment",
          body: commentDraft.trim(),
          commentType: "note",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to save collaboration note");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
      setCommentDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to save the collaboration note.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitMatterChatMessage() {
    if (!matterOperations.thread || !chatMessageDraft.trim()) {
      return;
    }

    setIsSubmitting("chat");
    setRoomError(null);

    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chatMessage",
          threadId: matterOperations.thread.id,
          author: matterThreadLead,
          role: "Matter team",
          body: chatMessageDraft.trim(),
          origin: "human",
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        message?: { id: string; threadId: string; author: string; role: string; body: string; createdAt: string; origin: "human" | "ai" | "system" };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.message) {
        throw new Error(payload.error ?? "Unable to post the chat message.");
      }

      setDashboard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          chatThreads: current.chatThreads.map((thread) =>
            thread.id !== payload.message?.threadId
              ? thread
              : {
                  ...thread,
                  unreadCount: thread.unreadCount + 1,
                  lastActivityAt: payload.message.createdAt,
                  messages: [
                    ...thread.messages,
                    {
                      id: payload.message.id,
                      author: payload.message.author,
                      role: payload.message.role,
                      body: payload.message.body,
                      createdAt: payload.message.createdAt,
                      origin: payload.message.origin,
                    },
                  ],
                }
          ),
        };
      });

      setChatMessageDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to post the chat message.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function markNotificationRead(notificationId: string) {
    setNotificationBusyId(notificationId);
    setRoomError(null);

    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "markNotificationRead",
          notificationId,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; notification?: { id: string; status: string }; error?: string };
      if (!response.ok || !payload.success || !payload.notification) {
        throw new Error(payload.error ?? "Unable to update the notification.");
      }

      setDashboard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          notifications: current.notifications.map((notification) =>
            notification.id === notificationId ? { ...notification, status: "Read" } : notification
          ),
        };
      });
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to update the notification.");
    } finally {
      setNotificationBusyId(null);
    }
  }

  async function submitMatterTask() {
    if (!taskTitleDraft.trim()) {
      return;
    }

    setIsSubmitting("task");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createTask",
          title: taskTitleDraft.trim(),
          description: taskDescriptionDraft.trim(),
          deadline: taskDeadlineDraft || null,
          assignedTo: taskAssigneeDraft || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to create task");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }

      setTaskTitleDraft("");
      setTaskDescriptionDraft("");
      setTaskDeadlineDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to create the task.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitMatterInvoice() {
    const amountXaf = Number(invoiceAmountDraft);
    if (!Number.isFinite(amountXaf) || amountXaf <= 0) {
      return;
    }

    setIsSubmitting("invoice");
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createInvoice",
          amountXaf,
          dueDate: invoiceDueDateDraft || null,
          status: invoiceStatusDraft,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to create invoice");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }

      setInvoiceAmountDraft("");
      setInvoiceDueDateDraft("");
      setInvoiceStatusDraft("Draft");
      setRoomNotice("Invoice created and linked to the matter finance ledger.");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to create invoice.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function updateInvoiceStatus(invoiceId: string, status: MatterInvoice["status"]) {
    setInvoiceBusyId(invoiceId);
    setRoomError(null);
    setRoomNotice(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateInvoiceStatus",
          invoiceId,
          status,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to update invoice status");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }

      setRoomNotice(`Invoice status updated to ${status}.`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to update invoice status.");
    } finally {
      setInvoiceBusyId(null);
    }
  }

  async function toggleTaskStatus(task: MatterRoomTask) {
    const nextStatus = task.status === "Done" ? "Open" : "Done";

    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateTaskStatus",
          taskId: task.id,
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to update task status");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to update task status.");
    }
  }

  async function submitMatterDocument() {
    if (!documentTitleDraft.trim()) {
      return;
    }

    setIsSubmitting("document");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDocument",
          title: documentTitleDraft.trim(),
          documentType: documentTypeDraft,
          documentStatus: documentStatusDraft,
          reviewStatus: documentReviewStatusDraft,
          accessLevel: documentAccessLevelDraft,
          sharingPolicy: documentSharingPolicyDraft,
          versionLabel: documentVersionLabelDraft.trim() || null,
          storagePath: documentPathDraft.trim() || null,
          oneDriveFileId: documentOneDriveIdDraft.trim() || null,
          aiSummary: documentSummaryDraft.trim() || null,
          requiresComplianceAudit: documentComplianceDraft,
          reviewNote: documentReviewNoteDraft.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to register document");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }

      setDocumentTitleDraft("");
      setDocumentPathDraft("");
      setDocumentOneDriveIdDraft("");
      setDocumentSummaryDraft("");
      setDocumentComplianceDraft(false);
      setDocumentStatusDraft("Draft");
      setDocumentReviewStatusDraft("Working");
      setDocumentAccessLevelDraft("Matter team");
      setDocumentSharingPolicyDraft("Internal only");
      setDocumentVersionLabelDraft("v1");
      setDocumentReviewNoteDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to register the document.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function uploadMatterDocument(file: File) {
    setIsSubmitting("document-upload");
    setRoomError(null);

    try {
      const formData = new FormData();
      formData.set("target", "matter-document");
      formData.set("matterId", matter.id);
      formData.set("file", file);
      formData.set("title", documentTitleDraft.trim() || file.name);
      formData.set("documentType", documentTypeDraft);
      formData.set("documentStatus", documentStatusDraft);
      formData.set("reviewStatus", documentReviewStatusDraft);
      formData.set("accessLevel", documentAccessLevelDraft);
      formData.set("sharingPolicy", documentSharingPolicyDraft);
      formData.set("versionLabel", documentVersionLabelDraft.trim() || "v1");
      formData.set("reviewNote", documentReviewNoteDraft.trim());
      formData.set("aiSummary", documentSummaryDraft.trim());
      formData.set("requiresComplianceAudit", documentComplianceDraft ? "true" : "false");
      formData.set("registerKnowledge", "true");
      formData.set(
        "knowledgeSummary",
        documentSummaryDraft.trim() || `${file.name} was uploaded and staged for later source-grounded processing.`
      );

      const response = await fetch("/api/file-vault", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { room?: MatterRoomData; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to upload the matter document.");
      }

      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to upload the matter document.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function updateDocumentControlRecord(input: {
    documentId: string;
    documentStatus: "Draft" | "Final" | "Filed" | "Archived";
    reviewStatus: "Working" | "Internal review" | "Approved" | "Needs revision";
    accessLevel: "Matter team" | "Lead+Partner";
    sharingPolicy: "Internal only" | "Client-share ready" | "Blocked";
    versionLabel: string;
    reviewNote: string;
  }) {
    setDocumentBusyId(input.documentId);
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateDocumentControl",
          documentId: input.documentId,
          documentStatus: input.documentStatus,
          reviewStatus: input.reviewStatus,
          accessLevel: input.accessLevel,
          sharingPolicy: input.sharingPolicy,
          versionLabel: input.versionLabel.trim() || null,
          reviewNote: input.reviewNote.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to update document control");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to update document control.");
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function submitPhysicalFileUpdate() {
    if (!fileCodeDraft.trim() || !fileLabelDraft.trim()) {
      return;
    }

    setIsSubmitting("physical-file");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsertPhysicalFile",
          fileCode: fileCodeDraft.trim(),
          label: fileLabelDraft.trim(),
          location: fileLocationDraft.trim(),
          custodyStatus: fileCustodyDraft.trim(),
          qrPayload: fileQrDraft.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to save physical file");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to save the physical file registry.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitCustodyEvent() {
    if (!custodyEventNoteDraft.trim()) {
      return;
    }

    setIsSubmitting("custody");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createCustodyEvent",
          eventType: custodyEventTypeDraft,
          note: custodyEventNoteDraft.trim(),
          location: custodyEventLocationDraft.trim() || undefined,
          custodyStatus: custodyEventStatusDraft.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to record custody event");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
      setCustodyEventNoteDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to record custody event.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function submitMemberAssignment() {
    if (!memberDraft) {
      return;
    }

    setIsSubmitting("task");
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assignMember",
          lawyerId: memberDraft,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to assign team member");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to assign the team member.");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function removeMember(lawyerId: string) {
    setRoomError(null);
    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeMember",
          lawyerId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to remove team member");
      }

      const payload = (await response.json()) as { room?: MatterRoomData };
      if (payload.room) {
        setRoom(payload.room);
      } else {
        await refreshMatterRoom();
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to remove the team member.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Matter Workspace</p>
            <h2 className="text-3xl heading-serif text-heritage-green">{matter.title}</h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              This is the operational center of the matter: core facts, filings, evidence, research, collaboration,
              governance checks, and the paper file mirror all visible in one place.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.6rem] border border-heritage-green/10 bg-[#f7fbf9] px-5 py-4">
              <div className="flex items-center gap-3 text-heritage-green">
                <QrCode className="h-5 w-5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Access key</p>
                  <p className="text-sm font-semibold">
                    {matterRoom.physicalFile.fileCode} / {matterRoom.physicalFile.location}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                  canPersistMatterRoom
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {matterRoomSourceLabel}
              </span>
            </div>
          </div>
        </div>

        {roomError && (
          <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {roomError}
          </div>
        )}

        {roomNotice && (
          <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {roomNotice}
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-[1.25rem] bg-[#f3f5f2] p-2">
          {workspaceTabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                  active ? "bg-white text-heritage-green shadow-sm" : "text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {activeTab === "overview" && (
            <OverviewPanel
              matter={matter}
              matterRoom={matterRoom}
              matterOperations={matterOperations}
              clientUpdate={clientUpdate}
              taskTitleDraft={taskTitleDraft}
              taskDescriptionDraft={taskDescriptionDraft}
              taskDeadlineDraft={taskDeadlineDraft}
              taskAssigneeDraft={taskAssigneeDraft}
              deadlineRuleDraft={deadlineRuleDraft}
              deadlineStartDraft={deadlineStartDraft}
              deadlinePreview={deadlinePreview}
              isRefreshing={isRefreshing}
              isSubmitting={isSubmitting}
              notificationBusyId={notificationBusyId}
              clientUpdateBusyId={clientUpdateBusyId}
              canPersistMatterRoom={canPersistMatterRoom}
              saveActionLabel={saveActionLabel}
              onClientUpdateChange={setClientUpdate}
              onTaskTitleChange={setTaskTitleDraft}
              onTaskDescriptionChange={setTaskDescriptionDraft}
              onTaskDeadlineChange={setTaskDeadlineDraft}
              onTaskAssigneeChange={setTaskAssigneeDraft}
              onDeadlineRuleChange={setDeadlineRuleDraft}
              onDeadlineStartChange={setDeadlineStartDraft}
              onSubmitClientUpdate={() => void submitClientUpdate()}
              onApproveClientUpdate={(updateId) => void approveClientUpdateRecord(updateId)}
              onDispatchClientUpdate={(updateId) => void dispatchClientUpdateRecord(updateId)}
              onAcknowledgeClientUpdate={(updateId) => void acknowledgeClientUpdateRecord(updateId)}
              onSubmitDeadlineCalculation={() => void submitDeadlineCalculation()}
              onSubmitMatterTask={() => void submitMatterTask()}
              onToggleTaskStatus={(task) => void toggleTaskStatus(task)}
              onMarkNotificationRead={(notificationId) => void markNotificationRead(notificationId)}
            />
          )}
          {activeTab === "documents" && (
            <DocumentsPanel
              matterRoom={matterRoom}
              documentTitleDraft={documentTitleDraft}
              documentTypeDraft={documentTypeDraft}
              documentStatusDraft={documentStatusDraft}
              documentReviewStatusDraft={documentReviewStatusDraft}
              documentAccessLevelDraft={documentAccessLevelDraft}
              documentSharingPolicyDraft={documentSharingPolicyDraft}
              documentVersionLabelDraft={documentVersionLabelDraft}
              documentReviewNoteDraft={documentReviewNoteDraft}
              documentPathDraft={documentPathDraft}
              documentOneDriveIdDraft={documentOneDriveIdDraft}
              documentSummaryDraft={documentSummaryDraft}
              documentComplianceDraft={documentComplianceDraft}
              fileCodeDraft={fileCodeDraft}
              fileLabelDraft={fileLabelDraft}
              fileLocationDraft={fileLocationDraft}
              fileCustodyDraft={fileCustodyDraft}
              fileQrDraft={fileQrDraft}
              custodyEventTypeDraft={custodyEventTypeDraft}
              custodyEventNoteDraft={custodyEventNoteDraft}
              custodyEventLocationDraft={custodyEventLocationDraft}
              custodyEventStatusDraft={custodyEventStatusDraft}
              isSubmitting={isSubmitting}
              documentBusyId={documentBusyId}
              canPersistMatterRoom={canPersistMatterRoom}
              saveActionLabel={saveActionLabel}
              onDocumentTitleChange={setDocumentTitleDraft}
              onDocumentTypeChange={setDocumentTypeDraft}
              onDocumentStatusChange={setDocumentStatusDraft}
              onDocumentReviewStatusChange={setDocumentReviewStatusDraft}
              onDocumentAccessLevelChange={setDocumentAccessLevelDraft}
              onDocumentSharingPolicyChange={setDocumentSharingPolicyDraft}
              onDocumentVersionLabelChange={setDocumentVersionLabelDraft}
              onDocumentReviewNoteChange={setDocumentReviewNoteDraft}
              onDocumentPathChange={setDocumentPathDraft}
              onDocumentOneDriveIdChange={setDocumentOneDriveIdDraft}
              onDocumentSummaryChange={setDocumentSummaryDraft}
              onDocumentComplianceChange={setDocumentComplianceDraft}
              onFileCodeChange={setFileCodeDraft}
              onFileLabelChange={setFileLabelDraft}
              onFileLocationChange={setFileLocationDraft}
              onFileCustodyChange={setFileCustodyDraft}
              onFileQrChange={setFileQrDraft}
              onCustodyEventTypeChange={setCustodyEventTypeDraft}
              onCustodyEventNoteChange={setCustodyEventNoteDraft}
              onCustodyEventLocationChange={setCustodyEventLocationDraft}
              onCustodyEventStatusChange={setCustodyEventStatusDraft}
              onSubmitMatterDocument={() => void submitMatterDocument()}
              onUploadMatterDocument={(file) => void uploadMatterDocument(file)}
              onUpdateDocumentControl={(input) => void updateDocumentControlRecord(input)}
              onSubmitPhysicalFileUpdate={() => void submitPhysicalFileUpdate()}
              onSubmitCustodyEvent={() => void submitCustodyEvent()}
            />
          )}
          {activeTab === "strategy" && <StrategyPanel matter={matter} />}
          {activeTab === "studio" && (
            <CaseFileStudioPanel
              matter={matter}
              matterRoom={matterRoom}
              onRoomChange={setRoom}
              onError={setRoomError}
            />
          )}
          {activeTab === "intelligence" && (
            <LegalIntelligencePanel
              matter={matter}
              matterRoom={matterRoom}
              onRoomChange={setRoom}
              onError={setRoomError}
            />
          )}
          {activeTab === "collaboration" && (
            <CollaborationPanel
              matter={matter}
              matterRoom={matterRoom}
              matterOperations={matterOperations}
              memberDraft={memberDraft}
              commentDraft={commentDraft}
              chatMessageDraft={chatMessageDraft}
              isSubmitting={isSubmitting}
              notificationBusyId={notificationBusyId}
              canPersistMatterRoom={canPersistMatterRoom}
              saveActionLabel={saveActionLabel}
              onMemberDraftChange={setMemberDraft}
              onCommentDraftChange={setCommentDraft}
              onChatMessageDraftChange={setChatMessageDraft}
              onSubmitMemberAssignment={() => void submitMemberAssignment()}
              onRemoveMember={(lawyerId) => void removeMember(lawyerId)}
              onSubmitMatterComment={() => void submitMatterComment()}
              onSubmitMatterChatMessage={() => void submitMatterChatMessage()}
              onMarkNotificationRead={(notificationId) => void markNotificationRead(notificationId)}
            />
          )}
          {activeTab === "governance" && (
            <GovernancePanel
              matter={matter}
              matterRoom={matterRoom}
              matterOperations={matterOperations}
              securityProfile={securityProfile}
              securityClassificationDraft={securityClassificationDraft}
              ethicalWallEnabledDraft={ethicalWallEnabledDraft}
              accessOverrideLawyerIdDraft={accessOverrideLawyerIdDraft}
              accessOverrideStatusDraft={accessOverrideStatusDraft}
              accessOverrideReasonDraft={accessOverrideReasonDraft}
              guidanceSummaryDraft={guidanceSummaryDraft}
              nextActionDraft={nextActionDraft}
              memorySummaryDraft={memorySummaryDraft}
              memoryDecisionDraft={memoryDecisionDraft}
              memoryUnresolvedDraft={memoryUnresolvedDraft}
              isSubmitting={isSubmitting}
              securityBusy={securityBusy}
              onGuidanceSummaryChange={setGuidanceSummaryDraft}
              onNextActionChange={setNextActionDraft}
              onMemorySummaryChange={setMemorySummaryDraft}
              onMemoryDecisionChange={setMemoryDecisionDraft}
              onMemoryUnresolvedChange={setMemoryUnresolvedDraft}
              onSecurityClassificationChange={setSecurityClassificationDraft}
              onEthicalWallEnabledChange={setEthicalWallEnabledDraft}
              onAccessOverrideLawyerIdChange={setAccessOverrideLawyerIdDraft}
              onAccessOverrideStatusChange={setAccessOverrideStatusDraft}
              onAccessOverrideReasonChange={setAccessOverrideReasonDraft}
              onSubmitGuidanceRefresh={() => void submitGuidanceRefresh()}
              onSubmitMemoryCheckpoint={() => void submitMemoryCheckpoint()}
              onSubmitSecurityProfile={() => void submitSecurityProfile()}
              onSubmitAccessOverride={() => void submitAccessOverride()}
            />
          )}
          {activeTab === "finance" && (
            <FinancePanel
              matterRoom={matterRoom}
              invoiceAmountDraft={invoiceAmountDraft}
              invoiceDueDateDraft={invoiceDueDateDraft}
              invoiceStatusDraft={invoiceStatusDraft}
              invoiceBusyId={invoiceBusyId}
              isSubmitting={isSubmitting}
              canPersistMatterRoom={canPersistMatterRoom}
              saveActionLabel={saveActionLabel}
              onInvoiceAmountChange={setInvoiceAmountDraft}
              onInvoiceDueDateChange={setInvoiceDueDateDraft}
              onInvoiceStatusChange={setInvoiceStatusDraft}
              onSubmitMatterInvoice={() => void submitMatterInvoice()}
              onUpdateInvoiceStatus={(invoiceId, status) => void updateInvoiceStatus(invoiceId, status)}
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}

function OverviewPanel({
  matter,
  matterRoom,
  matterOperations,
  clientUpdate,
  taskTitleDraft,
  taskDescriptionDraft,
  taskDeadlineDraft,
  taskAssigneeDraft,
  deadlineRuleDraft,
  deadlineStartDraft,
  deadlinePreview,
  isRefreshing,
  isSubmitting,
  notificationBusyId,
  clientUpdateBusyId,
  canPersistMatterRoom,
  saveActionLabel,
  onClientUpdateChange,
  onTaskTitleChange,
  onTaskDescriptionChange,
  onTaskDeadlineChange,
  onTaskAssigneeChange,
  onDeadlineRuleChange,
  onDeadlineStartChange,
  onSubmitClientUpdate,
  onApproveClientUpdate,
  onDispatchClientUpdate,
  onAcknowledgeClientUpdate,
  onSubmitDeadlineCalculation,
  onSubmitMatterTask,
  onToggleTaskStatus,
  onMarkNotificationRead,
}: {
  matter: MatterWorkspaceData;
  matterRoom: MatterRoomData;
  matterOperations: MatterOperations;
  clientUpdate: string;
  taskTitleDraft: string;
  taskDescriptionDraft: string;
  taskDeadlineDraft: string;
  taskAssigneeDraft: string;
  deadlineRuleDraft: string;
  deadlineStartDraft: string;
  deadlinePreview: MatterDeadlinePreview | null;
  isRefreshing: boolean;
  isSubmitting: MatterSubmitState;
  notificationBusyId: string | null;
  clientUpdateBusyId: string | null;
  canPersistMatterRoom: boolean;
  saveActionLabel: string;
  onClientUpdateChange: (value: string) => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onTaskDeadlineChange: (value: string) => void;
  onTaskAssigneeChange: (value: string) => void;
  onDeadlineRuleChange: (value: string) => void;
  onDeadlineStartChange: (value: string) => void;
  onSubmitClientUpdate: () => void;
  onApproveClientUpdate: (updateId: string) => void;
  onDispatchClientUpdate: (updateId: string) => void;
  onAcknowledgeClientUpdate: (updateId: string) => void;
  onSubmitDeadlineCalculation: () => void;
  onSubmitMatterTask: () => void;
  onToggleTaskStatus: (task: MatterRoomTask) => void;
  onMarkNotificationRead: (notificationId: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile icon={Landmark} label="Jurisdiction" value={matter.jurisdiction} />
          <StatTile icon={Users} label="Matter Team" value={`${matterRoom.teamMembers.length} linked members`} />
          <StatTile icon={FileDigit} label="Digital Mirror" value={`${matter.documents.length} indexed items`} />
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-[#fcfcfb] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matter synopsis</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">{matter.synopsis}</p>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Live matter loop</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Assigned team and tracked tasks</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {matterRoom.teamMembers.map((member) => (
                <div key={member.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                    <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                      {member.role}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{member.focus}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {matterRoom.tasks.length ? (
                matterRoom.tasks.map((task) => (
                  <div key={task.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.assignedTo}</p>
                      </div>
                      <button
                        onClick={() => onToggleTaskStatus(task)}
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          task.status === "Done"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.status === "Done" ? "Reopen" : "Mark done"}
                      </button>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {task.status} • {task.deadline ?? "No deadline"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                  No persisted tasks yet for this matter.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Actionable notifications</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Follow through on real alerts instead of leaving them as badges.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {matterOperations.notifications.length} items
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {matterOperations.notifications.length ? (
                matterOperations.notifications.map((notification) => (
                  <div key={notification.id} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {notification.channel}
                          </span>
                          <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-heritage-green">
                            {notification.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{notification.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                        {notification.deliveryNote ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {notification.deliveryNote}
                            {notification.recipient ? ` Recipient: ${notification.recipient}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => onMarkNotificationRead(notification.id)}
                        disabled={notificationBusyId === notification.id || notification.status === "Read"}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {notificationBusyId === notification.id
                          ? "Saving..."
                          : notification.status === "Read"
                            ? "Read"
                            : "Mark read"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                  No matter notifications yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Create matter task</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={taskTitleDraft}
                onChange={(event) => onTaskTitleChange(event.target.value)}
                placeholder="Task title"
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              />
              <select
                value={taskAssigneeDraft}
                onChange={(event) => onTaskAssigneeChange(event.target.value)}
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                <option value="">Unassigned</option>
                {matterRoom.teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={taskDescriptionDraft}
              onChange={(event) => onTaskDescriptionChange(event.target.value)}
              placeholder="Task detail and expected output"
              className="mt-3 min-h-24 w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                value={taskDeadlineDraft}
                onChange={(event) => onTaskDeadlineChange(event.target.value)}
                type="datetime-local"
                className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-heritage-green"
              />
              <button
                onClick={onSubmitMatterTask}
                disabled={isSubmitting === "task" || !taskTitleDraft.trim() || !canPersistMatterRoom}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "task" ? "Saving..." : canPersistMatterRoom ? "Create task" : saveActionLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(160deg,_#ffffff_0%,_#f5faf8_100%)] p-5">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Live operations</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">What the system is tracking now</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <OpsTile
              icon={BellRing}
              label="Notifications"
              value={matterOperations.notifications.length ? `${matterOperations.notifications.length} active` : "No matter alerts"}
              hint={matterOperations.notifications[0]?.title ?? "No operational notification linked yet"}
            />
            <OpsTile
              icon={MessageSquareText}
              label="Chat room"
              value={matterOperations.thread ? `${matterOperations.thread.unreadCount} unread` : "No live thread"}
              hint={matterOperations.thread?.title ?? "Thread will appear once collaboration is persisted"}
            />
            <OpsTile
              icon={MemoryStick}
              label="Recall state"
              value={matterOperations.memory ? "Memory captured" : "No recall snapshot"}
              hint={matterOperations.memory?.keyDecision ?? "Snapshot will appear after the first strategic checkpoint"}
            />
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Deadline intelligence</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Calculate OHADA deadlines from the matter room before you assign the next filing step.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Procedural
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <select
                value={deadlineRuleDraft}
                onChange={(event) => onDeadlineRuleChange(event.target.value)}
                className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                {Object.entries(OHADA_RULES).map(([ruleKey, rule]) => (
                  <option key={ruleKey} value={ruleKey}>
                    {rule.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={deadlineStartDraft}
                onChange={(event) => onDeadlineStartChange(event.target.value)}
                className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3 text-sm outline-none transition focus:border-heritage-green"
              />
              <button
                onClick={onSubmitDeadlineCalculation}
                disabled={isSubmitting === "deadline" || !deadlineStartDraft}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "deadline" ? "Calculating..." : "Calculate deadline"}
              </button>
            </div>

            {deadlinePreview ? (
              <div className="mt-4 rounded-[1.1rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <p className="text-sm font-semibold text-slate-900">{deadlinePreview.ruleName}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {deadlinePreview.triggerEvent} • {deadlinePreview.computationType}
                </p>
                <p className="mt-3 text-lg font-semibold text-heritage-green">
                  Due {deadlinePreview.deadlineLabel}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{deadlinePreview.warning}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.1rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                Pick a trigger date and rule to calculate a matter-ready deadline.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Client communication ledger</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Draft, approve, dispatch, and acknowledge client-facing updates as controlled legal communications.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {matterOperations.clientUpdates.length} records
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {matterOperations.clientUpdates.length ? (
                matterOperations.clientUpdates.map((update) => (
                  <div key={update.id} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {update.channel}
                          </span>
                          <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-heritage-green">
                            {update.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{update.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{update.message}</p>
                        <p className="mt-3 text-xs text-slate-500">
                          {update.deliveryNote ?? "No delivery note yet."}
                          {update.recipient ? ` Recipient: ${update.recipient}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:max-w-[16rem] md:justify-end">
                        {update.status === "Draft" && (
                          <button
                            onClick={() => onApproveClientUpdate(update.id)}
                            disabled={clientUpdateBusyId === update.id}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {clientUpdateBusyId === update.id ? "Saving..." : "Approve"}
                          </button>
                        )}
                        {(update.status === "Approved" || update.status === "Queued") && (
                          <button
                            onClick={() => onDispatchClientUpdate(update.id)}
                            disabled={clientUpdateBusyId === update.id}
                            className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {clientUpdateBusyId === update.id ? "Sending..." : "Dispatch"}
                          </button>
                        )}
                        {(update.status === "Sent" || update.status === "Delivered" || update.status === "Queued") && (
                          <button
                            onClick={() => onAcknowledgeClientUpdate(update.id)}
                            disabled={clientUpdateBusyId === update.id}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {clientUpdateBusyId === update.id ? "Saving..." : "Acknowledge"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                  No client communication records yet for this matter.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FilePenLine className="h-4 w-4 text-heritage-green" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Client update desk</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Draft the next client-facing progress message from the matter room
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {isRefreshing ? "Refreshing" : "Ready"}
              </span>
            </div>

            <textarea
              value={clientUpdate}
              onChange={(event) => onClientUpdateChange(event.target.value)}
              placeholder={`Update ${matter.clientName} on the next move, current risk, or filing progress...`}
              className="mt-4 min-h-28 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Delivery channel defaults to {matterOperations.guidance?.preferredChannel ?? "Email"}
              </p>
              <button
                onClick={onSubmitClientUpdate}
                disabled={isSubmitting === "client-update" || !clientUpdate.trim()}
                className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "client-update" ? "Saving..." : "Save draft"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-[#0b211c] p-6 text-white">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-gold-accent" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Next critical dates</p>
            <h3 className="mt-1 text-lg font-semibold">Procedural rhythm</h3>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {matter.timeline.map((item) => (
            <div key={item.title} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gold-accent">{item.date}</span>
              </div>
              <p className="mt-2 text-xs text-white/65">{item.owner}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsPanel({
  matterRoom,
  documentTitleDraft,
  documentTypeDraft,
  documentStatusDraft,
  documentReviewStatusDraft,
  documentAccessLevelDraft,
  documentSharingPolicyDraft,
  documentVersionLabelDraft,
  documentReviewNoteDraft,
  documentPathDraft,
  documentOneDriveIdDraft,
  documentSummaryDraft,
  documentComplianceDraft,
  fileCodeDraft,
  fileLabelDraft,
  fileLocationDraft,
  fileCustodyDraft,
  fileQrDraft,
  custodyEventTypeDraft,
  custodyEventNoteDraft,
  custodyEventLocationDraft,
  custodyEventStatusDraft,
  isSubmitting,
  documentBusyId,
  canPersistMatterRoom,
  saveActionLabel,
  onDocumentTitleChange,
  onDocumentTypeChange,
  onDocumentStatusChange,
  onDocumentReviewStatusChange,
  onDocumentAccessLevelChange,
  onDocumentSharingPolicyChange,
  onDocumentVersionLabelChange,
  onDocumentReviewNoteChange,
  onDocumentPathChange,
  onDocumentOneDriveIdChange,
  onDocumentSummaryChange,
  onDocumentComplianceChange,
  onFileCodeChange,
  onFileLabelChange,
  onFileLocationChange,
  onFileCustodyChange,
  onFileQrChange,
  onCustodyEventTypeChange,
  onCustodyEventNoteChange,
  onCustodyEventLocationChange,
  onCustodyEventStatusChange,
  onSubmitMatterDocument,
  onUploadMatterDocument,
  onUpdateDocumentControl,
  onSubmitPhysicalFileUpdate,
  onSubmitCustodyEvent,
}: {
  matterRoom: MatterRoomData;
  documentTitleDraft: string;
  documentTypeDraft: string;
  documentStatusDraft: "Draft" | "Final" | "Filed" | "Archived";
  documentReviewStatusDraft: "Working" | "Internal review" | "Approved" | "Needs revision";
  documentAccessLevelDraft: "Matter team" | "Lead+Partner";
  documentSharingPolicyDraft: "Internal only" | "Client-share ready" | "Blocked";
  documentVersionLabelDraft: string;
  documentReviewNoteDraft: string;
  documentPathDraft: string;
  documentOneDriveIdDraft: string;
  documentSummaryDraft: string;
  documentComplianceDraft: boolean;
  fileCodeDraft: string;
  fileLabelDraft: string;
  fileLocationDraft: string;
  fileCustodyDraft: string;
  fileQrDraft: string;
  custodyEventTypeDraft: MatterRoomCustodyEvent["eventType"];
  custodyEventNoteDraft: string;
  custodyEventLocationDraft: string;
  custodyEventStatusDraft: string;
  isSubmitting: MatterSubmitState;
  documentBusyId: string | null;
  canPersistMatterRoom: boolean;
  saveActionLabel: string;
  onDocumentTitleChange: (value: string) => void;
  onDocumentTypeChange: (value: string) => void;
  onDocumentStatusChange: (value: "Draft" | "Final" | "Filed" | "Archived") => void;
  onDocumentReviewStatusChange: (value: "Working" | "Internal review" | "Approved" | "Needs revision") => void;
  onDocumentAccessLevelChange: (value: "Matter team" | "Lead+Partner") => void;
  onDocumentSharingPolicyChange: (value: "Internal only" | "Client-share ready" | "Blocked") => void;
  onDocumentVersionLabelChange: (value: string) => void;
  onDocumentReviewNoteChange: (value: string) => void;
  onDocumentPathChange: (value: string) => void;
  onDocumentOneDriveIdChange: (value: string) => void;
  onDocumentSummaryChange: (value: string) => void;
  onDocumentComplianceChange: (value: boolean) => void;
  onFileCodeChange: (value: string) => void;
  onFileLabelChange: (value: string) => void;
  onFileLocationChange: (value: string) => void;
  onFileCustodyChange: (value: string) => void;
  onFileQrChange: (value: string) => void;
  onCustodyEventTypeChange: (value: MatterRoomCustodyEvent["eventType"]) => void;
  onCustodyEventNoteChange: (value: string) => void;
  onCustodyEventLocationChange: (value: string) => void;
  onCustodyEventStatusChange: (value: string) => void;
  onSubmitMatterDocument: () => void;
  onUploadMatterDocument: (file: File) => void;
  onUpdateDocumentControl: (input: {
    documentId: string;
    documentStatus: "Draft" | "Final" | "Filed" | "Archived";
    reviewStatus: "Working" | "Internal review" | "Approved" | "Needs revision";
    accessLevel: "Matter team" | "Lead+Partner";
    sharingPolicy: "Internal only" | "Client-share ready" | "Blocked";
    versionLabel: string;
    reviewNote: string;
  }) => void;
  onSubmitPhysicalFileUpdate: () => void;
  onSubmitCustodyEvent: () => void;
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentControlDrafts, setDocumentControlDrafts] = useState<
    Record<
      string,
      {
        documentStatus: "Draft" | "Final" | "Filed" | "Archived";
        reviewStatus: "Working" | "Internal review" | "Approved" | "Needs revision";
        accessLevel: "Matter team" | "Lead+Partner";
        sharingPolicy: "Internal only" | "Client-share ready" | "Blocked";
        versionLabel: string;
        reviewNote: string;
      }
    >
  >({});

  function patchDocumentControlDraft(
    documentId: string,
    patch: Partial<{
      documentStatus: "Draft" | "Final" | "Filed" | "Archived";
      reviewStatus: "Working" | "Internal review" | "Approved" | "Needs revision";
      accessLevel: "Matter team" | "Lead+Partner";
      sharingPolicy: "Internal only" | "Client-share ready" | "Blocked";
      versionLabel: string;
      reviewNote: string;
    }>
  ) {
    setDocumentControlDrafts((current) => {
      const existing = current[documentId];
      return {
        ...current,
        [documentId]: {
          documentStatus: existing?.documentStatus ?? "Draft",
          reviewStatus: existing?.reviewStatus ?? "Working",
          accessLevel: existing?.accessLevel ?? "Matter team",
          sharingPolicy: existing?.sharingPolicy ?? "Internal only",
          versionLabel: existing?.versionLabel ?? "v1",
          reviewNote: existing?.reviewNote ?? "",
          ...patch,
        },
      };
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="rounded-[1.6rem] border border-slate-200 bg-[#fcfcfb] p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-heritage-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Working set</p>
            <h3 className="mt-1 text-lg font-semibold text-heritage-green">Live documents and exhibits</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {matterRoom.documents.map((item) => (
            <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {item.syncStatus} • {item.createdAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                    {item.documentType}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                    {item.accessLevel}
                  </span>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
                    {item.sharingPolicy}
                  </span>
                  {item.requiresComplianceAudit && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
                      Compliance
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{item.storagePath}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.aiSummary}</p>
              {item.oneDriveFileId && (
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  OneDrive ID: {item.oneDriveFileId}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {matterRoom.documents.map((item) => {
            const draft = documentControlDrafts[item.id] ?? {
              documentStatus: item.documentStatus,
              reviewStatus: item.reviewStatus,
              accessLevel: item.accessLevel,
              sharingPolicy: item.sharingPolicy,
              versionLabel: item.versionLabel ?? "v1",
              reviewNote: item.reviewNote ?? "",
            };

            return (
              <div key={`${item.id}-control`} className="rounded-[1.2rem] border border-dashed border-slate-300 bg-[#f8faf9] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Control: {item.title}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {item.documentStatus} • {item.reviewStatus}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.versionLabel ? `Version ${item.versionLabel}` : "Version not set"}
                    {item.filedAt ? ` • Filed ${item.filedAt}` : ""}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <select
                    value={draft.documentStatus}
                    onChange={(event) =>
                      patchDocumentControlDraft(item.id, {
                        documentStatus: event.target.value as "Draft" | "Final" | "Filed" | "Archived",
                      })
                    }
                    className="w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-heritage-green"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Final">Final</option>
                    <option value="Filed">Filed</option>
                    <option value="Archived">Archived</option>
                  </select>
                  <select
                    value={draft.reviewStatus}
                    onChange={(event) =>
                      patchDocumentControlDraft(item.id, {
                        reviewStatus: event.target.value as
                          | "Working"
                          | "Internal review"
                          | "Approved"
                          | "Needs revision",
                      })
                    }
                    className="w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-heritage-green"
                  >
                    <option value="Working">Working</option>
                    <option value="Internal review">Internal review</option>
                    <option value="Approved">Approved</option>
                    <option value="Needs revision">Needs revision</option>
                  </select>
                  <input
                    value={draft.versionLabel}
                    onChange={(event) => patchDocumentControlDraft(item.id, { versionLabel: event.target.value })}
                    placeholder="Version label"
                    className="w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-heritage-green"
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <select
                    value={draft.accessLevel}
                    onChange={(event) =>
                      patchDocumentControlDraft(item.id, {
                        accessLevel: event.target.value as "Matter team" | "Lead+Partner",
                      })
                    }
                    className="w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-heritage-green"
                  >
                    <option value="Matter team">Matter team</option>
                    <option value="Lead+Partner">Lead+Partner</option>
                  </select>
                  <select
                    value={draft.sharingPolicy}
                    onChange={(event) =>
                      patchDocumentControlDraft(item.id, {
                        sharingPolicy: event.target.value as "Internal only" | "Client-share ready" | "Blocked",
                      })
                    }
                    className="w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-heritage-green"
                  >
                    <option value="Internal only">Internal only</option>
                    <option value="Client-share ready">Client-share ready</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <textarea
                  value={draft.reviewNote}
                  onChange={(event) => patchDocumentControlDraft(item.id, { reviewNote: event.target.value })}
                  placeholder="Review note, approval context, or filing evidence"
                  className="mt-3 min-h-20 w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() =>
                      onUpdateDocumentControl({
                        documentId: item.id,
                        documentStatus: draft.documentStatus,
                        reviewStatus: draft.reviewStatus,
                        accessLevel: draft.accessLevel,
                        sharingPolicy: draft.sharingPolicy,
                        versionLabel: draft.versionLabel,
                        reviewNote: draft.reviewNote,
                      })
                    }
                    disabled={documentBusyId === item.id || !canPersistMatterRoom}
                    className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-heritage-green hover:text-heritage-green disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {documentBusyId === item.id ? "Saving..." : canPersistMatterRoom ? "Apply control" : saveActionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Register matter document</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              value={documentTitleDraft}
              onChange={(event) => onDocumentTitleChange(event.target.value)}
              placeholder="Document title"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={documentTypeDraft}
              onChange={(event) => onDocumentTypeChange(event.target.value)}
              placeholder="Document type"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select
              value={documentStatusDraft}
              onChange={(event) => onDocumentStatusChange(event.target.value as "Draft" | "Final" | "Filed" | "Archived")}
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="Draft">Draft</option>
              <option value="Final">Final</option>
              <option value="Filed">Filed</option>
              <option value="Archived">Archived</option>
            </select>
            <select
              value={documentReviewStatusDraft}
              onChange={(event) =>
                onDocumentReviewStatusChange(
                  event.target.value as "Working" | "Internal review" | "Approved" | "Needs revision"
                )
              }
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="Working">Working</option>
              <option value="Internal review">Internal review</option>
              <option value="Approved">Approved</option>
              <option value="Needs revision">Needs revision</option>
            </select>
            <input
              value={documentVersionLabelDraft}
              onChange={(event) => onDocumentVersionLabelChange(event.target.value)}
              placeholder="Version label"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <select
              value={documentAccessLevelDraft}
              onChange={(event) => onDocumentAccessLevelChange(event.target.value as "Matter team" | "Lead+Partner")}
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="Matter team">Matter team</option>
              <option value="Lead+Partner">Lead+Partner</option>
            </select>
            <select
              value={documentSharingPolicyDraft}
              onChange={(event) =>
                onDocumentSharingPolicyChange(
                  event.target.value as "Internal only" | "Client-share ready" | "Blocked"
                )
              }
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="Internal only">Internal only</option>
              <option value="Client-share ready">Client-share ready</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
          <input
            value={documentPathDraft}
            onChange={(event) => onDocumentPathChange(event.target.value)}
            placeholder="Storage path or local vault route"
            className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <input
            value={documentOneDriveIdDraft}
            onChange={(event) => onDocumentOneDriveIdChange(event.target.value)}
            placeholder="OneDrive file ID if linked"
            className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <textarea
            value={documentSummaryDraft}
            onChange={(event) => onDocumentSummaryChange(event.target.value)}
            placeholder="AI summary or registration note"
            className="mt-3 min-h-24 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <textarea
            value={documentReviewNoteDraft}
            onChange={(event) => onDocumentReviewNoteChange(event.target.value)}
            placeholder="Review note or filing context"
            className="mt-3 min-h-20 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <label className="mt-3 flex items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={documentComplianceDraft}
              onChange={(event) => onDocumentComplianceChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Mark this document for compliance audit
          </label>
          <div className="mt-3 flex justify-end">
            <button
              onClick={onSubmitMatterDocument}
              disabled={isSubmitting === "document" || !documentTitleDraft.trim() || !canPersistMatterRoom}
              className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "document" ? "Saving..." : canPersistMatterRoom ? "Register document" : saveActionLabel}
            </button>
          </div>
          <div className="mt-4 rounded-[1rem] border border-dashed border-slate-300 bg-[#f8faf9] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Upload directly into matter vault</p>
            <input
              type="file"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-600"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {uploadFile
                  ? `${uploadFile.name} will be saved into the local matter vault and registered in the workspace.`
                  : "Choose a file to save it in the matter vault and register it automatically."}
              </p>
              <button
                onClick={() => {
                  if (!uploadFile) {
                    return;
                  }
                  onUploadMatterDocument(uploadFile);
                  setUploadFile(null);
                }}
                disabled={isSubmitting === "document-upload" || !uploadFile || !canPersistMatterRoom}
                className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition hover:border-heritage-green hover:text-heritage-green disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "document-upload" ? "Uploading..." : canPersistMatterRoom ? "Upload file" : saveActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Physical mirror</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Paper file registry</h3>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <InfoRow label="Primary jacket" value={`${matterRoom.physicalFile.label} / ${matterRoom.physicalFile.location}`} />
            <InfoRow label="Current custody" value={matterRoom.physicalFile.custodyStatus} />
            <InfoRow label="File code" value={matterRoom.physicalFile.fileCode} />
            <InfoRow label="QR payload" value={matterRoom.physicalFile.qrPayload ?? "QR payload not registered yet"} />
          </div>

          <div className="mt-5 grid gap-3">
            <input
              value={fileCodeDraft}
              onChange={(event) => onFileCodeChange(event.target.value)}
              placeholder="Physical file code"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={fileLabelDraft}
              onChange={(event) => onFileLabelChange(event.target.value)}
              placeholder="Physical file label"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={fileLocationDraft}
              onChange={(event) => onFileLocationChange(event.target.value)}
              placeholder="Storage location"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={fileCustodyDraft}
              onChange={(event) => onFileCustodyChange(event.target.value)}
              placeholder="Current custody state"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={fileQrDraft}
              onChange={(event) => onFileQrChange(event.target.value)}
              placeholder="QR payload or encoded route"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <div className="flex justify-end">
              <button
                onClick={onSubmitPhysicalFileUpdate}
                disabled={isSubmitting === "physical-file" || !canPersistMatterRoom}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "physical-file" ? "Saving..." : canPersistMatterRoom ? "Save registry" : saveActionLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Custody journal</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Track movement and responsibility</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <select
              value={custodyEventTypeDraft}
              onChange={(event) => onCustodyEventTypeChange(event.target.value as MatterRoomCustodyEvent["eventType"])}
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="checked_out">Checked out</option>
              <option value="checked_in">Checked in</option>
              <option value="relocated">Relocated</option>
              <option value="registered">Registered</option>
            </select>
            <input
              value={custodyEventLocationDraft}
              onChange={(event) => onCustodyEventLocationChange(event.target.value)}
              placeholder="Updated location"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              value={custodyEventStatusDraft}
              onChange={(event) => onCustodyEventStatusChange(event.target.value)}
              placeholder="Updated custody state"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <textarea
              value={custodyEventNoteDraft}
              onChange={(event) => onCustodyEventNoteChange(event.target.value)}
              placeholder="Explain the handoff, movement, or custody note"
              className="min-h-24 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <div className="flex justify-end">
              <button
                onClick={onSubmitCustodyEvent}
                disabled={isSubmitting === "custody" || !custodyEventNoteDraft.trim() || !canPersistMatterRoom}
                className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "custody" ? "Saving..." : canPersistMatterRoom ? "Record custody event" : saveActionLabel}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.custodyEvents.map((event) => (
              <div key={event.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{event.note}</p>
                  <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                    {event.eventType}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{event.actorName} • {event.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyPanel({ matter }: { matter: MatterWorkspaceData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <FileSearch className="h-5 w-5 text-heritage-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Research stack</p>
            <h3 className="mt-1 text-lg font-semibold text-heritage-green">Legal reasoning already captured</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {matter.researchNotes.map((note) => (
            <div key={note} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm leading-6 text-slate-700">
              {note}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-[#f7fbf9] p-5">
        <div className="flex items-center gap-3">
          <GanttChartSquare className="h-5 w-5 text-heritage-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Decision frame</p>
            <h3 className="mt-1 text-lg font-semibold text-heritage-green">Current strategy posture</h3>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <InfoRow label="Primary track" value={matter.primaryTrack} />
          <InfoRow label="Risk to monitor" value={matter.riskToMonitor} />
          <InfoRow label="AI usage rule" value={matter.aiUsageRule} />
          <InfoRow label="Next draft" value={matter.nextDraft} />
        </div>
      </div>
    </div>
  );
}

function CollaborationPanel({
  matter,
  matterRoom,
  matterOperations,
  memberDraft,
  commentDraft,
  chatMessageDraft,
  isSubmitting,
  notificationBusyId,
  canPersistMatterRoom,
  saveActionLabel,
  onMemberDraftChange,
  onCommentDraftChange,
  onChatMessageDraftChange,
  onSubmitMemberAssignment,
  onRemoveMember,
  onSubmitMatterComment,
  onSubmitMatterChatMessage,
  onMarkNotificationRead,
}: {
  matter: MatterWorkspaceData;
  matterRoom: MatterRoomData;
  matterOperations: MatterOperations;
  memberDraft: string;
  commentDraft: string;
  chatMessageDraft: string;
  isSubmitting: MatterSubmitState;
  notificationBusyId: string | null;
  canPersistMatterRoom: boolean;
  saveActionLabel: string;
  onMemberDraftChange: (value: string) => void;
  onCommentDraftChange: (value: string) => void;
  onChatMessageDraftChange: (value: string) => void;
  onSubmitMemberAssignment: () => void;
  onRemoveMember: (lawyerId: string) => void;
  onSubmitMatterComment: () => void;
  onSubmitMatterChatMessage: () => void;
  onMarkNotificationRead: (notificationId: string) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <MessageSquareText className="h-5 w-5 text-heritage-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matter feed</p>
            <h3 className="mt-1 text-lg font-semibold text-heritage-green">Persisted comments and handoff notes</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {matterRoom.comments.length ? (
            matterRoom.comments.map((item) => <CommentCard key={item.id} comment={item} />)
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
              No persisted comments yet for this matter.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add collaboration note</p>
          <textarea
            value={commentDraft}
            onChange={(event) => onCommentDraftChange(event.target.value)}
            placeholder="Record a handoff note, warning, or review comment for this matter..."
            className="mt-3 min-h-24 w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {matterRoom.source === "live"
                ? "Stored in matter_comments"
                : matterRoom.source === "prototype"
                  ? "Stored in local prototype matter room"
                  : "Seeded fallback cannot persist comments"}
            </p>
            <button
              onClick={onSubmitMatterComment}
              disabled={isSubmitting === "comment" || !commentDraft.trim() || !canPersistMatterRoom}
              className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "comment" ? "Saving..." : canPersistMatterRoom ? "Save note" : saveActionLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-[#0b211c] p-5 text-white">
          <div className="flex items-center gap-3">
            <BookMarked className="h-5 w-5 text-gold-accent" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Mentorship</p>
              <h3 className="mt-1 text-lg font-semibold">Knowledge transfer in the matter room</h3>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <InfoRowDark label="Junior pair" value={matter.mentorshipPair} />
            <InfoRowDark label="Training focus" value={matter.mentorshipFocus} />
            <InfoRowDark label="Review rhythm" value={matter.mentorshipRhythm} />
          </div>

          <div className="mt-6 rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Live matter thread</p>
            <p className="mt-2 text-sm font-semibold">
              {matterOperations.thread?.title ?? "Matter thread not yet persisted"}
            </p>
            <div className="mt-4 space-y-3">
              {matterOperations.thread?.messages.length ? (
                matterOperations.thread.messages.slice(-3).map((message) => (
                  <div key={message.id} className="rounded-[1rem] border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-white">{message.author}</p>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{message.role}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/72">{message.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-white/72">
                  Once chat persistence is live for this matter, the latest message will surface here.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3 rounded-[1rem] border border-white/10 bg-white/5 p-3">
              <textarea
                value={chatMessageDraft}
                onChange={(event) => onChatMessageDraftChange(event.target.value)}
                placeholder="Post a message to the matter thread..."
                className="min-h-24 w-full rounded-[0.9rem] border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-accent"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                  Visible to the matter team once posted
                </p>
                <button
                  onClick={onSubmitMatterChatMessage}
                  disabled={isSubmitting === "chat" || !chatMessageDraft.trim() || matterOperations.thread === null}
                  className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#0b211c] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting === "chat" ? "Posting..." : matterOperations.thread ? "Post message" : "No live thread"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matter membership</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Who is assigned here</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.teamMembers.map((member) => (
              <div key={member.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                      {member.isPrimary ? "Primary" : member.role}
                    </span>
                    {!member.isPrimary && canPersistMatterRoom && (
                      <button
                        onClick={() => onRemoveMember(member.id)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{member.focus}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Assign practitioner</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <select
                value={memberDraft}
                onChange={(event) => onMemberDraftChange(event.target.value)}
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                <option value="">Select practitioner</option>
                {matterRoom.assignableLawyers
                  .filter((lawyer) => !lawyer.alreadyAssigned)
                  .map((lawyer) => (
                    <option key={lawyer.id} value={lawyer.id}>
                      {lawyer.name} • {lawyer.role}
                    </option>
                  ))}
              </select>
              <button
                onClick={onSubmitMemberAssignment}
                disabled={isSubmitting === "member" || !memberDraft || !canPersistMatterRoom}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "member" ? "Assigning..." : canPersistMatterRoom ? "Assign member" : saveActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GovernancePanel({
  matter,
  matterRoom,
  matterOperations,
  securityProfile,
  securityClassificationDraft,
  ethicalWallEnabledDraft,
  accessOverrideLawyerIdDraft,
  accessOverrideStatusDraft,
  accessOverrideReasonDraft,
  guidanceSummaryDraft,
  nextActionDraft,
  memorySummaryDraft,
  memoryDecisionDraft,
  memoryUnresolvedDraft,
  isSubmitting,
  securityBusy,
  onGuidanceSummaryChange,
  onNextActionChange,
  onMemorySummaryChange,
  onMemoryDecisionChange,
  onMemoryUnresolvedChange,
  onSecurityClassificationChange,
  onEthicalWallEnabledChange,
  onAccessOverrideLawyerIdChange,
  onAccessOverrideStatusChange,
  onAccessOverrideReasonChange,
  onSubmitGuidanceRefresh,
  onSubmitMemoryCheckpoint,
  onSubmitSecurityProfile,
  onSubmitAccessOverride,
}: {
  matter: MatterWorkspaceData;
  matterRoom: MatterRoomData;
  matterOperations: MatterOperations;
  securityProfile: MatterSecurityProfile | null;
  securityClassificationDraft: "Standard" | "Confidential" | "Partner-only";
  ethicalWallEnabledDraft: boolean;
  accessOverrideLawyerIdDraft: string;
  accessOverrideStatusDraft: MatterAccessStatus;
  accessOverrideReasonDraft: string;
  guidanceSummaryDraft: string;
  nextActionDraft: string;
  memorySummaryDraft: string;
  memoryDecisionDraft: string;
  memoryUnresolvedDraft: string;
  isSubmitting: MatterSubmitState;
  securityBusy: boolean;
  onGuidanceSummaryChange: (value: string) => void;
  onNextActionChange: (value: string) => void;
  onMemorySummaryChange: (value: string) => void;
  onMemoryDecisionChange: (value: string) => void;
  onMemoryUnresolvedChange: (value: string) => void;
  onSecurityClassificationChange: (value: "Standard" | "Confidential" | "Partner-only") => void;
  onEthicalWallEnabledChange: (value: boolean) => void;
  onAccessOverrideLawyerIdChange: (value: string) => void;
  onAccessOverrideStatusChange: (value: MatterAccessStatus) => void;
  onAccessOverrideReasonChange: (value: string) => void;
  onSubmitGuidanceRefresh: () => void;
  onSubmitMemoryCheckpoint: () => void;
  onSubmitSecurityProfile: () => void;
  onSubmitAccessOverride: () => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Digital charter</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Governance and confidentiality checks</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matter.governanceChecks.map((check) => (
              <div key={check} className="flex items-start gap-3 rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                <p className="text-sm leading-6 text-slate-700">{check}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Matter security model</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={securityClassificationDraft}
                onChange={(event) =>
                  onSecurityClassificationChange(event.target.value as "Standard" | "Confidential" | "Partner-only")
                }
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                <option value="Standard">Standard</option>
                <option value="Confidential">Confidential</option>
                <option value="Partner-only">Partner-only</option>
              </select>
              <label className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={ethicalWallEnabledDraft}
                  onChange={(event) => onEthicalWallEnabledChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Ethical wall enabled
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={onSubmitSecurityProfile}
                disabled={securityBusy}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {securityBusy ? "Saving..." : "Save security profile"}
              </button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-500">
              <p>Current profile: {securityProfile?.securityClassification ?? matter.securityClassification}</p>
              <p>Ethical wall: {(securityProfile?.ethicalWallEnabled ?? matter.ethicalWallEnabled) ? "Enabled" : "Disabled"}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-[#f9fbfa] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Access overrides</p>
            <div className="mt-3 space-y-3">
              {(securityProfile?.accessOverrides ?? []).length ? (
                (securityProfile?.accessOverrides ?? []).map((override) => (
                  <div key={`${override.lawyerId}-${override.accessStatus}`} className="rounded-[1rem] border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{override.lawyerName}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                        {override.accessStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{override.lawyerRole}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{override.reason ?? "No reason recorded."}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                  No explicit screened or allowed lawyers recorded yet.
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              <select
                value={accessOverrideLawyerIdDraft}
                onChange={(event) => onAccessOverrideLawyerIdChange(event.target.value)}
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                <option value="">Select lawyer</option>
                {matterRoom.assignableLawyers.map((lawyer) => (
                  <option key={lawyer.id} value={lawyer.id}>
                    {lawyer.name} • {lawyer.role}
                  </option>
                ))}
              </select>
              <select
                value={accessOverrideStatusDraft}
                onChange={(event) => onAccessOverrideStatusChange(event.target.value as MatterAccessStatus)}
                className="w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              >
                <option value="screened">Screened</option>
                <option value="allowed">Allowed</option>
              </select>
              <textarea
                value={accessOverrideReasonDraft}
                onChange={(event) => onAccessOverrideReasonChange(event.target.value)}
                placeholder="Reason for this override"
                className="min-h-20 w-full rounded-[1rem] border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-heritage-green"
              />
              <div className="flex justify-end">
                <button
                  onClick={onSubmitAccessOverride}
                  disabled={securityBusy || !accessOverrideLawyerIdDraft}
                  className="rounded-full border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {securityBusy ? "Saving..." : "Record override"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Audit trail</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Recent operational events</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.auditTrail.length ? (
              matterRoom.auditTrail.map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {item.actionType}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.actorName} • {item.createdAt}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                No audit rows have been surfaced for this matter yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-[#f7fbf9] p-5">
        <div className="flex items-center gap-3">
          <ScrollText className="h-5 w-5 text-heritage-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Operational policy</p>
            <h3 className="mt-1 text-lg font-semibold text-heritage-green">Cabinet rules for this matter</h3>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <InfoRow label="Approved tools" value={matter.approvedTools} />
          <InfoRow label="Escalation trigger" value={matter.escalationTrigger} />
          <InfoRow label="Training owner" value={matter.trainingOwner} />
          <InfoRow label="Review forum" value={matter.reviewForum} />
        </div>

        <div className="mt-6 space-y-3">
          <OpsInline
            icon={Sparkles}
            label="Client guidance"
            value={matterOperations.guidance?.guidanceSummary ?? "No matter-specific guidance profile yet"}
          />
          <OpsInline
            icon={CircleAlert}
            label="Next action"
            value={matterOperations.guidance?.nextAction ?? "No client communications action scheduled yet"}
          />
          <OpsInline
            icon={MemoryStick}
            label="Key decision"
            value={matterOperations.memory?.keyDecision ?? "No strategic recall snapshot stored yet"}
          />
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Guidance refresh</p>
          <textarea
            value={guidanceSummaryDraft}
            onChange={(event) => onGuidanceSummaryChange(event.target.value)}
            placeholder="Refine the client communication guidance for this matter..."
            className="mt-3 min-h-24 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <input
            value={nextActionDraft}
            onChange={(event) => onNextActionChange(event.target.value)}
            placeholder="Next client-facing action"
            className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={onSubmitGuidanceRefresh}
              disabled={isSubmitting === "guidance" || !guidanceSummaryDraft.trim() || !nextActionDraft.trim()}
              className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "guidance" ? "Saving..." : "Refresh guidance"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Memory checkpoint</p>
          <textarea
            value={memorySummaryDraft}
            onChange={(event) => onMemorySummaryChange(event.target.value)}
            placeholder="Summarize the current matter state for future recall..."
            className="mt-3 min-h-24 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <input
            value={memoryDecisionDraft}
            onChange={(event) => onMemoryDecisionChange(event.target.value)}
            placeholder="Key decision taken"
            className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <input
            value={memoryUnresolvedDraft}
            onChange={(event) => onMemoryUnresolvedChange(event.target.value)}
            placeholder="Unresolved items, comma separated"
            className="mt-3 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={onSubmitMemoryCheckpoint}
              disabled={isSubmitting === "memory" || !memorySummaryDraft.trim() || !memoryDecisionDraft.trim()}
              className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "memory" ? "Saving..." : "Capture checkpoint"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinancePanel({
  matterRoom,
  invoiceAmountDraft,
  invoiceDueDateDraft,
  invoiceStatusDraft,
  invoiceBusyId,
  isSubmitting,
  canPersistMatterRoom,
  saveActionLabel,
  onInvoiceAmountChange,
  onInvoiceDueDateChange,
  onInvoiceStatusChange,
  onSubmitMatterInvoice,
  onUpdateInvoiceStatus,
}: {
  matterRoom: MatterRoomData;
  invoiceAmountDraft: string;
  invoiceDueDateDraft: string;
  invoiceStatusDraft: MatterInvoice["status"];
  invoiceBusyId: string | null;
  isSubmitting: MatterSubmitState;
  canPersistMatterRoom: boolean;
  saveActionLabel: string;
  onInvoiceAmountChange: (value: string) => void;
  onInvoiceDueDateChange: (value: string) => void;
  onInvoiceStatusChange: (value: MatterInvoice["status"]) => void;
  onSubmitMatterInvoice: () => void;
  onUpdateInvoiceStatus: (invoiceId: string, status: MatterInvoice["status"]) => void;
}) {
  const totalRaised = matterRoom.invoices.reduce((sum, invoice) => sum + invoice.amountXaf, 0);
  const paidTotal = matterRoom.invoices
    .filter((invoice) => invoice.status === "Paid")
    .reduce((sum, invoice) => sum + invoice.amountXaf, 0);
  const outstandingTotal = matterRoom.invoices
    .filter((invoice) => invoice.status !== "Paid")
    .reduce((sum, invoice) => sum + invoice.amountXaf, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile icon={Receipt} label="Invoices" value={`${matterRoom.invoices.length} recorded`} />
          <StatTile icon={Wallet} label="Raised" value={formatXafCurrency(totalRaised)} />
          <StatTile icon={CircleAlert} label="Outstanding" value={formatXafCurrency(outstandingTotal)} />
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matter billing ledger</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Track real invoice state inside the matter</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matterRoom.invoices.length ? (
              matterRoom.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {invoice.id.slice(0, 8)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${invoiceStatusClasses[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">{formatXafCurrency(invoice.amountXaf)}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Due {invoice.dueDate ?? "not scheduled"} • Created {invoice.createdAt}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 md:min-w-40">
                      <select
                        value={invoice.status}
                        onChange={(event) => onUpdateInvoiceStatus(invoice.id, event.target.value as MatterInvoice["status"])}
                        disabled={invoiceBusyId === invoice.id}
                        className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-heritage-green disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {invoiceBusyId === invoice.id ? "Saving status..." : "Status control"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-[#fcfcfb] p-4 text-sm text-slate-500">
                No invoices have been registered for this matter yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(160deg,_#ffffff_0%,_#f5faf8_100%)] p-5">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-heritage-green" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Finance snapshot</p>
              <h3 className="mt-1 text-lg font-semibold text-heritage-green">Revenue visibility for the current matter</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <OpsTile
              icon={Receipt}
              label="Collected"
              value={formatXafCurrency(paidTotal)}
              hint="Sum of invoices already marked as paid in the matter ledger."
            />
            <OpsTile
              icon={CircleAlert}
              label="Pending"
              value={formatXafCurrency(outstandingTotal)}
              hint="Invoices still in draft, sent, partial, or overdue states."
            />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Create invoice</p>
          <div className="mt-4 grid gap-3">
            <input
              type="number"
              min="0"
              step="1000"
              value={invoiceAmountDraft}
              onChange={(event) => onInvoiceAmountChange(event.target.value)}
              placeholder="Amount (XAF)"
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <input
              type="date"
              value={invoiceDueDateDraft}
              onChange={(event) => onInvoiceDueDateChange(event.target.value)}
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            />
            <select
              value={invoiceStatusDraft}
              onChange={(event) => onInvoiceStatusChange(event.target.value as MatterInvoice["status"])}
              className="w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
            <div className="flex justify-end">
              <button
                onClick={onSubmitMatterInvoice}
                disabled={isSubmitting === "invoice" || !invoiceAmountDraft.trim() || !canPersistMatterRoom}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "invoice" ? "Saving..." : canPersistMatterRoom ? "Create invoice" : saveActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type MatterOperations = {
  notifications: OperationalDashboard["notifications"];
  clientUpdates: OperationalDashboard["clientUpdates"];
  thread: OperationalDashboard["chatThreads"][number] | null;
  guidance: OperationalDashboard["guidanceProfiles"][number] | null;
  memory: OperationalDashboard["memorySnapshots"][number] | null;
};

function CommentCard({ comment }: { comment: MatterRoomComment }) {
  const badgeClasses: Record<MatterRoomComment["commentType"], string> = {
    note: "bg-slate-100 text-slate-600",
    ai: "bg-sky-50 text-sky-700",
    approval: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {comment.role} • {comment.createdAt}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${badgeClasses[comment.commentType]}`}>
          {comment.commentType}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{comment.body}</p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-heritage-green" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{value}</p>
    </div>
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

function InfoRowDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/72">{value}</p>
    </div>
  );
}

function OpsTile({
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
    <div className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-heritage-green" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function OpsInline({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-heritage-green">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

const invoiceStatusClasses: Record<MatterInvoice["status"], string> = {
  Draft: "bg-slate-100 text-slate-600",
  Sent: "bg-sky-50 text-sky-700",
  Partial: "bg-amber-50 text-amber-700",
  Paid: "bg-emerald-50 text-emerald-700",
  Overdue: "bg-rose-50 text-rose-700",
};

function formatXafCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value);
}
