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
  ScrollText,
  Shield,
  Sparkles,
  Users,
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
  MatterRoomTask,
} from "@/lib/matter-room";
import type { OperationalDashboard } from "@/lib/operations";

export type WorkspaceTab = "overview" | "documents" | "strategy" | "studio" | "intelligence" | "collaboration" | "governance";
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
  | "member"
  | "physical-file"
  | "custody";

const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "strategy", label: "Strategy" },
  { id: "studio", label: "Case File" },
  { id: "intelligence", label: "Intelligence" },
  { id: "collaboration", label: "Collaboration" },
  { id: "governance", label: "Governance" },
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
      storagePath: "Matter vault path pending live registry",
      oneDriveFileId: null,
      syncStatus: "Local only",
      aiSummary: item.state,
      requiresComplianceAudit: item.type === "Compliance",
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
  const [documentPathDraft, setDocumentPathDraft] = useState("");
  const [documentOneDriveIdDraft, setDocumentOneDriveIdDraft] = useState("");
  const [documentSummaryDraft, setDocumentSummaryDraft] = useState("");
  const [documentComplianceDraft, setDocumentComplianceDraft] = useState(false);
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
          const roomPayload = (await roomResponse.json()) as { room?: MatterRoomData };
          if (roomPayload.room) {
            startTransition(() => {
              setRoom(roomPayload.room!);
              setTaskAssigneeDraft(roomPayload.room!.teamMembers[0]?.id ?? "");
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

  const matterOperations = useMemo(() => {
    const notifications = (dashboard?.notifications ?? []).filter((item) => item.matterId === matter.id);
    const thread = (dashboard?.chatThreads ?? []).find((item) => item.matterId === matter.id) ?? null;
    const guidance = (dashboard?.guidanceProfiles ?? []).find((item) => item.matterId === matter.id) ?? null;
    const memory = (dashboard?.memorySnapshots ?? []).find((item) => item.matterId === matter.id) ?? null;

    return {
      notifications,
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
          action: "dispatchClientUpdate",
          matterId: matter.id,
          channel: matterOperations.guidance?.preferredChannel ?? "Email",
          title: `${matter.clientName} progress update`,
          message: clientUpdate.trim(),
          actionLabel: "Open matter",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to dispatch client update");
      }

      const payload = (await response.json()) as {
        delivery?: { note?: string; delivered?: boolean; recipient?: string | null };
      };
      setClientUpdate("");
      setRoomNotice(
        payload.delivery?.note ??
          (payload.delivery?.delivered
            ? "Client update sent successfully."
            : "Client update recorded, but delivery still needs configuration.")
      );
      await refreshOperations();
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to dispatch the client update.");
    } finally {
      setIsSubmitting(null);
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

    setIsSubmitting("member");
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
          storagePath: documentPathDraft.trim() || null,
          oneDriveFileId: documentOneDriveIdDraft.trim() || null,
          aiSummary: documentSummaryDraft.trim() || null,
          requiresComplianceAudit: documentComplianceDraft,
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
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Unable to register the document.");
    } finally {
      setIsSubmitting(null);
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
                  matterRoom.source === "live"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {matterRoom.source === "live" ? "Live room data" : "Fallback room data"}
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
              onClientUpdateChange={setClientUpdate}
              onTaskTitleChange={setTaskTitleDraft}
              onTaskDescriptionChange={setTaskDescriptionDraft}
              onTaskDeadlineChange={setTaskDeadlineDraft}
              onTaskAssigneeChange={setTaskAssigneeDraft}
              onDeadlineRuleChange={setDeadlineRuleDraft}
              onDeadlineStartChange={setDeadlineStartDraft}
              onSubmitClientUpdate={() => void submitClientUpdate()}
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
              onDocumentTitleChange={setDocumentTitleDraft}
              onDocumentTypeChange={setDocumentTypeDraft}
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
              guidanceSummaryDraft={guidanceSummaryDraft}
              nextActionDraft={nextActionDraft}
              memorySummaryDraft={memorySummaryDraft}
              memoryDecisionDraft={memoryDecisionDraft}
              memoryUnresolvedDraft={memoryUnresolvedDraft}
              isSubmitting={isSubmitting}
              onGuidanceSummaryChange={setGuidanceSummaryDraft}
              onNextActionChange={setNextActionDraft}
              onMemorySummaryChange={setMemorySummaryDraft}
              onMemoryDecisionChange={setMemoryDecisionDraft}
              onMemoryUnresolvedChange={setMemoryUnresolvedDraft}
              onSubmitGuidanceRefresh={() => void submitGuidanceRefresh()}
              onSubmitMemoryCheckpoint={() => void submitMemoryCheckpoint()}
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
  onClientUpdateChange,
  onTaskTitleChange,
  onTaskDescriptionChange,
  onTaskDeadlineChange,
  onTaskAssigneeChange,
  onDeadlineRuleChange,
  onDeadlineStartChange,
  onSubmitClientUpdate,
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
  onClientUpdateChange: (value: string) => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onTaskDeadlineChange: (value: string) => void;
  onTaskAssigneeChange: (value: string) => void;
  onDeadlineRuleChange: (value: string) => void;
  onDeadlineStartChange: (value: string) => void;
  onSubmitClientUpdate: () => void;
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
                disabled={isSubmitting === "task" || !taskTitleDraft.trim() || matterRoom.source !== "live"}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "task" ? "Saving..." : matterRoom.source === "live" ? "Create task" : "Live backend required"}
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
                {isSubmitting === "client-update" ? "Sending..." : "Send update"}
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
  onDocumentTitleChange,
  onDocumentTypeChange,
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
  onSubmitPhysicalFileUpdate,
  onSubmitCustodyEvent,
}: {
  matterRoom: MatterRoomData;
  documentTitleDraft: string;
  documentTypeDraft: string;
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
  onDocumentTitleChange: (value: string) => void;
  onDocumentTypeChange: (value: string) => void;
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
  onSubmitPhysicalFileUpdate: () => void;
  onSubmitCustodyEvent: () => void;
}) {
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
              disabled={isSubmitting === "document" || !documentTitleDraft.trim() || matterRoom.source !== "live"}
              className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "document" ? "Saving..." : matterRoom.source === "live" ? "Register document" : "Live backend required"}
            </button>
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
                disabled={isSubmitting === "physical-file" || matterRoom.source !== "live"}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "physical-file" ? "Saving..." : matterRoom.source === "live" ? "Save registry" : "Live backend required"}
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
                disabled={isSubmitting === "custody" || !custodyEventNoteDraft.trim() || matterRoom.source !== "live"}
                className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "custody" ? "Saving..." : matterRoom.source === "live" ? "Record custody event" : "Live backend required"}
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
                : "Fallback mode cannot persist comments"}
            </p>
            <button
              onClick={onSubmitMatterComment}
              disabled={isSubmitting === "comment" || !commentDraft.trim() || matterRoom.source !== "live"}
              className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting === "comment" ? "Saving..." : matterRoom.source === "live" ? "Save note" : "Live backend required"}
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
                    {!member.isPrimary && matterRoom.source === "live" && (
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
                disabled={isSubmitting === "member" || !memberDraft || matterRoom.source !== "live"}
                className="rounded-full bg-[#082921] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting === "member" ? "Assigning..." : matterRoom.source === "live" ? "Assign member" : "Live backend required"}
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
  guidanceSummaryDraft,
  nextActionDraft,
  memorySummaryDraft,
  memoryDecisionDraft,
  memoryUnresolvedDraft,
  isSubmitting,
  onGuidanceSummaryChange,
  onNextActionChange,
  onMemorySummaryChange,
  onMemoryDecisionChange,
  onMemoryUnresolvedChange,
  onSubmitGuidanceRefresh,
  onSubmitMemoryCheckpoint,
}: {
  matter: MatterWorkspaceData;
  matterRoom: MatterRoomData;
  matterOperations: MatterOperations;
  guidanceSummaryDraft: string;
  nextActionDraft: string;
  memorySummaryDraft: string;
  memoryDecisionDraft: string;
  memoryUnresolvedDraft: string;
  isSubmitting: MatterSubmitState;
  onGuidanceSummaryChange: (value: string) => void;
  onNextActionChange: (value: string) => void;
  onMemorySummaryChange: (value: string) => void;
  onMemoryDecisionChange: (value: string) => void;
  onMemoryUnresolvedChange: (value: string) => void;
  onSubmitGuidanceRefresh: () => void;
  onSubmitMemoryCheckpoint: () => void;
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

type MatterOperations = {
  notifications: OperationalDashboard["notifications"];
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
