import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import IntakeWorkflow from "@/components/IntakeWorkflow";

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-paper-white">
      <div className="px-6 pt-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to TSIDEK OS
          </Link>
        </div>
      </div>
      <IntakeWorkflow />
    </div>
  );
}
