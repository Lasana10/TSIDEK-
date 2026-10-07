import { BadgeCheck, FileCheck2, Handshake, MessagesSquare, Scale, Sparkles, Target } from "lucide-react";
import type { MatterWorkspaceData } from "@/lib/matters";
import { resolveAdaptiveRoom } from "@/lib/matter-adaptive-runtime";
import { getMatterOperatingSystem } from "@/lib/matter-operating-system.server";
import MatterIntelligencePanel from "@/components/MatterIntelligencePanel";
import type { RequestScope } from "@/lib/request-scope";
import { getServerLocale } from "@/lib/locale-server";
import { t } from "@/lib/i18n";

type Focus={label:string;value:string};

function roomFocus(matter:MatterWorkspaceData,input:{active:string;milestone:string;evidence:string;decisions:string;instructions:string;claims:string;execution:string}):Focus[]{
 switch(matter.engagementNature){
  case"contentious":return[{label:"Theory & issues",value:input.claims},{label:"Evidence posture",value:input.evidence},{label:"Next procedural move",value:input.milestone}];
  case"transactional":return[{label:"Deal workstream",value:input.active},{label:"Negotiation / approvals",value:input.decisions},{label:"Next closing / execution",value:input.execution}];
  case"registration":return[{label:"Dossier / filing stream",value:input.active},{label:"Authority evidence",value:input.evidence},{label:"Next authority step",value:input.execution}];
  case"diligence":return[{label:"Review scope",value:input.active},{label:"Verified findings",value:input.claims},{label:"Report milestone",value:input.milestone}];
  case"advisory":return[{label:"Question & reasoning",value:input.claims},{label:"Client position",value:input.instructions},{label:"Advice / delivery",value:input.milestone}];
  case"compliance":return[{label:"Obligation stream",value:input.active},{label:"Evidence / remediation",value:input.evidence},{label:"Next compliance action",value:input.execution}];
  default:return[{label:"Working now",value:input.active},{label:"Professional judgment",value:input.decisions},{label:"Next proof point",value:input.milestone}];
 }
}

export default async function AdaptiveMatterLayer({matter,scope}:{matter:MatterWorkspaceData;scope:RequestScope}){
 const locale=await getServerLocale();
 const tr=(key:string,fallback:string)=>t(locale,key,fallback);
 const room=resolveAdaptiveRoom(matter);
 const operating=await getMatterOperatingSystem({matterId:matter.id,scope});
 const runtime=operating.adaptive;
 const intelligence=operating.intelligence;
 const active=operating.workstreams.find(x=>x.status==="active")??operating.workstreams.find(x=>!["completed","cancelled"].includes(x.status));
 const milestone=operating.milestones.find(x=>!["completed","waived"].includes(x.status));
 const execution=operating.executions.find(x=>!["completed","cancelled"].includes(x.status));
 const verifiedEvidence=runtime.evidence.filter(x=>["verified","corroborated"].includes(x.verification_status)).length;
 const approvedDecisions=runtime.decisions.filter(x=>x.status==="approved").length;
 const confirmedInstructions=runtime.instructions.filter(x=>x.confirmation_status==="confirmed").length;
 const verifiedClaims=intelligence.claims.filter(x=>["verified","corroborated"].includes(x.verification_status)).length;
 const openClaims=intelligence.claims.filter(x=>x.verification_status==="unverified").length;
 const focuses=roomFocus(matter,{
  active:active?.name??matter.primaryTrack,
  milestone:milestone?.title??matter.nextDraft,
  evidence:`${verifiedEvidence}/${runtime.evidence.length} verified or corroborated`,
  decisions:`${approvedDecisions}/${runtime.decisions.length} approved material decisions`,
  instructions:`${confirmedInstructions}/${runtime.instructions.length} confirmed instructions`,
  claims:openClaims?`${verifiedClaims} verified · ${openClaims} proposition(s) need judgment`:`${verifiedClaims} verified proposition(s)`,
  execution:execution?`${execution.title} · ${execution.status.replaceAll("_"," ")}`:milestone?.title??"No governed execution action yet",
 });
 return <section id="room" className="space-y-4 scroll-mt-6">
  <div className="overflow-hidden rounded-[1.7rem] border border-[#17483c]/15 bg-white shadow-sm">
   <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
    <div className="bg-[#0b493b] p-6 text-white"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#dfc47f]">{tr("room.canonical","Canonical matter room")}</p><h2 className="mt-2 text-2xl font-semibold">{room.kind}</h2><p className="mt-3 text-sm leading-6 text-white/65">{room.purpose}</p><p className="mt-4 text-xs leading-5 text-white/55">Strategy, legal intelligence, evidence posture and professional judgment live here. Firm process gates and procedure guidance remain supporting layers, not competing plans.</p><div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{tr("room.control","Professional control")}</p><p className="mt-1 text-xs leading-5 text-white/70">{matter.aiUsageRule}</p></div></div>
    <div className="grid gap-3 p-5 md:grid-cols-3">{focuses.map(focus=><Cell key={focus.label} label={focus.label} value={focus.value}/>)}</div>
   </div>
  </div>
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
   <Lane icon={<Target className="h-4 w-4"/>} title={tr("room.reasoning","Reasoning & issues")} count={intelligence.claims.length} text={intelligence.claims[0]?.statement??"No governed factual or legal proposition recorded yet."}/>
   <Lane icon={<FileCheck2 className="h-4 w-4"/>} title={tr("room.evidence","Evidence & provenance")} count={runtime.evidence.length} text={runtime.evidence[0]?.title??"No provenance record captured yet."}/>
   <Lane icon={<Scale className="h-4 w-4"/>} title={tr("room.decisions","Professional decisions")} count={runtime.decisions.length} text={runtime.decisions[0]?.title??"No governed decision recorded yet."}/>
   <Lane icon={<MessagesSquare className="h-4 w-4"/>} title={tr("room.client","Client position")} count={runtime.instructions.length} text={runtime.instructions[0]?.instruction??"No material client instruction recorded yet."}/>
   <Lane icon={<Sparkles className="h-4 w-4"/>} title={tr("room.execution","Execution")} count={operating.executions.length} text={execution?.title??"No governed execution action open."}/>
   <Lane icon={<Handshake className="h-4 w-4"/>} title={tr("room.handoffs","Professional handoffs")} count={runtime.handoffs.length} text={runtime.handoffs[0]?.purpose??"No professional handoff open."}/>
  </div>
  <details className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
   <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#0b493b]">{tr("room.deep","Strategy intelligence, sources & institutional memory")}</summary>
   <div className="border-t border-slate-100 p-4"><MatterIntelligencePanel matterId={matter.id} claims={intelligence.claims} communications={intelligence.communications} jurisdictionPacks={intelligence.jurisdictionPacks} knowledge={intelligence.knowledge} outcomes={operating.outcomes}/></div>
  </details>
 </section>
}
function Cell({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-[#f5f7f4] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#0f5b49]">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{value}</p></div>}
function Lane({icon,title,count,text}:{icon:React.ReactNode;title:string;count:number;text:string}){return <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><span className="rounded-xl bg-[#edf4f0] p-2 text-[#0b493b]">{icon}</span><span className="text-xs font-black text-slate-400">{count}</span></div><div className="mt-4 flex items-center gap-2"><h3 className="text-sm font-bold">{title}</h3>{count>0?<BadgeCheck className="h-3.5 w-3.5 text-[#0f5b49]"/>:null}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{text}</p></div>}
