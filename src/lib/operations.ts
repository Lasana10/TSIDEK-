import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readPrototypeCollection, writePrototypeCollection } from "@/lib/prototype-state.server";
import { deliverMatterUpdate } from "@/lib/communications";
import { isDemoModeEnabled } from "@/lib/runtime-mode";

export type NotificationItem = {
  id: string;
  channel: "In-app" | "Email" | "WhatsApp" | "SMS";
  title: string;
  message: string;
  status: "Queued" | "Sent" | "Delivered" | "Read";
  createdAt: string;
  matterId?: string;
  actionLabel?: string;
  deliveryNote?: string;
  recipient?: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  role: string;
  body: string;
  createdAt: string;
  origin: "human" | "ai" | "system";
};

export type ChatThread = {
  id: string;
  matterId: string;
  title: string;
  participants: string[];
  unreadCount: number;
  lastActivityAt: string;
  messages: ChatMessage[];
};

export type GuidanceProfile = {
  id: string;
  clientName: string;
  matterId: string;
  qualityScore: number;
  scoreTrend: "Improving" | "Stable" | "Needs attention";
  preferredChannel: "Email" | "WhatsApp" | "SMS" | "In-app";
  preferredTone: string;
  questionnaireSummary: string;
  guidanceSummary: string;
  nextAction: string;
  updatedAt: string;
};

export type ClientUpdateRecord = {
  id: string;
  matterId: string;
  channel: "Email" | "WhatsApp" | "SMS" | "In-app";
  title: string;
  message: string;
  status: "Draft" | "Approved" | "Queued" | "Sent" | "Delivered" | "Acknowledged" | "Needs revision";
  recipient: string | null;
  deliveryNote: string | null;
  draftedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  acknowledgedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type AiAccount = {
  id: string;
  provider: string;
  plan: string;
  status: "Configured" | "Needs key" | "Paused";
  scope: string;
  purpose: string;
  preferredFor: string;
  notes: string;
};

export type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  channel: string;
  status: "Active" | "Paused";
  nextRun: string;
  lastRun: string;
};

export type MatterMemorySnapshot = {
  id: string;
  matterId: string;
  summary: string;
  keyDecision: string;
  unresolvedItems: string[];
  recalledFor: string;
  updatedAt: string;
};

export type OperationalDashboard = {
  notifications: NotificationItem[];
  chatThreads: ChatThread[];
  guidanceProfiles: GuidanceProfile[];
  clientUpdates: ClientUpdateRecord[];
  aiAccounts: AiAccount[];
  automations: AutomationRule[];
  memorySnapshots: MatterMemorySnapshot[];
};

type FirmScopedResult = {
  firmId: string;
  clientName?: string;
};

const seededNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    channel: "WhatsApp",
    title: "Deadline escalation",
    message: "K-Metal SARL filing window enters the final review lane in 24 hours.",
    status: "Sent",
    createdAt: "2026-06-20T08:15:00.000Z",
    matterId: "tsk-cm-2026-041",
    actionLabel: "Open matter",
  },
  {
    id: "notif-2",
    channel: "In-app",
    title: "Evidence upload indexed",
    message: "Nexa Assurance correspondence bundle has been summarized and linked.",
    status: "Read",
    createdAt: "2026-06-20T07:40:00.000Z",
    matterId: "tsk-cm-2026-042",
    actionLabel: "Review evidence",
  },
  {
    id: "notif-3",
    channel: "Email",
    title: "Client follow-up queued",
    message: "Provision request ready for finance review and client dispatch.",
    status: "Queued",
    createdAt: "2026-06-20T06:50:00.000Z",
    actionLabel: "Send now",
  },
];

const seededChatThreads: ChatThread[] = [
  {
    id: "thread-1",
    matterId: "tsk-cm-2026-041",
    title: "K-Metal SARL - strategy room",
    participants: ["Sarah Mvondo", "Amina Bello", "Marie Ekani", "TSIDEK Brain"],
    unreadCount: 2,
    lastActivityAt: "2026-06-20T08:32:00.000Z",
    messages: [
      {
        id: "msg-1",
        author: "Marie Ekani",
        role: "Intern",
        body: "I drafted the deadline note. Should we attach the holiday check in the final bundle?",
        createdAt: "2026-06-20T08:20:00.000Z",
        origin: "human",
      },
      {
        id: "msg-2",
        author: "TSIDEK Brain",
        role: "AI assistant",
        body: "Yes. Add the holiday note as a visible disclaimer and keep the final approval human-led.",
        createdAt: "2026-06-20T08:22:00.000Z",
        origin: "ai",
      },
      {
        id: "msg-3",
        author: "Amina Bello",
        role: "Project Manager",
        body: "I moved the filing checklist into the partner review lane.",
        createdAt: "2026-06-20T08:32:00.000Z",
        origin: "human",
      },
    ],
  },
];

