"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  MessageSquare,
  Mail,
  Smartphone,
  ShieldAlert,
  Sparkles,
  Send,
} from "lucide-react";
import type { NotificationItem, OperationalDashboard } from "@/lib/operations";

type DashboardState = OperationalDashboard | null;

const fallbackNotifications: NotificationItem[] = [
  {
    id: "fallback-1",
    channel: "SMS",
    title: "Deadline Reminder",
    message: "Assig. Société Maritime X expires in 48h.",
    createdAt: "2026-06-20T08:00:00.000Z",
    status: "Sent",
    actionLabel: "Open matter",
  },
  {
    id: "fallback-2",
    channel: "WhatsApp",
    title: "Urgent Case Update",
    message: "New ruling uploaded by Advocate General.",
    createdAt: "2026-06-20T07:15:00.000Z",
    status: "Delivered",
    actionLabel: "Review",
  },
  {
    id: "fallback-3",
    channel: "Email",
    title: "Client Correspondence",
    message: "Bolloré signed the Procuration Spéciale.",
    createdAt: "2026-06-20T06:10:00.000Z",
    status: "Read",
    actionLabel: "Archive",
  },
];

export default function NotificationCenter() {
  const [dashboard, setDashboard] = useState<DashboardState>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/operations", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as OperationalDashboard;
        if (!cancelled) {
          setDashboard(payload);
          setSelectedThreadId((current) => current || payload.chatThreads[0]?.id || "");
        }
      } catch {
        // Seeded UI state remains available when the backend is not yet wired.
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const notifications = useMemo(
    () => (dashboard?.notifications?.length ? dashboard.notifications : fallbackNotifications),
    [dashboard]
  );
  const chatThreads = useMemo(() => dashboard?.chatThreads ?? [], [dashboard]);
  const guidanceProfiles = useMemo(() => dashboard?.guidanceProfiles ?? [], [dashboard]);
  const aiAccounts = useMemo(() => dashboard?.aiAccounts ?? [], [dashboard]);
  const automations = useMemo(() => dashboard?.automations ?? [], [dashboard]);
  const memorySnapshots = useMemo(() => dashboard?.memorySnapshots ?? [], [dashboard]);

  const activeThread = useMemo(() => {
    if (!chatThreads.length) {
      return null;
    }

    return chatThreads.find((thread) => thread.id === selectedThreadId) ?? chatThreads[0];
  }, [chatThreads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId && chatThreads[0]?.id) {
      setSelectedThreadId(chatThreads[0].id);
    }
  }, [chatThreads, selectedThreadId]);

  async function sendChatMessage() {
    if (!activeThread || !draftMessage.trim()) {
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chatMessage",
          threadId: activeThread.id,
          author: "Sarah Mvondo",
          role: "Partner",
          body: draftMessage.trim(),
          origin: "human",
        }),
      });

      if (response.ok) {
        const refreshed = await fetch("/api/operations", { cache: "no-store" });
        if (refreshed.ok) {
          setDashboard((await refreshed.json()) as OperationalDashboard);
        }
        setDraftMessage("");
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-heritage-green/6 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-heritage-green">
                <Bell className="h-3.5 w-3.5" />
                Operational Control Tower
              </div>
              <h1 className="text-3xl heading-serif text-heritage-green md:text-4xl">
                Alerts, chat, guidance, AI accounts, and automations
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                TSIDEK now keeps legal work moving with visible notifications, team chat, evolving client guidance,
                AI provider routing, and matter memory that can be recalled later.
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                {dashboard ? "Live operational dashboard loaded" : "Seeded fallback view until backend is connected"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Metric label="Notifications" value={notifications.length.toString()} />
              <Metric label="Chat threads" value={chatThreads.length.toString()} />
              <Metric label="AI accounts" value={aiAccounts.length.toString()} />
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <Panel title="Notification stream" icon={Bell} eyebrow="Multi-channel delivery">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    whileHover={{ y: -2 }}
                    className="flex items-start justify-between gap-4 rounded-[1.35rem] border border-slate-200 bg-[#fcfcfb] p-5"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white">
                        {notification.channel === "SMS" && <Smartphone className="h-5 w-5 text-heritage-green" />}
                        {notification.channel === "WhatsApp" && <MessageSquare className="h-5 w-5 text-emerald-500" />}
                        {notification.channel === "Email" && <Mail className="h-5 w-5 text-blue-500" />}
                        {notification.channel === "In-app" && <Bell className="h-5 w-5 text-heritage-green" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-heritage-green">{notification.title}</h3>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                            {notification.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          {notification.channel} • {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                    {notification.actionLabel && (
                      <span className="mt-1 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-heritage-green">
                        {notification.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </Panel>

            <Panel title="Team chat room" icon={MessageSquare} eyebrow="Matter room collaboration">
              <div className="grid gap-4 lg:grid-cols-[0.4fr_0.6fr]">
                <div className="rounded-[1.25rem] border border-slate-200 bg-[#fcfcfb] p-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Threads</h3>
                  <div className="mt-4 space-y-3">
                    {chatThreads.map((thread) => {
                      const selected = thread.id === activeThread?.id;
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full rounded-[1rem] border p-3 text-left transition ${
                            selected ? "border-heritage-green bg-[#f6fbf8]" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{thread.title}</p>
                            <span className="rounded-full bg-heritage-green/5 px-2 py-1 text-[10px] font-bold text-heritage-green">
                              {thread.unreadCount}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {thread.participants.join(" • ")}
                          </p>
                        </button>
                      );
                    })}
                    {!chatThreads.length && (
                      <p className="text-sm leading-6 text-slate-500">
                        No chat threads yet. Once Supabase is connected, the matter room will load live collaboration.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Live thread</p>
                      <h3 className="mt-1 text-lg font-semibold text-heritage-green">{activeThread?.title ?? "No thread selected"}</h3>
                    </div>
                    {activeThread && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                        Matter {activeThread.matterId}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {activeThread?.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-[1rem] border p-4 ${
                          message.origin === "ai" ? "border-emerald-100 bg-emerald-50/70" : "border-slate-200 bg-[#fcfcfb]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{message.author}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {message.role} • {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                          {message.origin === "ai" ? (
                            <Bot className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-heritage-green" />
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{message.body}</p>
                      </div>
                    ))}
                    {!activeThread && (
                      <p className="text-sm leading-6 text-slate-500">Pick a thread to review the discussion.</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    <textarea
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder="Write a message to the matter room..."
                      className="min-h-28 w-full rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4 text-sm outline-none transition focus:border-heritage-green"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        AI suggestions are logged but still require human approval.
                      </p>
                      <button
                        onClick={() => void sendChatMessage()}
                        disabled={isSending || !activeThread || !draftMessage.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-8">
            <Panel title="Guidance profiles" icon={Sparkles} eyebrow="Quality questionnaire + behavior history">
              <div className="space-y-4">
                {guidanceProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-[1.25rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{profile.clientName}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {profile.preferredChannel} • {profile.preferredTone}
                        </p>
                      </div>
                      <span className="rounded-full bg-heritage-green/5 px-3 py-1 text-[10px] font-bold text-heritage-green">
                        {profile.qualityScore}/100
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{profile.guidanceSummary}</p>
                    <p className="mt-3 text-xs text-slate-500">{profile.questionnaireSummary}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Next action: {profile.nextAction}
                    </p>
                  </div>
                ))}
                {!guidanceProfiles.length && (
                  <p className="text-sm leading-6 text-slate-500">
                    Guidance profiles will appear here once client questionnaires and behavior history are stored.
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="AI accounts" icon={Bot} eyebrow="Bring-your-own-pro or local AI">
              <div className="space-y-3">
                {aiAccounts.map((account) => (
                  <div key={account.id} className="rounded-[1.25rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{account.provider}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {account.plan} • {account.scope}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                          account.status === "Configured"
                            ? "bg-emerald-50 text-emerald-700"
                            : account.status === "Paused"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {account.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{account.purpose}</p>
                    <p className="mt-3 text-xs text-slate-500">{account.notes}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Automation rules" icon={ShieldAlert} eyebrow="Customer updates and workflow triggers">
              <div className="space-y-3">
                {automations.map((automation) => (
                  <div key={automation.id} className="rounded-[1.25rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{automation.name}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {automation.trigger}
                        </p>
                      </div>
                      <span className="rounded-full bg-heritage-green/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-heritage-green">
                        {automation.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{automation.action}</p>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      <span>{automation.channel}</span>
                      <span>Next: {automation.nextRun}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Matter memory" icon={CheckCircle2} eyebrow="Recall over time">
              <div className="space-y-3">
                {memorySnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="rounded-[1.25rem] border border-slate-200 bg-[#fcfcfb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{snapshot.matterId}</h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {formatDateTime(snapshot.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{snapshot.summary}</p>
                    <p className="mt-3 text-xs text-slate-500">Decision: {snapshot.keyDecision}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  eyebrow,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-2 text-2xl heading-serif text-heritage-green">{title}</h2>
        </div>
        <Icon className="h-5 w-5 text-heritage-green" />
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfcfb] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-heritage-green">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
