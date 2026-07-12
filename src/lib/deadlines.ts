import { format } from "date-fns";
import { DeadlineCalculator } from "@/lib/deadline-engine/calculator";
import { OHADA_RULES } from "@/lib/deadline-engine/rules";

export type MatterDeadlinePreview = {
  ruleKey: string;
  ruleName: string;
  triggerEvent: string;
  description: string;
  computationType: "CALENDAR" | "WORKING" | "FRANC";
  days: number;
  startDate: string;
  deadlineDate: string;
  deadlineLabel: string;
  warning: string;
  recommendedAction: string;
};

export function calculateMatterDeadline(input: { ruleKey: string; startDate: string }) {
  const rule = OHADA_RULES[input.ruleKey];

  if (!rule) {
    throw new Error("Unsupported deadline rule.");
  }

  if (!input.startDate) {
    throw new Error("A trigger date is required.");
  }

  const triggerDate = new Date(`${input.startDate}T12:00:00`);

  if (Number.isNaN(triggerDate.getTime())) {
    throw new Error("The trigger date is invalid.");
  }

  const deadline = DeadlineCalculator.calculateDeadline(triggerDate, rule.days, rule.type);

  return {
    ruleKey: input.ruleKey,
    ruleName: rule.name,
    triggerEvent: rule.triggerEvent,
    description: rule.description,
    computationType: rule.type,
    days: rule.days,
    startDate: input.startDate,
    deadlineDate: format(deadline, "yyyy-MM-dd"),
    deadlineLabel: format(deadline, "dd MMM yyyy"),
    warning:
      rule.type === "FRANC"
        ? "OHADA franc-day logic applied, then extended to the next working day when needed."
        : "Weekend and public-holiday extension applied when the calculated day is not workable.",
    recommendedAction: `Record the ${rule.name.toLowerCase()} deadline in the matter task list and send a client-safe status note once it is confirmed.`,
  } satisfies MatterDeadlinePreview;
}
