import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertMatterPermission, type PermissionKey } from "@/lib/authorization";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import {
  assignMatterMember,
  createCasePreparationItem,
  createComplianceChecklistItem,
  createCouncilRegisterEntry,
  createDigitalCaseFile,
  createDocumentTemplate,
  createMatterInvoice,
  createMatterDocument,
  createCustodyEvent,
  createJurisprudenceEntry,
  createKnowledgeEntry,
  createMatterComment,
  createMatterTask,
  archivePersonalizedDraft,
  generatePersonalizedMatterDraft,
  getMatterRoomById,
  removeMatterMember,
  upsertMatterCaseField,
  updateMatterDocumentControl,
  updateComplianceChecklistItemStatus,
  updateMatterInvoiceStatus,
  upsertPhysicalFile,
  updateMatterTaskStatus,
} from "@/lib/matter-room";
import {
  getMatterSecurityProfile,
  updateMatterSecurityProfile,
  upsertMatterAccessOverride,
} from "@/lib/matter-security";
import { calculateMatterDeadline } from "@/lib/deadlines";
import type { MatterRoomData } from "@/lib/matter-room";
import type { RequestScope } from "@/lib/request-scope";

function filterRoomForScope(scope: RequestScope, room: MatterRoomData | null) {
  if (!room) {
    return room;
  }

  const isPartner = scope.actorRole === "Partner";
  const isLeadLawyer = scope.actorName.trim().toLowerCase() === room.matter.leadLawyer.trim().toLowerCase();

  if (isPartner || isLeadLawyer) {
    return room;
  }

  return {
    ...room,
    documents: room.documents.filter((document) => document.accessLevel !== "Lead+Partner"),
  };
}

