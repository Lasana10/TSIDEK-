import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import MatterWorkspace from "@/components/MatterWorkspace";
import { getMatterWorkspaceByIdServer } from "@/lib/matters.server";
import { resolveRequestScope } from "@/lib/request-scope";
import type { WorkspaceTab } from "@/components/MatterWorkspace";

function resolveWorkspaceTab(value: string | string[] | undefined): WorkspaceTab {
  const tab = Array.isArray(value) ? value[0] : value;
  switch (tab) {
    case "documents":
    case "strategy":
    case "studio":
    case "intelligence":
    case "collaboration":
    case "governance":
    case "finance":
    case "overview":
      return tab;
    default:
      return "overview";
  }
}

export default async function MatterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ matterId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { matterId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const headerStore = await headers();
  const scope = await resolveRequestScope(new Request("http://tsidek.local/internal", { headers: headerStore }));
  const matter = await getMatterWorkspaceByIdServer(matterId, scope);

  if (!matter) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-paper-white px-6 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-[linear-gradient(160deg,_#083126_0%,_#0f4938_58%,_#c5a059_170%)] p-6 text-white shadow-[0_20px_44px_rgba(0,54,41,0.18)] md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to TSIDEK OS
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/50">Route-backed matter room</p>
              <h1 className="mt-2 text-3xl heading-serif text-white">{matter.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/72">
                Dedicated matter route for documents, strategy, governance, live collaboration, and paper-file linkage.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gold-accent" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Controlled access</p>
                <p className="text-sm font-semibold">{matter.physicalFileId}</p>
              </div>
            </div>
          </div>
        </div>

        <MatterWorkspace matter={matter} initialTab={resolveWorkspaceTab(resolvedSearchParams?.tab)} />
      </div>
    </div>
  );
}