const seededGuidanceProfiles: GuidanceProfile[] = [
  {
    id: "guide-1",
    clientName: "K-Metal SARL",
    matterId: "tsk-cm-2026-041",
    qualityScore: 82,
    scoreTrend: "Improving",
    preferredChannel: "WhatsApp",
    preferredTone: "Concise, bilingual, action-first",
    questionnaireSummary: "Prefers short updates, low legal jargon, and direct next steps.",
    guidanceSummary: "Send milestone updates after each procedural move and keep risk language plain.",
    nextAction: "Notify client after partner approval with the filing checklist summary.",
    updatedAt: "2026-06-20T08:45:00.000Z",
  },
  {
    id: "guide-2",
    clientName: "Nexa Assurance",
    matterId: "tsk-cm-2026-042",
    qualityScore: 75,
    scoreTrend: "Stable",
    preferredChannel: "Email",
    preferredTone: "Structured, evidence-heavy, calm",
    questionnaireSummary: "Wants a formal paper trail and document-first communication.",
    guidanceSummary: "Send annotated summaries with attachments and keep financial exposure in one digest.",
    nextAction: "Prepare insurer chronology summary for review.",
    updatedAt: "2026-06-20T08:05:00.000Z",
  },
];

const seededClientUpdates: ClientUpdateRecord[] = [
  {
    id: "client-update-1",
    matterId: "tsk-cm-2026-041",
    channel: "WhatsApp",
    title: "K-Metal SARL progress update",
    message: "Partner review is complete. Filing dispatch is planned for tomorrow morning after final holiday verification.",
    status: "Approved",
    recipient: "+237699000111",
    deliveryNote: "Awaiting operator dispatch.",
    draftedBy: "Amina Bello",
    approvedBy: "Sarah Mvondo",
    approvedAt: "2026-07-20T10:15:00.000Z",
    dispatchedAt: null,
    acknowledgedAt: null,
    updatedAt: "2026-07-20T10:15:00.000Z",
    createdAt: "2026-07-20T09:50:00.000Z",
  },
];

const seededAiAccounts: AiAccount[] = [
  {
    id: "ai-1",
    provider: "Gemini",
    plan: "Pro / API",
    status: "Configured",
    scope: "Drafting, summarization, bilingual guidance",
    purpose: "Fast orchestration and user-facing assistance",
    preferredFor: "Front office and matter summaries",
    notes: "Use for concise routing and client-friendly explanations.",
  },
  {
    id: "ai-2",
    provider: "Ollama",
    plan: "Local",
    status: "Needs key",
    scope: "Private matter analysis and offline recall",
    purpose: "Local-first reasoning when connectivity is limited",
    preferredFor: "Confidential legal reasoning",
    notes: "Keep on-premise for sensitive matters and offline resilience.",
  },
];

const seededAutomations: AutomationRule[] = [
  {
    id: "auto-1",
    name: "Deadline escalation",
    trigger: "24 hours before procedural deadline",
    action: "Notify matter team and request partner review",
    channel: "In-app + WhatsApp",
    status: "Active",
    nextRun: "Tomorrow 09:00",
    lastRun: "Today 08:30",
  },
  {
    id: "auto-2",
    name: "Client progress digest",
    trigger: "Matter stage changes",
    action: "Send plain-language milestone update",
    channel: "Email",
    status: "Active",
    nextRun: "On next stage change",
    lastRun: "Today 07:15",
  },
];

const seededMemorySnapshots: MatterMemorySnapshot[] = [
  {
    id: "memory-1",
    matterId: "tsk-cm-2026-041",
    summary: "Filing sequence and exhibit pack completed with bilingual review pending.",
    keyDecision: "Partner approval required before dispatch.",
    unresolvedItems: ["Holiday verification", "Bailiff service follow-up"],
    recalledFor: "Matter reopen and client update",
    updatedAt: "2026-06-20T08:40:00.000Z",
  },
];

const operationsCollectionKey = "operations-dashboard";

function createEmptyOperationalDashboard(): OperationalDashboard {
  return {
    notifications: [],
    chatThreads: [],
    guidanceProfiles: [],
    clientUpdates: [],
    aiAccounts: [],
    automations: [],
    memorySnapshots: [],
  };
}

function createOperationalClient() {
  return createServerSupabaseClient();
}

