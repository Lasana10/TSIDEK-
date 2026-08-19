"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

const states = [
  "PROSPECT",
  "CONFLICT_REVIEW",
  "ENGAGEMENT",
  "OPEN",
  "ACTIVE",
  "WAITING_EXTERNAL",
  "CLOSING",
  "CLOSED",
  "ARCHIVED",
] as const;

type LifecycleState = (typeof states)[number];

type LifecyclePayload = {
  success: boolean;
  lifecycle?: {
    matterId: string;
    firmId: string;
    state: LifecycleState;
    events: Array<{
      id: string;
      event_type: string;
      previous_state: string | null;
      new_state: string | null;
      actor_name: string | null;
      reason: string | null;
      occurred_at: string;
    }>;
  };
  error?: string;
};

const labels: Record<LifecycleState, string> = {
  PROSPECT: "Prospect",
  CONFLICT_REVIEW: "Conflict review",
  ENGAGEMENT: "Engagement",
  OPEN: "Opened",
  ACTIVE: "Active work",
  WAITING_EXTERNAL: "Waiting external",
  CLOSING: "Closing",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

const nextByState: Partial<Record<LifecycleState, LifecycleState[]>> = {
  PROSPECT: ["CONFLICT_REVIEW"],
  CONFLICT_REVIEW: ["ENGAGEMENT", "PROSPECT"],
  ENGAGEMENT: ["OPEN", "CONFLICT_REVIEW"],
  OPEN: ["ACTIVE", "CLOSING"],
  ACTIVE: ["WAITING_EXTERNAL", "CLOSING"],
  WAITING_EXTERNAL: ["ACTIVE", "CLOSING"],
  CLOSING: ["ACTIVE", "CLOSED"],
  CLOSED: ["ARCHIVED"],
};

export default function MatterLifecycleBar({ matterId }: { matterId: string }) {
  const [payload, setPayload] = useState<LifecyclePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState<LifecycleState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/lifecycle`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json()) as LifecyclePayload;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load governed matter lifecycle.");
      }
      setPayload(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load matter lifecycle.");
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentState = payload?.lifecycle?.state ?? null;
  const currentIndex = currentState ? states.indexOf(currentState) : -1;
  const nextStates = currentState ? nextByState[currentState] ?? [] : [];

  const latestTransition = useMemo(() => {
    const events = payload?.lifecycle?.events ?? [];
    return [...events]
      .reverse()
      .find((event) => event.event_type === "MATTER_LIFECYCLE_TRANSITION");
  }, [payload]);

  async function transition(targetState: LifecycleState) {
    setTransitioning(targetState);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/lifecycle`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetState,
          reason: `Matter lifecycle advanced to ${labels[targetState]} from the matter command surface.`,
        }),
      });
      const data = (await response.json()) as LifecyclePayload;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to update matter lifecycle.");
      }
      setPayload(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update matter lifecycle.");
    } finally {
      setTransitioning(null);
    }
  }

  return (
    <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-heritage-green" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Governed matter lifecycle
            </p>
          </div>
          <h2 className="mt-2 text-xl heading-serif text-heritage-green">
            Operational state, not a decorative status
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Every transition is permission-checked and preserved in the matter event history.
          </p>
        </div>

        {currentState && (
          <div className="rounded-[1.2rem] bg-[#082b22] px-4 py-3 text-white">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
              Current state
            </p>
            <p className="mt-1 text-sm font-semibold">{labels[currentState]}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading governed lifecycle…
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-semibold text-amber-900">Lifecycle unavailable</p>
          <p className="mt-1 text-sm text-amber-800">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-amber-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-[860px] items-center">
              {states.map((state, index) => {
                const complete = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <div key={state} className="flex flex-1 items-center">
                    <div className="flex min-w-[86px] flex-col items-center text-center">
                      <div
                        className={[
                          "grid h-8 w-8 place-items-center rounded-full border",
                          complete
                            ? "border-heritage-green bg-heritage-green text-white"
                            : active
                              ? "border-gold-accent bg-gold-accent/15 text-heritage-green"
                              : "border-slate-200 bg-white text-slate-300",
                        ].join(" ")}
                      >
                        {complete ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <CircleDot className="h-4 w-4" />
                        )}
                      </div>
                      <span
                        className={[
                          "mt-2 text-[9px] font-black uppercase tracking-[0.12em]",
                          active ? "text-heritage-green" : "text-slate-400",
                        ].join(" ")}
                      >
                        {labels[state]}
                      </span>
                    </div>
                    {index < states.length - 1 && (
                      <div
                        className={[
                          "h-px flex-1",
                          index < currentIndex ? "bg-heritage-green" : "bg-slate-200",
                        ].join(" ")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs leading-5 text-slate-500">
              {latestTransition ? (
                <>
                  Last transition by{" "}
                  <span className="font-semibold text-slate-700">
                    {latestTransition.actor_name || "TSIDEK actor"}
                  </span>
                  {latestTransition.reason ? ` — ${latestTransition.reason}` : ""}
                </>
              ) : (
                "No lifecycle transition has yet been recorded for this matter."
              )}
            </div>

            {nextStates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nextStates.map((target) => (
                  <button
                    key={target}
                    type="button"
                    disabled={Boolean(transitioning)}
                    onClick={() => void transition(target)}
                    className="inline-flex items-center gap-2 rounded-full border border-heritage-green/15 bg-heritage-green/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-heritage-green transition hover:bg-heritage-green hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {transitioning === target ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                    Move to {labels[target]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
