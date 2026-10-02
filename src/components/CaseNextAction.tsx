"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, MessageSquareText, Scale, WalletCards } from "lucide-react";

type Summary = {
  openObligations: number;
  overdueOrCriticalObligations: number;
  pendingApprovals: number;
  authoritativeDocuments: number;
  documentsAwaitingReview: number;
  unapprovedSubstantiveCommunications: number;
  outstandingXaf: number;
};

type CommandCenterPayload = {
  success: boolean;
  commandCenter?: { summary: Summary };
};

type Recommendation = {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export default function CaseNextAction({ matterId }: { matterId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/matters/${matterId}/command-center`, {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as CommandCenterPayload;
        if (!cancelled && response.ok && payload.success && payload.commandCenter) {
          setSummary(payload.commandCenter.summary);
        }
      } catch {
        // Keep the case room usable even when the advisory layer is temporarily unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  const recommendation = useMemo<Recommendation>(() => {
    if (!summary) {
      return {
        eyebrow: "Continue the case",
        title: "Open the working file",
        detail: "Start with the evidence and documents already attached to this matter.",
        href: `/matters/${matterId}?tab=documents`,
        cta: "Open documents",
      };
    }

    if (summary.overdueOrCriticalObligations > 0) {
      return {
        eyebrow: "Priority now",
        title: `${summary.overdueOrCriticalObligations} critical or overdue obligation${summary.overdueOrCriticalObligations === 1 ? "" : "s"}`,
        detail: "Deal with deadlines and duties before routine work so the case cannot quietly drift into avoidable risk.",
        href: `/matters/${matterId}#attention`,
        cta: "Review obligations",
      };
    }

    if (summary.documentsAwaitingReview > 0) {
      return {
        eyebrow: "Partner review",
        title: `${summary.documentsAwaitingReview} document${summary.documentsAwaitingReview === 1 ? "" : "s"} awaiting review`,
        detail: "Move working drafts toward an authoritative case record before they are relied on or shared.",
        href: `/matters/${matterId}?tab=documents`,
        cta: "Review documents",
      };
    }

    if (summary.pendingApprovals > 0 || summary.unapprovedSubstantiveCommunications > 0) {
      const count = summary.pendingApprovals + summary.unapprovedSubstantiveCommunications;
      return {
        eyebrow: "Decision queue",
        title: `${count} approval${count === 1 ? "" : "s"} need attention`,
        detail: "Clear legal communications and governed decisions so the team can keep moving without bypassing review.",
        href: `/matters/${matterId}?tab=collaboration`,
        cta: "Open approvals",
      };
    }

    if (summary.authoritativeDocuments === 0) {
      return {
        eyebrow: "Build the record",
        title: "No authoritative document yet",
        detail: "Capture the first reliable document or evidence item so the case starts from a controlled source of truth.",
        href: `/matters/${matterId}?tab=documents`,
        cta: "Add case material",
      };
    }

    if (summary.outstandingXaf > 0) {
      return {
        eyebrow: "Case economics",
        title: "Money is still outstanding",
        detail: "Check invoices, receipts and matter costs while the legal work remains current and easy to reconcile.",
        href: `/matters/${matterId}/accounting`,
        cta: "Review economics",
      };
    }

    return {
      eyebrow: "Case on track",
      title: "Move the legal strategy forward",
      detail: "The immediate control queues are clear. Continue with analysis, preparation and the next substantive step.",
      href: `/matters/${matterId}?tab=strategy`,
      cta: "Open strategy",
    };
  }, [matterId, summary]);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,.75fr)]">
      <div className="overflow-hidden rounded-[1.8rem] border border-[#17483c]/15 bg-white shadow-sm">
        <div className="flex h-full flex-col justify-between gap-6 p-6 md:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#edf4f0] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-[#0b493b]">
              <Scale className="h-3.5 w-3.5" /> {recommendation.eyebrow}
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-[-.025em] text-slate-900 md:text-3xl">{recommendation.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{recommendation.detail}</p>
          </div>
          <Link href={recommendation.href} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-3 text-xs font-black uppercase tracking-[.13em] text-white shadow-sm transition hover:-translate-y-px">
            {recommendation.cta}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Quick href={`/matters/${matterId}?tab=documents`} icon={<FileText className="h-4 w-4" />} title="Documents & evidence" text="Capture, review and rely on the case record." />
        <Quick href={`/matters/${matterId}?tab=collaboration`} icon={<MessageSquareText className="h-4 w-4" />} title="Team & approvals" text="Move assignments and governed decisions forward." />
        <Quick href={`/matters/${matterId}/accounting`} icon={<WalletCards className="h-4 w-4" />} title="Time & economics" text="See fees, expenses, receipts and outstanding money." />
      </div>
    </section>
  );
}

function Quick({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0b493b]/30 hover:shadow-md">
      <div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0b493b]" />
    </Link>
  );
}