async function resolveFirmScopeForMatter(matterId: string): Promise<FirmScopedResult | null> {
  const supabase = createOperationalClient();

  if (!supabase) {
    return null;
  }

  const result = await supabase
    .from("matters")
    .select("firm_id,client_name")
    .eq("id", matterId)
    .single();

  if (result.error || !result.data) {
    return null;
  }

  return {
    firmId: result.data.firm_id,
    clientName: result.data.client_name ?? undefined,
  };
}

function pickRecent<T extends { updatedAt?: string; createdAt?: string }>(items: T[], count = 5) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightValue = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return rightValue - leftValue;
  }).slice(0, count);
}

async function loadDashboardFromSupabase(firmId?: string | null) {
  const supabase = createOperationalClient();

  if (!supabase) {
    return null;
  }

  let notificationQuery = supabase
    .from("notifications")
    .select("id,firm_id,matter_id,channel,title,message,status,created_at,read_at,action_label")
    .order("created_at", { ascending: false })
    .limit(10);
  let threadQuery = supabase
    .from("chat_threads")
    .select("id,firm_id,matter_id,title,participants,unread_count,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  let guidanceQuery = supabase
    .from("client_guidance_profiles")
    .select("id,firm_id,matter_id,client_name,quality_score,score_trend,preferred_channel,preferred_tone,questionnaire_summary,guidance_summary,next_action,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  let accountQuery = supabase
    .from("ai_provider_accounts")
    .select("id,firm_id,provider,plan,status,scope,purpose,preferred_for,notes,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  let automationQuery = supabase
    .from("automation_rules")
    .select("id,firm_id,name,trigger,action,channel,status,next_run,last_run,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  let memoryQuery = supabase
    .from("matter_context_snapshots")
    .select("id,firm_id,matter_id,summary,key_decision,unresolved_items,recalled_for,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  let clientUpdateQuery = supabase
    .from("matter_client_updates")
    .select("id,firm_id,matter_id,channel,title,message,status,recipient,delivery_note,drafted_by,approved_by,approved_at,dispatched_at,acknowledged_at,updated_at,created_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (firmId) {
    notificationQuery = notificationQuery.eq("firm_id", firmId);
    threadQuery = threadQuery.eq("firm_id", firmId);
    guidanceQuery = guidanceQuery.eq("firm_id", firmId);
    accountQuery = accountQuery.eq("firm_id", firmId);
    automationQuery = automationQuery.eq("firm_id", firmId);
    memoryQuery = memoryQuery.eq("firm_id", firmId);
    clientUpdateQuery = clientUpdateQuery.eq("firm_id", firmId);
  }

  const [notificationResult, threadResult, guidanceResult, accountResult, automationResult, memoryResult, clientUpdateResult] =
    await Promise.all([
      notificationQuery,
      threadQuery,
      guidanceQuery,
      accountQuery,
      automationQuery,
      memoryQuery,
      clientUpdateQuery,
    ]);

  const threadIds = ((threadResult.data ?? []) as Array<{ id: string }>).map((thread) => thread.id);
  const messageResult = threadIds.length
    ? await supabase
        .from("chat_messages")
        .select("id,thread_id,author,role,body,origin,created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: true })
        .limit(50)
    : { data: [], error: null };

  if (
    notificationResult.error ||
    threadResult.error ||
    messageResult.error ||
    guidanceResult.error ||
    accountResult.error ||
    automationResult.error ||
    memoryResult.error
  ) {
    return null;
  }

  const safeClientUpdateRows = clientUpdateResult.error ? [] : (clientUpdateResult.data ?? []);

  const threadMessages = (messageResult.data ?? []) as Array<{
    id: string;
    thread_id: string;
    author: string;
    role: string;
    body: string;
    origin: "human" | "ai" | "system" | null;
    created_at: string;
  }>;

  const messageByThread = new Map<string, ChatMessage[]>();
  for (const message of threadMessages) {
    const items = messageByThread.get(message.thread_id) ?? [];
    items.push({
      id: message.id,
      author: message.author,
      role: message.role,
      body: message.body,
      createdAt: message.created_at,
      origin: message.origin ?? "human",
    });
    messageByThread.set(message.thread_id, items);
  }

  return {
    notifications: ((notificationResult.data ?? []) as Array<{
      id: string;
      matter_id: string | null;
      channel: NotificationItem["channel"];
      title: string;
      message: string;
      status: NotificationItem["status"];
      created_at: string;
      action_label: string | null;
    }>).map((notification) => ({
      id: notification.id,
      matterId: notification.matter_id ?? undefined,
      channel: notification.channel,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      createdAt: notification.created_at,
      actionLabel: notification.action_label ?? undefined,
      deliveryNote: undefined,
      recipient: undefined,
    })),
    chatThreads: ((threadResult.data ?? []) as Array<{
      id: string;
      matter_id: string;
      title: string;
      participants: string[] | null;
      unread_count: number | null;
      updated_at: string;
    }>).map((thread) => ({
      id: thread.id,
      matterId: thread.matter_id,
      title: thread.title,
      participants: thread.participants ?? [],
      unreadCount: thread.unread_count ?? 0,
      lastActivityAt: thread.updated_at,
      messages: messageByThread.get(thread.id) ?? [],
    })),
    guidanceProfiles: ((guidanceResult.data ?? []) as Array<{
      id: string;
      matter_id: string;
      client_name: string;
      quality_score: number;
      score_trend: GuidanceProfile["scoreTrend"];
      preferred_channel: GuidanceProfile["preferredChannel"];
      preferred_tone: string;
      questionnaire_summary: string;
      guidance_summary: string;
      next_action: string;
      updated_at: string;
    }>).map((profile) => ({
      id: profile.id,
      clientName: profile.client_name,
      matterId: profile.matter_id,
      qualityScore: profile.quality_score,
      scoreTrend: profile.score_trend,
      preferredChannel: profile.preferred_channel,
      preferredTone: profile.preferred_tone,
      questionnaireSummary: profile.questionnaire_summary,
      guidanceSummary: profile.guidance_summary,
      nextAction: profile.next_action,
      updatedAt: profile.updated_at,
    })),
    clientUpdates: (safeClientUpdateRows as Array<{
      id: string;
      matter_id: string;
      channel: ClientUpdateRecord["channel"];
      title: string;
      message: string;
      status: ClientUpdateRecord["status"];
      recipient: string | null;
      delivery_note: string | null;
      drafted_by: string | null;
      approved_by: string | null;
      approved_at: string | null;
      dispatched_at: string | null;
      acknowledged_at: string | null;
      updated_at: string;
      created_at: string;
    }>).map((item) => ({
      id: item.id,
      matterId: item.matter_id,
      channel: item.channel,
      title: item.title,
      message: item.message,
      status: item.status,
      recipient: item.recipient,
      deliveryNote: item.delivery_note,
      draftedBy: item.drafted_by,
      approvedBy: item.approved_by,
      approvedAt: item.approved_at,
      dispatchedAt: item.dispatched_at,
      acknowledgedAt: item.acknowledged_at,
      updatedAt: item.updated_at,
      createdAt: item.created_at,
    })),
    aiAccounts: ((accountResult.data ?? []) as Array<{
      id: string;
      provider: string;
      plan: string;
      status: AiAccount["status"];
      scope: string;
      purpose: string;
      preferred_for: string;
      notes: string;
    }>).map((account) => ({
      id: account.id,
      provider: account.provider,
      plan: account.plan,
      status: account.status,
      scope: account.scope,
      purpose: account.purpose,
      preferredFor: account.preferred_for,
      notes: account.notes,
    })),
    automations: ((automationResult.data ?? []) as Array<{
      id: string;
      name: string;
      trigger: string;
      action: string;
      channel: string;
      status: AutomationRule["status"];
      next_run: string;
      last_run: string;
    }>).map((automation) => ({
      id: automation.id,
      name: automation.name,
      trigger: automation.trigger,
      action: automation.action,
      channel: automation.channel,
      status: automation.status,
      nextRun: automation.next_run,
      lastRun: automation.last_run,
    })),
    memorySnapshots: ((memoryResult.data ?? []) as Array<{
      id: string;
      matter_id: string;
      summary: string;
      key_decision: string;
      unresolved_items: string[] | null;
      recalled_for: string;
      updated_at: string;
    }>).map((memory) => ({
      id: memory.id,
      matterId: memory.matter_id,
      summary: memory.summary,
      keyDecision: memory.key_decision,
      unresolvedItems: memory.unresolved_items ?? [],
      recalledFor: memory.recalled_for,
      updatedAt: memory.updated_at,
    })),
  } satisfies OperationalDashboard;
}

export async function listOperationalDashboard(firmId?: string | null): Promise<OperationalDashboard> {
  const liveDashboard = await loadDashboardFromSupabase(firmId);
  if (liveDashboard) {
    return liveDashboard;
  }

  if (!isDemoModeEnabled()) {
    return createEmptyOperationalDashboard();
  }

  return readPrototypeCollection(operationsCollectionKey, {
    notifications: pickRecent(seededNotifications, 5),
    chatThreads: seededChatThreads,
    guidanceProfiles: seededGuidanceProfiles,
    clientUpdates: seededClientUpdates,
    aiAccounts: seededAiAccounts,
    automations: seededAutomations,
    memorySnapshots: seededMemorySnapshots,
  });
}

function assertPrototypeWritesEnabled() {
  if (!isDemoModeEnabled()) {
    throw new Error("Live Supabase persistence is required for this operation in production.");
  }
}

async function mutatePrototypeDashboard<T>(
  mutate: (dashboard: OperationalDashboard) => { dashboard: OperationalDashboard; result: T }
) {
  assertPrototypeWritesEnabled();
  const dashboard = await listOperationalDashboard();
  const payload = mutate(dashboard);
  await writePrototypeCollection(operationsCollectionKey, payload.dashboard);
  return payload.result;
}

export async function appendChatMessage(input: {
  threadId: string;
  author: string;
  role: string;
  body: string;
  origin?: "human" | "ai" | "system";
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const message = {
        id: `local-${Date.now()}`,
        threadId: input.threadId,
        author: input.author,
        role: input.role,
        body: input.body,
        createdAt: now,
        origin: input.origin ?? "human" as const,
      };

      const chatThreads = dashboard.chatThreads.map((thread) =>
        thread.id === input.threadId
          ? {
              ...thread,
              unreadCount: thread.unreadCount + 1,
              lastActivityAt: now,
              messages: [...thread.messages, {
                id: message.id,
                author: message.author,
                role: message.role,
                body: message.body,
                createdAt: message.createdAt,
                origin: message.origin,
              }],
            }
          : thread
      );

      return {
        dashboard: { ...dashboard, chatThreads },
        result: message,
      };
    });
  }

  const result = await supabase
    .from("chat_messages")
    .insert({
      thread_id: input.threadId,
      author: input.author,
      role: input.role,
      body: input.body,
      origin: input.origin ?? "human",
    })
    .select("id,thread_id,author,role,body,origin,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to save chat message");
  }

  return {
    id: result.data.id,
    threadId: result.data.thread_id,
    author: result.data.author,
    role: result.data.role,
    body: result.data.body,
    createdAt: result.data.created_at,
    origin: result.data.origin ?? "human",
  };
}

export async function recordQualityResponse(input: {
  profileId: string;
  score: number;
  channel: string;
  tone: string;
  questionnaireSummary: string;
  guidanceSummary: string;
  nextAction: string;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: `local-${Date.now()}`,
      ...input,
      updatedAt: now,
    };
  }

  const result = await supabase
    .from("quality_responses")
    .insert({
      profile_id: input.profileId,
      quality_score: input.score,
      preferred_channel: input.channel,
      preferred_tone: input.tone,
      questionnaire_summary: input.questionnaireSummary,
      guidance_summary: input.guidanceSummary,
      next_action: input.nextAction,
    })
    .select("id,profile_id,quality_score,preferred_channel,preferred_tone,questionnaire_summary,guidance_summary,next_action,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to save quality response");
  }

  return result.data;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = createOperationalClient();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const notifications = dashboard.notifications.map((item) =>
        item.id === notificationId ? { ...item, status: "Read" as const } : item
      );

      return {
        dashboard: { ...dashboard, notifications },
        result: { id: notificationId, status: "Read" as const },
      };
    });
  }

  const result = await supabase
    .from("notifications")
    .update({ status: "Read", read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id,status")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to update notification");
  }

  return result.data;
}

