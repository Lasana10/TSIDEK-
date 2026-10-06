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
import CaseIdentityPanel from "@/components/CaseIdentityPanel";
import CaseNextAction from "@/components/CaseNextAction";
import AdaptiveMatterLayer from "@/components/AdaptiveMatterLayer";
import AdaptiveMatterActions from "@/components/AdaptiveMatterActions";
import MatterOperatingChain from "@/components/MatterOperatingChain";
import MatterOperatingActions from "@/components/MatterOperatingActions";
import { getMatterWorkspaceByIdServer } from "@/lib/matters.server";
import { resolveRequestScope } from "@/lib/request-scope";
import type { WorkspaceTab } from "@/components/MatterWorkspace";

function resolveWorkspaceTab(value:string|string[]|undefined):WorkspaceTab{
  const tab=Array.isArray(value)?value[0]:value;
  switch(tab){case"documents":case"studio":case"collaboration":case"governance":case"finance":case"overview":return tab;default:return"overview";}
}
function natureLabel(value?:string){switch(value){case"contentious":return"Contentious";case"transactional":return"Transactional";case"registration":return"Registration / filing";case"advisory":return"Advisory";case"diligence":return"Review / diligence";case"compliance":return"Compliance";default:return"Adaptive matter";}}

export default async function MatterDetailPage({params,searchParams}:{params:Promise<{matterId:string}>;searchParams?:Promise<{tab?:string|string[]}>}){
  const{matterId}=await params;
  const resolvedSearchParams=searchParams?await searchParams:undefined;
  const activeTab=resolveWorkspaceTab(resolvedSearchParams?.tab);
  const headerStore=await headers();
  const scope=await resolveRequestScope(new Request("http://tsidek.local/internal",{headers:headerStore}));
  const matter=await getMatterWorkspaceByIdServer(matterId,scope);
  if(!matter)notFound();
  const activeWorkstream=matter.workstreams?.find(item=>item.status==="active")??matter.workstreams?.find(item=>item.status!=="completed");
  const nextMilestone=matter.milestones?.find(item=>!["completed","waived"].includes(item.status));

  return <main className="min-h-screen bg-[#f3f5f2] px-4 py-5 text-slate-900 md:px-7 md:py-8 xl:px-10">
    <div className="mx-auto max-w-[1680px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/matters" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4"/>Case portfolio</Link>
        <div className="flex flex-wrap gap-2"><Link href="/workroom" className="rounded-xl border border-[#0b493b]/20 bg-white px-3.5 py-2.5 text-xs font-bold text-[#0b493b]">Workroom</Link><Link href={`/matters/${matterId}/accounting`} className="rounded-xl border border-[#0b493b] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0b493b]">Economics & time</Link><Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-bold text-[#0b493b]">Firm workspace<ChevronRight className="h-4 w-4"/></Link></div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-[#17483c]/20 bg-[#082b22] text-white shadow-[0_28px_80px_rgba(8,43,34,.16)]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative p-7 md:p-9"><div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] text-white/60"><BriefcaseBusiness className="h-3.5 w-3.5 text-[#dfc47f]"/>{natureLabel(matter.engagementNature)}</div><p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-white/40">{matter.clientName} · {matter.matterType}</p><h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-[-.04em] md:text-5xl">{matter.title}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">{matter.synopsis}</p><div className="mt-6 flex flex-wrap gap-2"><Pill>{matter.status}</Pill><Pill>{matter.riskLevel} risk</Pill><Pill>{matter.jurisdiction}</Pill>{matter.practiceArea?<Pill>{matter.practiceArea}</Pill>:null}{matter.ethicalWallEnabled?<Pill>Ethical wall</Pill>:null}</div></div>
          <aside className="border-t border-white/10 bg-white/[.045] p-6 xl:border-l xl:border-t-0"><ShieldCheck className="h-5 w-5 text-[#dfc47f]"/><p className="mt-5 text-[9px] font-black uppercase tracking-[.18em] text-white/35">Case reference</p><p className="mt-1 text-sm font-bold">{matter.physicalFileId}</p><div className="mt-5 space-y-3 border-t border-white/10 pt-5"><Meta label="Lead lawyer" value={matter.leadLawyer}/><Meta label="Plan" value={matter.planLabel??matter.primaryTrack}/><Meta label="Classification" value={matter.securityClassification}/></div></aside>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><AdaptiveCard label="Client objective" value={matter.clientObjective??matter.synopsis}/><AdaptiveCard label="Current workstream" value={activeWorkstream?.name??matter.primaryTrack}/><AdaptiveCard label="Next milestone" value={nextMilestone?.title??matter.nextDraft}/><AdaptiveCard label="Risk to watch" value={matter.riskToMonitor}/></section>

      <section className="space-y-4">
        <SectionTitle eyebrow="Matter command" title="What matters now and what happens next" text="TSID leads with one live Matter plan and one contextual Room. Strategy, intelligence and evidence are inside that Room rather than competing beside it."/>
        <MatterOperatingChain matterId={matterId} scope={scope}/>
        <CaseNextAction matterId={matterId}/>
        <AdaptiveMatterLayer matter={matter} scope={scope}/>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="Act" title="Judgment, instructions and execution" text="Record the decision or instruction once, execute it from the governed Matter, and keep the result on the same legal record."/>
        <AdaptiveMatterActions matterId={matterId}/>
        <MatterOperatingActions matterId={matterId}/>
      </section>

      <Disclosure title="Case file & collaboration" description="Documents, case file, collaboration, governance and finance tools. Strategy and legal intelligence stay in the canonical Matter Room above.">
        <CaseIdentityPanel matterId={matterId}/>
        <section aria-label="Case workspace"><MatterWorkspace matter={matter} initialTab={activeTab}/></section>
      </Disclosure>

      <Disclosure title="Attention & activity" description="Operational obligations, approvals, risk and the chronological case record.">
        <MatterCommandCenter matterId={matterId}/><MatterActivityPanel matterId={matterId}/>
      </Disclosure>

      <Disclosure title="Firm process & procedure" description="Internal process gates, source-backed procedural guidance and specialist docket support. These support the Matter plan; they do not replace it.">
        <MatterWorkflowPanel matterId={matterId}/><ProcedureGuidancePanel matterId={matterId}/><PracticeExecutionPanel matterId={matterId}/>
      </Disclosure>

      <Disclosure title="Client & money" description="Client access, instructions visibility and Matter economics.">
        <ClientAccessPanel matterId={matterId}/><FinanceTransparencyPanel matterId={matterId}/>
      </Disclosure>

      <Disclosure title="Control & closure" description="Access controls, close-out checks and archiving. Reusable learning is captured through the canonical Outcome & Knowledge flow above.">
        <MatterControlDesk matterId={matterId}/><MatterClosurePanel matterId={matterId}/><CaseRecordActions matterId={matterId}/>
      </Disclosure>
    </div>
  </main>
}

function Pill({children}:{children:React.ReactNode}){return <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-white/75">{children}</span>}
function Meta({label,value}:{label:string;value:string}){return <div><p className="text-[9px] font-black uppercase tracking-[.13em] text-white/30">{label}</p><p className="mt-1 text-xs font-semibold text-white/75">{value||"Not assigned"}</p></div>}
function AdaptiveCard({label,value}:{label:string;value:string}){return <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#0f5b49]">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{value}</p></div>}
function SectionTitle({eyebrow,title,text}:{eyebrow:string;title:string;text:string}){return <div className="flex items-start gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-5"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><Landmark className="h-4 w-4"/></div><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0f5b49]">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>}
function Disclosure({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <details className="group rounded-[1.6rem] border border-slate-200 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 md:p-6"><div><h2 className="text-lg font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div><span className="rounded-xl bg-[#edf4f0] px-3 py-2 text-xs font-black text-[#0b493b] group-open:hidden">Open</span><span className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 group-open:inline">Close</span></summary><div className="space-y-5 border-t border-slate-100 p-5 md:p-6">{children}</div></details>}
