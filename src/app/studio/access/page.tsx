import Link from "next/link";
import { ArrowLeft, Building2, ShieldCheck, UsersRound } from "lucide-react";
import FirmAccessPanel from "@/components/FirmAccessPanel";

export default function FirmAccessStudioPage() {
  return (
    <main className="min-h-screen bg-[#f3f5f2] px-4 py-6 text-slate-900 md:px-7 xl:px-10">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4" /> Firm Studio</Link>
          <Link href="/people" className="inline-flex items-center gap-2 rounded-xl bg-[#082b22] px-4 py-2.5 text-xs font-bold text-white"><UsersRound className="h-4 w-4" /> People & performance</Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] text-white shadow-[0_28px_80px_rgba(8,43,34,0.16)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-7 md:p-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/60"><Building2 className="h-3.5 w-3.5 text-[#dfc47f]" /> Firm authority</div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Establish people through governed membership.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Invite, establish and revoke access from one authority surface. Roles become effective only through accepted firm membership and remain constrained by matter authorization, ethical walls and server-side permissions.</p>
            </div>
            <div className="border-t border-white/10 bg-white/[0.045] p-6 xl:border-l xl:border-t-0">
              <ShieldCheck className="h-5 w-5 text-[#dfc47f]" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Security principle</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/80">No frontend role switch grants authority. The active firm membership is the source of truth.</p>
            </div>
          </div>
        </section>

        <FirmAccessPanel />
      </div>
    </main>
  );
}