export async function createNotification(input: {
  matterId: string;
  channel: NotificationItem["channel"];
  title: string;
  message: string;
  actionLabel?: string;
  status?: NotificationItem["status"];
  deliveryNote?: string;
  recipient?: string | null;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const notification = {
        id: `local-${Date.now()}`,
        matterId: input.matterId,
        channel: input.channel,
        title: input.title,
        message: input.message,
        status: input.status ?? ("Queued" as const),
        createdAt: now,
        actionLabel: input.actionLabel,
        deliveryNote: input.deliveryNote,
        recipient: input.recipient ?? undefined,
      };

      return {
        dashboard: {
          ...dashboard,
          notifications: [notification, ...dashboard.notifications].slice(0, 20),
        },
        result: notification,
      };
    });
  }

  const scope = await resolveFirmScopeForMatter(input.matterId);

  if (!scope) {
    throw new Error("Unable to resolve firm scope for notification");
  }

  const result = await supabase
    .from("notifications")
    .insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      channel: input.channel,
      title: input.title,
      message: input.message,
      status: "Queued",
      action_label: input.actionLabel ?? null,
    })
    .select("id,matter_id,channel,title,message,status,created_at,action_label")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to create notification");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id ?? undefined,
    channel: result.data.channel as NotificationItem["channel"],
    title: result.data.title,
    message: result.data.message,
    status: result.data.status as NotificationItem["status"],
    createdAt: result.data.created_at,
    actionLabel: result.data.action_label ?? undefined,
    deliveryNote: input.deliveryNote,
    recipient: input.recipient ?? undefined,
  };
}

