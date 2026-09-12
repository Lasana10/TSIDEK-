import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ClientIntakeV2 from "@/components/ClientIntakeV2";

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-paper-white">
      <div className="px-4 pt-6 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to workspace
          </Link>
        </div>
      </div>
      <ClientIntakeV2 />
    </div>
  );
}
