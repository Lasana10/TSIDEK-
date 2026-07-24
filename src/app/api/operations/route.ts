import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertMatterPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import {
  appendChatMessage,
  approveClientUpdate,
  acknowledgeClientUpdate,
  createClientUpdateDraft,
  dispatchClientUpdate,
  dispatchApprovedClientUpdate,
  createMemorySnapshot,
  createNotification,
  listOperationalDashboard,
  markNotificationRead,
  recordQualityResponse,
  upsertGuidanceProfile,
} from "@/lib/operations";

async function resolveMatterIdForOperation(input: {
  scopeFirmId: string | null;
  threadId?: string;
  notificationId?: string;
  clientUpdateId?: string;
  matterId?: string;
}) {
  if (input.matterId) {
    return input.matterId;
  }

  const dashboard = await listOperationalDashboard(input.scopeFirmId);

  if (input.threadId) {
    return dashboard.chatThreads.find((thread) => thread.id === input.threadId)?.matterId ?? null;
  }

  if (input.notificationId) {
    return dashboard.notifications.find((notification) => notification.id === input.notificationId)?.matterId ?? null;
  }

  if (input.clientUpdateId) {
    return dashboard.clientUpdates.find((item) => item.id === input.clientUpdateId)?.matterId ?? null;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const dashboard = await listOperationalDashboard(scope.firmId);
    return NextResponse.json({ ...dashboard, scope });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load operations." },
      { status: statusForApiError(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const body = await request.json();

    switch (body.action) {
      case "chatMessage": {
        const matterId = await resolveMatterIdForOperation({
          scopeFirmId: scope.firmId,
          threadId: body.threadId,
        });
        if (matterId) {
          await assertMatterPermission({ scope, matterId, allowAnyMember: true });
        }
        const message = await appendChatMessage({
          threadId: body.threadId,
          author: body.author ?? scope.actorName,
          role: body.role ?? scope.actorRole,
          body: body.body,
          origin: body.origin,
        });
        return NextResponse.json({ success: true, message });
      }
      case "qualityResponse": {
        const response = await recordQualityResponse({
          profileId: body.profileId,
          score: Number(body.score),
          channel: body.channel,
          tone: body.tone,
          questionnaireSummary: body.questionnaireSummary,
          guidanceSummary: body.guidanceSummary,
          nextAction: body.nextAction,
        });
        return NextResponse.json({ success: true, response });
      }
      case "markNotificationRead": {
        const matterId = await resolveMatterIdForOperation({
          scopeFirmId: scope.firmId,
          notificationId: body.notificationId,
        });
        if (matterId) {
          await assertMatterPermission({ scope, matterId, allowAnyMember: true });
        }
        const notification = await markNotificationRead(body.notificationId);
        return NextResponse.json({ success: true, notification });
      }
      case "createNotification": {
        await assertMatterPermission({
          scope,
          matterId: body.matterId,
          permission: "assignWork",
        });
        const notification = await createNotification({
          matterId: body.matterId,
          channel: body.channel,
          title: body.title,
          message: body.message,
          actionLabel: body.actionLabel,
        });
        return NextResponse.json({ success: true, notification });
      }
      case "dispatchClientUpdate": {
        await assertMatterPermission({
          scope,
          matterId: body.matterId,
          permission: "assignWork",
        });
        const payload = await dispatchClientUpdate({
          matterId: body.matterId,
          channel: body.channel,
          title: body.title,
          message: body.message,
          actionLabel: body.actionLabel,
        });
        return NextResponse.json({ success: true, ...payload });
      }
      case "createClientUpdateDraft": {
        await assertMatterPermission({
          scope,
          matterId: body.matterId,
          permission: "assignWork",
        });
        const record = await createClientUpdateDraft({
          matterId: body.matterId,
          channel: body.channel,
          title: body.title,
          message: body.message,
          draftedBy: scope.actorName,
        });
        return NextResponse.json({ success: true, record });
      }
      case "approveClientUpdate": {
        const matterId = await resolveMatterIdForOperation({
          scopeFirmId: scope.firmId,
          clientUpdateId: body.updateId,
        });
        if (!matterId) {
          return NextResponse.json({ success: false, error: "Client update not found." }, { status: 404 });
        }
        await assertMatterPermission({
          scope,
          matterId,
          permission: "approveFilings",
        });
        if (!scope.actorLawyerId) {
          return NextResponse.json({ success: false, error: "Acting lawyer profile is required for approval." }, { status: 400 });
        }
        const record = await approveClientUpdate({
          updateId: body.updateId,
          approverId: scope.actorLawyerId,
        });
        return NextResponse.json({ success: true, record });
      }
      case "dispatchApprovedClientUpdate": {
        const matterId = await resolveMatterIdForOperation({
          scopeFirmId: scope.firmId,
          clientUpdateId: body.updateId,
        });
        if (!matterId) {
          return NextResponse.json({ success: false, error: "Client update not found." }, { status: 404 });
        }
        await assertMatterPermission({
          scope,
          matterId,
          permission: "approveFilings",
        });
        const payload = await dispatchApprovedClientUpdate(body.updateId);
        return NextResponse.json({ success: true, ...payload });
      }
      case "acknowledgeClientUpdate": {
        const matterId = await resolveMatterIdForOperation({
          scopeFirmId: scope.firmId,
          clientUpdateId: body.updateId,
        });
        if (!matterId) {
          return NextResponse.json({ success: false, error: "Client update not found." }, { status: 404 });
        }
        await assertMatterPermission({ scope, matterId, allowAnyMember: true });
        const record = await acknowledgeClientUpdate(body.updateId);
        return NextResponse.json({ success: true, record });
      }
      case "upsertGuidanceProfile": {
        await assertMatterPermission({ scope, matterId: body.matterId, allowAnyMember: true });
        const guidance = await upsertGuidanceProfile({
          matterId: body.matterId,
          qualityScore: Number(body.qualityScore),
          scoreTrend: body.scoreTrend,
          preferredChannel: body.preferredChannel,
          preferredTone: body.preferredTone,
          questionnaireSummary: body.questionnaireSummary,
          guidanceSummary: body.guidanceSummary,
          nextAction: body.nextAction,
        });
        return NextResponse.json({ success: true, guidance });
      }
      case "createMemorySnapshot": {
        await assertMatterPermission({ scope, matterId: body.matterId, allowAnyMember: true });
        const snapshot = await createMemorySnapshot({
          matterId: body.matterId,
          summary: body.summary,
          keyDecision: body.keyDecision,
          unresolvedItems: Array.isArray(body.unresolvedItems) ? body.unresolvedItems : [],
          recalledFor: body.recalledFor,
        });
        return NextResponse.json({ success: true, snapshot });
      }
      default:
        return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[API Operations Route] Error processing request:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process operational request." },
      { status: statusForApiError(error) }
    );
  }
}