export async function dispatchClientUpdate(input: {
  matterId: string;
  channel: NotificationItem["channel"];
  title: string;
  message: string;
  actionLabel?: string;
}) {
  const delivery = await deliverMatterUpdate({
    matterId: input.matterId,
    channel: input.channel,
    title: input.title,
    message: input.message,
  });

  const notification = await createNotification({
    matterId: input.matterId,
    channel: input.channel,
    title: input.title,
    message: input.message,
    actionLabel: input.actionLabel,
    status: delivery.status,
    deliveryNote: delivery.note,
    recipient: delivery.recipient,
  });

  return {
    notification,
    delivery,
  };
}

export async function createClientUpdateDraft(input: {
  matterId: string;
  channel: ClientUpdateRecord["channel"];
  title: string;
  message: string;
  draftedBy?: string | null;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const record: ClientUpdateRecord = {
        id: `local-client-update-${Date.now()}`,
        matterId: input.matterId,
        channel: input.channel,
        title: input.title,
        message: input.message,
        status: "Draft",
        recipient: null,
        deliveryNote: "Draft saved locally pending partner approval.",
        draftedBy: input.draftedBy ?? null,
        approvedBy: null,
        approvedAt: null,
        dispatchedAt: null,
        acknowledgedAt: null,
        updatedAt: now,
        createdAt: now,
      };

      return {
        dashboard: {
          ...dashboard,
          clientUpdates: [record, ...dashboard.clientUpdates].slice(0, 30),
        },
        result: record,
      };
    });
  }

  const scope = await resolveFirmScopeForMatter(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve firm scope for client update draft.");
  }

  const result = await supabase
    .from("matter_client_updates")
    .insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      channel: input.channel,
      title: input.title,
      message: input.message,
      status: "Draft",
      drafted_by: input.draftedBy ?? null,
      delivery_note: "Draft saved pending partner approval.",
    })
    .select("id,matter_id,channel,title,message,status,recipient,delivery_note,drafted_by,approved_by,approved_at,dispatched_at,acknowledged_at,updated_at,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to save client update draft.");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id,
    channel: result.data.channel as ClientUpdateRecord["channel"],
    title: result.data.title,
    message: result.data.message,
    status: result.data.status as ClientUpdateRecord["status"],
    recipient: result.data.recipient,
    deliveryNote: result.data.delivery_note,
    draftedBy: result.data.drafted_by,
    approvedBy: result.data.approved_by,
    approvedAt: result.data.approved_at,
    dispatchedAt: result.data.dispatched_at,
    acknowledgedAt: result.data.acknowledged_at,
    updatedAt: result.data.updated_at,
    createdAt: result.data.created_at,
  } satisfies ClientUpdateRecord;
}

