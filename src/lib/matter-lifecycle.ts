export const MATTER_LIFECYCLE_STATES = [
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

export type MatterLifecycleState = (typeof MATTER_LIFECYCLE_STATES)[number];

export const MATTER_LIFECYCLE_TRANSITIONS: Record<
  MatterLifecycleState,
  readonly MatterLifecycleState[]
> = {
  PROSPECT: ["CONFLICT_REVIEW"],
  CONFLICT_REVIEW: ["ENGAGEMENT", "PROSPECT"],
  ENGAGEMENT: ["OPEN", "CONFLICT_REVIEW"],
  OPEN: ["ACTIVE", "CLOSING"],
  ACTIVE: ["WAITING_EXTERNAL", "CLOSING"],
  WAITING_EXTERNAL: ["ACTIVE", "CLOSING"],
  CLOSING: ["ACTIVE", "CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function isMatterLifecycleState(value: unknown): value is MatterLifecycleState {
  return (
    typeof value === "string" &&
    (MATTER_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function canTransitionMatterLifecycle(
  from: MatterLifecycleState,
  to: MatterLifecycleState
) {
  return MATTER_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function assertMatterLifecycleTransition(
  from: MatterLifecycleState,
  to: MatterLifecycleState
) {
  if (!canTransitionMatterLifecycle(from, to)) {
    throw new Error(`Invalid matter lifecycle transition: ${from} -> ${to}.`);
  }
}

export type MatterLifecycleEvent = {
  id: string;
  matterId: string;
  firmId: string;
  eventType: string;
  previousState: MatterLifecycleState | null;
  newState: MatterLifecycleState | null;
  actorLawyerId: string | null;
  actorName: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};
