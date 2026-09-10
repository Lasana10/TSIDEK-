import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertMatterPermission } from "@/lib/authorization";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { enqueueClientUpdateDelivery } from "@/lib/outbox.server";
import {
  createMatterObligation,
  decideMatterApproval,
  draftMatterCommunication,
  listMatterControls,
  registerLegalDocument,
  requestMatterApproval,
  transitionLegalDocument,
  transitionMatterCommunication,
  updateMatterObligationStatus,
} from "@/lib/matter-controls.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    return NextResponse.json({
      success: true,
      controls: await listMatterControls(matterId, scope),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load matter controls." },
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
    const action = String(body.action ?? "");

    if (action === "createObligation" || action === "updateObligationStatus") {
      await assertMatterPermission({ scope, matterId, permission: "editDeadlines" });
    } else if (
      action === "decideApproval" ||
      action === "approveDocument" ||
      action === "issueDocument" ||
      action === "fileDocument" ||
      action === "sendDocument" ||
      action === "approveCommunication" ||
      action === "queueCommunicationDelivery" ||
      action === "markCommunicationSent"
    ) {
      await assertMatterPermission({ scope, matterId, permission: "approveFilings" });
    } else {
      await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });
    }

    if (action === "createObligation") {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ success: false, error: "Obligation title is required." }, { status: 400 });
      return NextResponse.json({
        success: true,
        obligation: await createMatterObligation({
          matterId,
          scope,
          title,
          obligationType: String(body.obligationType ?? "deadline"),
          sourceType: body.sourceType ? String(body.sourceType) : null,
          sourceReference: body.sourceReference ? String(body.sourceReference) : null,
          legalBasis: body.legalBasis ? String(body.legalBasis) : null,
          dueAt: body.dueAt ? String(body.dueAt) : null,
          responsibleLawyerId: body.responsibleLawyerId ? String(body.responsibleLawyerId) : null,
          consequence: body.consequence ? String(body.consequence) : null,
        }),
      }, { status: 201 });
    }

    if (action === "updateObligationStatus") {
      return NextResponse.json({
        success: true,
        obligation: await updateMatterObligationStatus({
          matterId,
          scope,
          obligationId: String(body.obligationId),
          status: body.status,
          completionEvidence: typeof body.completionEvidence === "object" && body.completionEvidence ? body.completionEvidence : {},
        }),
      });
    }

    if (action === "registerDocument") {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ success: false, error: "Document title is required." }, { status: 400 });
      return NextResponse.json({
        success: true,
        document: await registerLegalDocument({
          matterId,
          scope,
          title,
          documentType: body.documentType ? String(body.documentType) : null,
          existingDocumentId: body.existingDocumentId ? String(body.existingDocumentId) : null,
          externalFileId: body.externalFileId ? String(body.externalFileId) : null,
          securityClassification: body.securityClassification ? String(body.securityClassification) : "Standard",
          clientVisible: Boolean(body.clientVisible),
          provenance: typeof body.provenance === "object" && body.provenance ? body.provenance : {},
        }),
      }, { status: 201 });
    }

    if (["reviewDocument","approveDocument","issueDocument","fileDocument","sendDocument","archiveDocument"].includes(action)) {
      const map: Record<string, "IN_REVIEW" | "APPROVED" | "ISSUED" | "FILED" | "SENT" | "ARCHIVED"> = {
        reviewDocument: "IN_REVIEW",
        approveDocument: "APPROVED",
        issueDocument: "ISSUED",
        fileDocument: "FILED",
        sendDocument: "SENT",
        archiveDocument: "ARCHIVED",
      };
      return NextResponse.json({
        success: true,
        document: await transitionLegalDocument({
          matterId,
          scope,
          documentId: String(body.documentId),
          lifecycleState: map[action],
        }),
      });
    }

    if (action === "requestApproval") {
      return NextResponse.json({
        success: true,
        approval: await requestMatterApproval({
          matterId,
          scope,
          approvalType: String(body.approvalType ?? "Legal work product"),
          subjectType: String(body.subjectType ?? "document"),
          subjectId: String(body.subjectId ?? ""),
        }),
      }, { status: 201 });
    }

    if (action === "decideApproval") {
      return NextResponse.json({
        success: true,
        approval: await decideMatterApproval({
          matterId,
          scope,
          approvalId: String(body.approvalId),
          status: body.status,
          reason: body.reason ? String(body.reason) : null,
        }),
      });
    }

    if (action === "draftCommunication") {
      return NextResponse.json({
        success: true,
        communication: await draftMatterCommunication({
          matterId,
          scope,
          channel: String(body.channel ?? "email"),
          direction: body.direction === "INBOUND" ? "INBOUND" : "OUTBOUND",
          subject: body.subject ? String(body.subject) : null,
          recipientOrSender: body.recipientOrSender ? String(body.recipientOrSender) : null,
          substantiveLegalAdvice: Boolean(body.substantiveLegalAdvice),
          bodyHash: body.bodyHash ? String(body.bodyHash) : null,
          metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
        }),
      }, { status: 201 });
    }

    if (action === "queueCommunicationDelivery") {
      const channel = String(body.channel ?? "In-App");
      if (!["Email", "WhatsApp", "SMS", "In-App"].includes(channel)) {
        return NextResponse.json({ success: false, error: "Unsupported delivery channel." }, { status: 400 });
      }
      const title = String(body.title ?? "Matter update").trim();
      const message = String(body.message ?? "").trim();
      if (!message) return NextResponse.json({ success: false, error: "A delivery message is required." }, { status: 400 });

      const communicationId = body.communicationId ? String(body.communicationId) : null;
      if (communicationId) {
        await transitionMatterCommunication({
          matterId,
          scope,
          communicationId,
          lifecycleState: "APPROVED",
        });
      }
      const outbox = await enqueueClientUpdateDelivery({
        scope,
        matterId,
        communicationId,
        channel: channel as "Email" | "WhatsApp" | "SMS" | "In-App",
        title,
        message,
      });
      return NextResponse.json({ success: true, queued: true, outbox }, { status: 202 });
    }

    if (["reviewCommunication","approveCommunication","markCommunicationSent","markCommunicationDelivered","markCommunicationFailed"].includes(action)) {
      const map: Record<string, "IN_REVIEW" | "APPROVED" | "SENT" | "DELIVERED" | "FAILED"> = {
        reviewCommunication: "IN_REVIEW",
        approveCommunication: "APPROVED",
        markCommunicationSent: "SENT",
        markCommunicationDelivered: "DELIVERED",
        markCommunicationFailed: "FAILED",
      };
      return NextResponse.json({
        success: true,
        communication: await transitionMatterCommunication({
          matterId,
          scope,
          communicationId: String(body.communicationId),
          lifecycleState: map[action],
          externalMessageId: body.externalMessageId ? String(body.externalMessageId) : null,
        }),
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported control action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to process matter control." },
      { status: statusForApiError(error) }
    );
  }
}