export async function approveClientUpdate(input: {
  updateId: string;
  approverId: string;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const clientUpdates = dashboard.clientUpdates.map((item) =>
        item.id === input.updateId
          ? {
              ...item,
              status: "Approved" as const,
              approvedBy: input.approverId,
              approvedAt: now,
              deliveryNote: "Approved for client dispatch.",
              updatedAt: now,
            }
          : item
      );

      return {
        dashboard: { ...dashboard, clientUpdates },
        result: clientUpdates.find((item) => item.id === input.updateId) ?? null,
      };
    });
  }

  const result = await supabase
    .from("matter_client_updates")
    .update({
      status: "Approved",
      approved_by: input.approverId,
      approved_at: now,
      delivery_note: "Approved for client dispatch.",
    })
    .eq("id", input.updateId)
    .select("id,matter_id,channel,title,message,status,recipient,delivery_note,drafted_by,approved_by,approved_at,dispatched_at,acknowledged_at,updated_at,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to approve client update.");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id,
    channel: result.data.channel as ClientUpdateRecord["channel"],
    title: result.data.title,
    message: result.data.message,
    status: result.data.status as ClientUpdateRecord["status"],
    recipient: result.data.recipient,
    deliveryNote: result.data.delivery_note,
    draftedBy: result.data.drafted_by,
    approvedBy: result.data.approved_by,
    approvedAt: result.data.approved_at,
    dispatchedAt: result.data.dispatched_at,
    acknowledgedAt: result.data.acknowledged_at,
    updatedAt: result.data.updated_at,
    createdAt: result.data.created_at,
  } satisfies ClientUpdateRecord;
}