function roomResponse(scope: RequestScope, room: MatterRoomData | null, extras?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    room: filterRoomForScope(scope, room),
    ...extras,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    const [room, security] = await Promise.all([getMatterRoomById(matterId), getMatterSecurityProfile(matterId)]);

    if (!room) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }

    return NextResponse.json({ room: filterRoomForScope(scope, room), security });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load matter room." },
      { status: statusForApiError(error) }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    const body = await request.json();

    const permissionByAction: Record<string, PermissionKey | null> = {
      createComment: null,
      createTask: "assignWork",
      updateTaskStatus: "assignWork",
      upsertPhysicalFile: "manageEvidence",
      createCustodyEvent: "manageEvidence",
      assignMember: "assignWork",
      removeMember: "assignWork",
      createDocument: "manageEvidence",
      updateDocumentControl: "manageEvidence",
      createCasePreparation: "manageEvidence",
      createJurisprudenceEntry: "manageEvidence",
      createCouncilRegisterEntry: "manageEvidence",
      createComplianceChecklistItem: "manageEvidence",
      updateComplianceChecklistItemStatus: "manageEvidence",
      createKnowledgeEntry: "manageEvidence",
      upsertCaseField: "manageEvidence",
      createDigitalCaseFile: "manageEvidence",
      createInvoice: "viewBilling",
      updateInvoiceStatus: "viewBilling",
      createDocumentTemplate: "manageEvidence",
      generatePersonalizedDraft: "manageEvidence",
      archivePersonalizedDraft: "manageEvidence",
      calculateDeadline: "editDeadlines",
      updateSecurityProfile: "approveFilings",
      upsertAccessOverride: "approveFilings",
    };

    const requiredPermission = permissionByAction[body.action];

    if (!(body.action in permissionByAction)) {
      return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }

    await assertMatterPermission({
      scope,
      matterId,
      permission: requiredPermission ?? undefined,
      allowAnyMember: requiredPermission === null,
    });

    switch (body.action) {
      case "createComment": {
        const room = await createMatterComment({
          matterId,
          authorId: body.authorId,
          body: body.body,
          commentType: body.commentType,
        });
        return roomResponse(scope, room);
      }
      case "createTask": {
        const room = await createMatterTask({
          matterId,
          title: body.title,
          description: body.description,
          deadline: body.deadline,
          assignedTo: body.assignedTo,
        });
        return roomResponse(scope, room);
      }
      case "updateTaskStatus": {
        const room = await updateMatterTaskStatus({
          matterId,
          taskId: body.taskId,
          status: body.status,
        });
        return roomResponse(scope, room);
      }
      case "upsertPhysicalFile": {
        const room = await upsertPhysicalFile({
          matterId,
          fileCode: body.fileCode,
          label: body.label,
          location: body.location,
          custodyStatus: body.custodyStatus,
          qrPayload: body.qrPayload,
        });
        return roomResponse(scope, room);
      }
      case "createCustodyEvent": {
        const room = await createCustodyEvent({
          matterId,
          eventType: body.eventType,
          note: body.note,
          custodyStatus: body.custodyStatus,
          location: body.location,
        });
        return roomResponse(scope, room);
      }
      case "assignMember": {
        const room = await assignMatterMember({
          matterId,
          lawyerId: body.lawyerId,
          firmRoleId: body.firmRoleId,
          isPrimary: body.isPrimary,
        });
        return roomResponse(scope, room);
      }
      case "removeMember": {
        const room = await removeMatterMember({
          matterId,
          lawyerId: body.lawyerId,
        });
        return roomResponse(scope, room);
      }
      case "createDocument": {
        const room = await createMatterDocument({
          matterId,
          title: body.title,
          documentType: body.documentType,
          documentStatus: body.documentStatus,
          reviewStatus: body.reviewStatus,
          accessLevel: body.accessLevel,
          sharingPolicy: body.sharingPolicy,
          versionLabel: body.versionLabel,
          storagePath: body.storagePath,
          oneDriveFileId: body.oneDriveFileId,
          aiSummary: body.aiSummary,
          requiresComplianceAudit: body.requiresComplianceAudit,
          reviewNote: body.reviewNote,
        });
        return roomResponse(scope, room);
      }
      case "updateDocumentControl": {
        const room = await updateMatterDocumentControl({
          matterId,
          documentId: body.documentId,
          documentStatus: body.documentStatus,
          reviewStatus: body.reviewStatus,
          accessLevel: body.accessLevel,
          sharingPolicy: body.sharingPolicy,
          versionLabel: body.versionLabel,
          reviewNote: body.reviewNote,
        });
        return roomResponse(scope, room);
      }
      case "createCasePreparation": {
        const room = await createCasePreparationItem({
          matterId,
          preparationType: body.preparationType,
          title: body.title,
          ownerName: body.ownerName,
          dueDate: body.dueDate,
          status: body.status,
          notes: body.notes,
        });
        return roomResponse(scope, room);
      }
      case "createJurisprudenceEntry": {
        const room = await createJurisprudenceEntry({
          matterId,
          title: body.title,
          forum: body.forum,
          jurisdiction: body.jurisdiction,
          decisionDate: body.decisionDate,
          legalTopics: body.legalTopics,
          holdingSummary: body.holdingSummary,
          citation: body.citation,
          sourceType: body.sourceType,
          sourceUrl: body.sourceUrl,
          relevanceLabel: body.relevanceLabel,
        });
        return roomResponse(scope, room);
      }
      case "createCouncilRegisterEntry": {
        const room = await createCouncilRegisterEntry({
          matterId,
          bodyName: body.bodyName,
          registerType: body.registerType,
          referenceCode: body.referenceCode,
          jurisdiction: body.jurisdiction,
          status: body.status,
          filingDate: body.filingDate,
          followUpDate: body.followUpDate,
          historyNote: body.historyNote,
        });
        return roomResponse(scope, room);
      }
      case "createComplianceChecklistItem": {
        const room = await createComplianceChecklistItem({
          matterId,
          checklistTitle: body.checklistTitle,
          checklistType: body.checklistType,
          label: body.label,
          ownerName: body.ownerName,
          dueDate: body.dueDate,
          status: body.status,
          evidenceNote: body.evidenceNote,
        });
        return roomResponse(scope, room);
      }
      case "updateComplianceChecklistItemStatus": {
        const room = await updateComplianceChecklistItemStatus({
          matterId,
          checklistItemId: body.checklistItemId,
          status: body.status,
        });
        return roomResponse(scope, room);
      }
      case "createKnowledgeEntry": {
        const room = await createKnowledgeEntry({
          matterId,
          title: body.title,
          entryType: body.entryType,
          tags: body.tags,
          summary: body.summary,
          storagePath: body.storagePath,
          sensitivity: body.sensitivity,
        });
        return roomResponse(scope, room);
      }
      case "upsertCaseField": {
        const room = await upsertMatterCaseField({
          matterId,
          fieldKey: body.fieldKey,
          fieldLabel: body.fieldLabel,
          fieldValue: body.fieldValue,
          fieldGroup: body.fieldGroup,
        });
        return roomResponse(scope, room);
      }
      case "createDigitalCaseFile": {
        const room = await createDigitalCaseFile({
          matterId,
          fileLabel: body.fileLabel,
          fileCategory: body.fileCategory,
          storagePath: body.storagePath,
          storageProvider: body.storageProvider,
          referenceCode: body.referenceCode,
          versionLabel: body.versionLabel,
          status: body.status,
        });
        return roomResponse(scope, room);
      }
      case "createInvoice": {
        const room = await createMatterInvoice({
          matterId,
          amountXaf: Number(body.amountXaf),
          dueDate: body.dueDate,
          status: body.status,
        });
        return roomResponse(scope, room);
      }
      case "updateInvoiceStatus": {
        const room = await updateMatterInvoiceStatus({
          matterId,
          invoiceId: body.invoiceId,
          status: body.status,
        });
        return roomResponse(scope, room);
      }
      case "createDocumentTemplate": {
        const room = await createDocumentTemplate({
          matterId,
          title: body.title,
          practiceArea: body.practiceArea,
          jurisdiction: body.jurisdiction,
          language: body.language,
          templateBody: body.templateBody,
          preservedFormNote: body.preservedFormNote,
        });
        return roomResponse(scope, room);
      }
      case "generatePersonalizedDraft": {
        const payload = await generatePersonalizedMatterDraft({
          matterId,
          templateId: body.templateId,
          title: body.title,
          contextNote: body.contextNote,
        });
        return roomResponse(scope, payload.room, { draft: payload.draft });
      }
      case "archivePersonalizedDraft": {
        const room = await archivePersonalizedDraft({
          matterId,
          title: body.title,
          outputText: body.outputText,
          contextNote: body.contextNote,
          storagePath: body.storagePath,
          oneDriveFileId: body.oneDriveFileId,
        });
        return roomResponse(scope, room);
      }
      case "updateSecurityProfile": {
        const security = await updateMatterSecurityProfile({
          matterId,
          securityClassification: body.securityClassification,
          ethicalWallEnabled: Boolean(body.ethicalWallEnabled),
        });
        const room = await getMatterRoomById(matterId);
        return roomResponse(scope, room, { security });
      }
      case "upsertAccessOverride": {
        const security = await upsertMatterAccessOverride({
          matterId,
          lawyerId: body.lawyerId,
          accessStatus: body.accessStatus,
          reason: body.reason,
        });
        const room = await getMatterRoomById(matterId);
        return roomResponse(scope, room, { security });
      }
      case "calculateDeadline": {
        const preview = calculateMatterDeadline({
          ruleKey: body.ruleKey,
          startDate: body.startDate,
        });
        return NextResponse.json({ success: true, preview });
      }
      default:
        return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[API Matter Room Route] Error processing request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process matter room request.",
      },
      { status: statusForApiError(error) }
    );
  }
}
