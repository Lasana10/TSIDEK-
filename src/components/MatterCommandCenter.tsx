"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  FileCheck2,
  FileClock,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";

type CommandCenter = {
  matter: {
    id: string;
    title: string;
    clientName: string;
    displayStatus: string;
    lifecycleState: string;
    riskLevel: string;
    jurisdiction: string;
    securityClassification: string;
    ethicalWallEnabled: boolean;
    leadLawyerId: string | null;
  };
  summary: {
    openObligations: number;
    overdueOrCriticalObligations: number;
    pendingApprovals: number;
    authoritativeDocuments: number;
    documentsAwaitingReview: number;
    unapprovedSubstantiveCommunications: number;
    invoicedXaf: number;
    receivedXaf: number;
    outstandingXaf: number;
  };
  obligations: Array<{
    id: string;
    title: string;
    legal_basis: string | null;
    due_at: string | null;
    consequence: string | null;
    status: string;
    severity: string;
  }>;
  approvals: Array<{
    id: string;
    approval_type: string;
    subject_type: string;
    requested_at: string;
  }>;
  documents: {
    authoritative: Array<{
      id: string;
      title: string;
      lifecycle_state: string;
      authoritative_version: number;
    }>;
    awaitingReview: Array<{
      id: string;
      title: string;
      lifecycle_state: string;
      authoritative_version: number;
    }>;
  };
  riskFlags: Array<{
    key: string;
    severity: string;
    label: string;
    detail: string;
  }>;
  team: Array<{
    lawyer_id: string;
    is_primary: boolean;
    lawyers:
      | { id: string; full_name: string; role: string }
      | Array<{ id: string; full_name: string; role: string }>
      | null;
  }>;
  recentEvents: Array<{
    id: string;
    event_type: string;
    actor_name: string | null;
    reason: string | null;
    occurred_at: string;
  }>;
};

type Payload = {
  success: boolean;
  commandCenter?: CommandCenter;
  error?: string;
};

function xaf(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function cardClass(alert = false) {
  return [
    "rounded-[1.35rem] border p-4",
    alert
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white",
  ].join(" ");
}

export default function MatterCommandCenter({ matterId }: { matterId: string }) {
  const [data, setData] = useState<CommandCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/command-center`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.success || !payload.commandCenter) {
        throw new Error(payload.error || "Unable to load matter command center.");
      }
      setData(payload.commandCenter);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load matter command center."
      );
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const primaryTeam = useMemo(() => {
    if (!data) return [];
    return data.team.map((item) => {
      const lawyer = Array.isArray(item.lawyers) ? item.lawyers[0] : item.lawyers;
      return {
        id: item.lawyer_id,
        isPrimary: item.is_primary,
        name: lawyer?.full_name || "Assigned lawyer",
        role: lawyer?.role || "Matter team",
      };
    });
  }, [data]);

  if (loading) {
    return (
      <section className="rounded-[1.7rem] border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading matter command center…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-[1.7rem] border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-900">
          Matter command center unavailable
        </p>
        <p className="mt-2 text-sm leading-6 text-red-800">
          {error || "No command-center data returned."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-900"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </section>
    );
  }

  const alerting =
    data.summary.overdueOrCriticalObligations > 0 ||
    data.summary.unapprovedSubstantiveCommunications > 0 ||
    data.summary.pendingApprovals > 0;

  return (
    <section className="space-y-4 rounded-[1.7rem] border border-slate-200 bg-[#f8faf9] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Matter command center
          </p>
          <h2 className="mt-2 text-2xl heading-serif text-heritage-green">
            What needs attention now
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Live operational truth for obligations, approvals, document authority,
            client communication, finance, team and matter risk.
          </p>
        </div>

        <div
          className={[
            "rounded-[1.2rem] px-4 py-3",
            alerting ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            {alerting ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.16em]">
              {alerting ? "Attention required" : "No critical queue"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className={cardClass(data.summary.overdueOrCriticalObligations > 0)}>
          <CalendarClock className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {data.summary.openObligations}
          </p>
          <p className="text-xs text-slate-500">Open obligations</p>
          {data.summary.overdueOrCriticalObligations > 0 && (
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
              {data.summary.overdueOrCriticalObligations} critical/overdue
            </p>
          )}
        </div>

        <div className={cardClass(data.summary.pendingApprovals > 0)}>
          <BadgeCheck className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {data.summary.pendingApprovals}
          </p>
          <p className="text-xs text-slate-500">Pending approvals</p>
        </div>

        <div className={cardClass()}>
          <FileCheck2 className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {data.summary.authoritativeDocuments}
          </p>
          <p className="text-xs text-slate-500">Authoritative documents</p>
        </div>

        <div className={cardClass(data.summary.documentsAwaitingReview > 0)}>
          <FileClock className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {data.summary.documentsAwaitingReview}
          </p>
          <p className="text-xs text-slate-500">Awaiting review</p>
        </div>

        <div
          className={cardClass(
            data.summary.unapprovedSubstantiveCommunications > 0
          )}
        >
          <MessageSquareWarning className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {data.summary.unapprovedSubstantiveCommunications}
          </p>
          <p className="text-xs text-slate-500">Legal messages awaiting approval</p>
        </div>

        <div className={cardClass(data.summary.outstandingXaf > 0)}>
          <CircleDollarSign className="h-4 w-4 text-heritage-green" />
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {xaf(data.summary.outstandingXaf)}
          </p>
          <p className="text-xs text-slate-500">Outstanding finance</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Priority obligations
                </p>
                <h3 className="mt-1 text-lg font-semibold text-heritage-green">
                  Deadlines and duties
                </h3>
              </div>
              <CalendarClock className="h-5 w-5 text-heritage-green" />
            </div>

            <div className="mt-4 space-y-2">
              {data.obligations.length ? (
                data.obligations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.legal_basis || item.consequence || "Matter obligation"}
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                        {dateLabel(item.due_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No open governed obligations.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Risk queue
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {data.riskFlags.length ? (
                data.riskFlags.map((flag) => (
                  <div
                    key={flag.key}
                    className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-amber-950">
                      {flag.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      {flag.detail}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No elevated governed risk flags.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-heritage-green" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Responsible team
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {primaryTeam.length ? (
                primaryTeam.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">{member.role}</p>
                    </div>
                    {member.isPrimary && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                        Primary
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No team members returned.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Matter controls
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Security
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {data.matter.securityClassification}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Ethical wall
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {data.matter.ethicalWallEnabled ? "Enabled" : "Not enabled"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Jurisdiction
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {data.matter.jurisdiction}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Risk
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {data.matter.riskLevel}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Recent institutional events
            </p>
            <div className="mt-3 space-y-2">
              {data.recentEvents.length ? (
                data.recentEvents.slice(0, 6).map((event) => (
                  <div key={event.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-xs font-semibold text-slate-700">
                      {event.event_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {event.actor_name || "TSIDEK"} · {dateLabel(event.occurred_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No event history yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