export async function dispatchApprovedClientUpdate(updateId: string) {
  const dashboard = await listOperationalDashboard();
  const record = dashboard.clientUpdates.find((item) => item.id === updateId);

  if (!record) {
    throw new Error("Client update not found.");
  }
  if (record.status !== "Approved" && record.status !== "Queued") {
    throw new Error("Only approved client updates can be dispatched.");
  }

  const delivery = await deliverMatterUpdate({
    matterId: record.matterId,
    channel: record.channel,
    title: record.title,
    message: record.message,
  });

  await createNotification({
    matterId: record.matterId,
    channel: record.channel,
    title: record.title,
    message: record.message,
    actionLabel: "Open matter",
    status: delivery.status,
    deliveryNote: delivery.note,
    recipient: delivery.recipient,
  });

  const supabase = createOperationalClient();
  const now = new Date().toISOString();
  const nextStatus: ClientUpdateRecord["status"] = delivery.delivered ? "Sent" : "Queued";

  if (!supabase) {
    return mutatePrototypeDashboard((dashboardState) => {
      const clientUpdates = dashboardState.clientUpdates.map((item) =>
        item.id === updateId
          ? {
              ...item,
              status: nextStatus,
              recipient: delivery.recipient,
              deliveryNote: delivery.note,
              dispatchedAt: now,
              updatedAt: now,
            }
          : item
      );

      return {
        dashboard: { ...dashboardState, clientUpdates },
        result: {
          record: clientUpdates.find((item) => item.id === updateId) ?? null,
          delivery,
        },
      };
    });
  }

  const result = await supabase
    .from("matter_client_updates")
    .update({
      status: nextStatus,
      recipient: delivery.recipient,
      delivery_note: delivery.note,
      dispatched_at: now,
    })
    .eq("id", updateId)
    .select("id,matter_id,channel,title,message,status,recipient,delivery_note,drafted_by,approved_by,approved_at,dispatched_at,acknowledged_at,updated_at,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to dispatch client update.");
  }

  return {
    record: {
      id: result.data.id,
      matterId: result.data.matter_id,
      channel: result.data.channel as ClientUpdateRecord["channel"],
      title: result.data.title,
      message: result.data.message,
      status: result.data.status as ClientUpdateRecord["status"],
      recipient: result.data.recipient,
      deliveryNote: result.data.delivery_note,
      draftedBy: result.data.drafted_by,
      approvedBy: result.data.approved_by,
      approvedAt: result.data.approved_at,
      dispatchedAt: result.data.dispatched_at,
      acknowledgedAt: result.data.acknowledged_at,
      updatedAt: result.data.updated_at,
      createdAt: result.data.created_at,
    } satisfies ClientUpdateRecord,
    delivery,
  };
}

export async function acknowledgeClientUpdate(updateId: string) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const clientUpdates = dashboard.clientUpdates.map((item) =>
        item.id === updateId
          ? {
              ...item,
              status: "Acknowledged" as const,
              acknowledgedAt: now,
              deliveryNote: item.deliveryNote ?? "Client acknowledgement recorded.",
              updatedAt: now,
            }
          : item
      );

      return {
        dashboard: { ...dashboard, clientUpdates },
        result: clientUpdates.find((item) => item.id === updateId) ?? null,
      };
    });
  }

  const result = await supabase
    .from("matter_client_updates")
    .update({
      status: "Acknowledged",
      acknowledged_at: now,
    })
    .eq("id", updateId)
    .select("id,matter_id,channel,title,message,status,recipient,delivery_note,drafted_by,approved_by,approved_at,dispatched_at,acknowledged_at,updated_at,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to record client acknowledgement.");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id,
    channel: result.data.channel as ClientUpdateRecord["channel"],
    title: result.data.title,
    message: result.data.message,
    status: result.data.status as ClientUpdateRecord["status"],
    recipient: result.data.recipient,
    deliveryNote: result.data.delivery_note,
    draftedBy: result.data.drafted_by,
    approvedBy: result.data.approved_by,
    approvedAt: result.data.approved_at,
    dispatchedAt: result.data.dispatched_at,
    acknowledgedAt: result.data.acknowledged_at,
    updatedAt: result.data.updated_at,
    createdAt: result.data.created_at,
  } satisfies ClientUpdateRecord;
}

