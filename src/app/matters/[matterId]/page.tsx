import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, ChevronRight, Landmark, ShieldCheck } from "lucide-react";
import MatterWorkspace from "@/components/MatterWorkspace";
import MatterWorkflowPanel from "@/components/MatterWorkflowPanel";
import MatterActivityPanel from "@/components/MatterActivityPanel";
import MatterCommandCenter from "@/components/MatterCommandCenter";
import MatterControlDesk from "@/components/MatterControlDesk";
import ClientAccessPanel from "@/components/ClientAccessPanel";
import PracticeExecutionPanel from "@/components/PracticeExecutionPanel";
import FinanceTransparencyPanel from "@/components/FinanceTransparencyPanel";
import MatterClosurePanel from "@/components/MatterClosurePanel";
import ProcedureGuidancePanel from "@/components/ProcedureGuidancePanel";
import CaseRecordActions from "@/components/CaseRecordActions";
import { getMatterWorkspaceByIdServer } from "@/lib/matters.server";
import { resolveRequestScope } from "@/lib/request-scope";
import type { WorkspaceTab } from "@/components/MatterWorkspace";

function resolveWorkspaceTab(value:string|string[]|undefined):WorkspaceTab{
  const tab=Array.isArray(value)?value[0]:value;
  switch(tab){
    case"documents":case"strategy":case"studio":case"intelligence":case"collaboration":case"governance":case"finance":case"overview":return tab;
    default:return"overview";
  }
}

export default async function MatterDetailPage({params,searchParams}:{params:Promise<{matterId:string}>;searchParams?:Promise<{tab?:string|string[]}>}){
  const{matterId}=await params;
  const resolvedSearchParams=searchParams?await searchParams:undefined;
  const activeTab=resolveWorkspaceTab(resolvedSearchParams?.tab);
  const headerStore=await headers();
  const scope=await resolveRequestScope(new Request("http://tsidek.local/internal",{headers:headerStore}));
  const matter=await getMatterWorkspaceByIdServer(matterId,scope);
  if(!matter)notFound();

  return <main className="min-h-screen bg-[#f3f5f2] px-4 py-5 text-slate-900 md:px-7 md:py-8 xl:px-10">
    <div className="mx-auto max-w-[1680px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/matters" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4"/>Case portfolio</Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/matters/${matterId}/accounting`} className="rounded-xl border border-[#0b493b] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0b493b]">Economics & time</Link>
          <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-bold text-[#0b493b]">Firm workspace<ChevronRight className="h-4 w-4"/></Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] text-white shadow-[0_28px_80px_rgba(8,43,34,.16)]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative p-7 md:p-9">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] text-white/60"><BriefcaseBusiness className="h-3.5 w-3.5 text-[#dfc47f]"/>Case room</div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-white/40">{matter.clientName} · {matter.matterType}</p>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-[-.04em] md:text-5xl">{matter.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">The working record for this case: work, evidence, communication, money, access and closure in one place.</p>
            <div className="mt-6 flex flex-wrap gap-2"><Pill>{matter.status}</Pill><Pill>{matter.riskLevel} risk</Pill><Pill>{matter.jurisdiction}</Pill>{matter.ethicalWallEnabled?<Pill>Ethical wall</Pill>:null}</div>
          </div>
          <aside className="border-t border-white/10 bg-white/[.045] p-6 xl:border-l xl:border-t-0">
            <ShieldCheck className="h-5 w-5 text-[#dfc47f]"/>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[.18em] text-white/35">Case reference</p>
            <p className="mt-1 text-sm font-bold">{matter.physicalFileId}</p>
            <div className="mt-5 space-y-3 border-t border-white/10 pt-5"><Meta label="Lead lawyer" value={matter.leadLawyer}/><Meta label="Project manager" value={matter.projectManager}/><Meta label="Classification" value={matter.securityClassification}/></div>
          </aside>
        </div>
      </section>

      <section aria-label="Case workspace"><MatterWorkspace matter={matter} initialTab={activeTab}/></section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Attention & activity" title="What needs attention now" text="Current obligations, approvals, risk and the chronological case record are shown together instead of in competing dashboards."/>
        <MatterCommandCenter matterId={matterId}/>
        <MatterActivityPanel matterId={matterId}/>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Procedure & execution" title="Move the case forward" text="Workflow, deadlines, procedure and practice execution sit in one operational lane."/>
        <MatterWorkflowPanel matterId={matterId}/>
        <ProcedureGuidancePanel matterId={matterId}/>
        <PracticeExecutionPanel matterId={matterId}/>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Client & money" title="Service, instructions and economics" text="Client access and the case financial picture stay together while remaining permissioned."/>
        <ClientAccessPanel matterId={matterId}/>
        <FinanceTransparencyPanel matterId={matterId}/>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Control & closure" title="Protect the record and close it properly" text="Access controls, final checks, archiving and reusable institutional knowledge are handled at the end of the case lifecycle."/>
        <MatterControlDesk matterId={matterId}/>
        <MatterClosurePanel matterId={matterId}/>
        <CaseRecordActions matterId={matterId}/>
      </section>
    </div>
  </main>
}

function Pill({children}:{children:React.ReactNode}){return <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-white/75">{children}</span>}
function Meta({label,value}:{label:string;value:string}){return <div><p className="text-[9px] font-black uppercase tracking-[.13em] text-white/30">{label}</p><p className="mt-1 text-xs font-semibold text-white/75">{value||"Not assigned"}</p></div>}
function SectionTitle({eyebrow,title,text}:{eyebrow:string;title:string;text:string}){return <div className="flex items-start gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-5"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><Landmark className="h-4 w-4"/></div><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0f5b49]">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>}