export async function upsertGuidanceProfile(input: {
  matterId: string;
  qualityScore: number;
  scoreTrend: GuidanceProfile["scoreTrend"];
  preferredChannel: GuidanceProfile["preferredChannel"];
  preferredTone: string;
  questionnaireSummary: string;
  guidanceSummary: string;
  nextAction: string;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const existing = dashboard.guidanceProfiles.find((item) => item.matterId === input.matterId);
      const guidance = {
        id: existing?.id ?? `local-${Date.now()}`,
        matterId: input.matterId,
        clientName: existing?.clientName ?? "Matter client",
        qualityScore: input.qualityScore,
        scoreTrend: input.scoreTrend,
        preferredChannel: input.preferredChannel,
        preferredTone: input.preferredTone,
        questionnaireSummary: input.questionnaireSummary,
        guidanceSummary: input.guidanceSummary,
        nextAction: input.nextAction,
        updatedAt: now,
      };

      const guidanceProfiles = [
        guidance,
        ...dashboard.guidanceProfiles.filter((item) => item.matterId !== input.matterId),
      ];

      return {
        dashboard: { ...dashboard, guidanceProfiles },
        result: guidance,
      };
    });
  }

  const scope = await resolveFirmScopeForMatter(input.matterId);

  if (!scope) {
    throw new Error("Unable to resolve firm scope for guidance");
  }

  const existing = await supabase
    .from("client_guidance_profiles")
    .select("id")
    .eq("matter_id", input.matterId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const payload = {
    firm_id: scope.firmId,
    matter_id: input.matterId,
    client_name: scope.clientName ?? "Matter client",
    quality_score: input.qualityScore,
    score_trend: input.scoreTrend,
    preferred_channel: input.preferredChannel,
    preferred_tone: input.preferredTone,
    questionnaire_summary: input.questionnaireSummary,
    guidance_summary: input.guidanceSummary,
    next_action: input.nextAction,
    updated_at: now,
  };

  const query = existing.data?.id
    ? supabase.from("client_guidance_profiles").update(payload).eq("id", existing.data.id)
    : supabase.from("client_guidance_profiles").insert(payload);

  const result = await query
    .select("id,matter_id,client_name,quality_score,score_trend,preferred_channel,preferred_tone,questionnaire_summary,guidance_summary,next_action,updated_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to upsert guidance profile");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id,
    clientName: result.data.client_name,
    qualityScore: result.data.quality_score,
    scoreTrend: result.data.score_trend as GuidanceProfile["scoreTrend"],
    preferredChannel: result.data.preferred_channel as GuidanceProfile["preferredChannel"],
    preferredTone: result.data.preferred_tone,
    questionnaireSummary: result.data.questionnaire_summary,
    guidanceSummary: result.data.guidance_summary,
    nextAction: result.data.next_action,
    updatedAt: result.data.updated_at,
  };
}

export async function createMemorySnapshot(input: {
  matterId: string;
  summary: string;
  keyDecision: string;
  unresolvedItems: string[];
  recalledFor: string;
}) {
  const supabase = createOperationalClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return mutatePrototypeDashboard((dashboard) => {
      const snapshot = {
        id: `local-${Date.now()}`,
        matterId: input.matterId,
        summary: input.summary,
        keyDecision: input.keyDecision,
        unresolvedItems: input.unresolvedItems,
        recalledFor: input.recalledFor,
        updatedAt: now,
      };

      return {
        dashboard: {
          ...dashboard,
          memorySnapshots: [snapshot, ...dashboard.memorySnapshots.filter((item) => item.matterId !== input.matterId)],
        },
        result: snapshot,
      };
    });
  }

  const scope = await resolveFirmScopeForMatter(input.matterId);

  if (!scope) {
    throw new Error("Unable to resolve firm scope for memory snapshot");
  }

  const result = await supabase
    .from("matter_context_snapshots")
    .insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      summary: input.summary,
      key_decision: input.keyDecision,
      unresolved_items: input.unresolvedItems,
      recalled_for: input.recalledFor,
    })
    .select("id,matter_id,summary,key_decision,unresolved_items,recalled_for,updated_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to create memory snapshot");
  }

  return {
    id: result.data.id,
    matterId: result.data.matter_id,
    summary: result.data.summary,
    keyDecision: result.data.key_decision,
    unresolvedItems: result.data.unresolved_items ?? [],
    recalledFor: result.data.recalled_for,
    updatedAt: result.data.updated_at,
  };
}
