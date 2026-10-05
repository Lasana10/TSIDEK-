import { ArrowRight, BadgeCheck, FileCheck2, Handshake, MessagesSquare, Scale } from "lucide-react";
import type { MatterWorkspaceData } from "@/lib/matters";
import { getMatterAdaptiveRuntime,resolveAdaptiveRoom } from "@/lib/matter-adaptive-runtime";
import type { RequestScope } from "@/lib/request-scope";

export default async function AdaptiveMatterLayer({matter,scope}:{matter:MatterWorkspaceData;scope:RequestScope}){
 const room=resolveAdaptiveRoom(matter);
 const runtime=await getMatterAdaptiveRuntime({matterId:matter.id,scope});
 const active=matter.workstreams?.find(x=>x.status==="active")??matter.workstreams?.find(x=>x.status!=="completed");
 const milestone=matter.milestones?.find(x=>!["completed","waived"].includes(x.status));
 return <section className="space-y-4">
  <div className="overflow-hidden rounded-[1.7rem] border border-[#17483c]/15 bg-white shadow-sm">
   <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
    <div className="bg-[#0b493b] p-6 text-white"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#dfc47f]">Contextual workspace</p><h2 className="mt-2 text-2xl font-semibold">{room.kind}</h2><p className="mt-3 text-sm leading-6 text-white/65">{room.purpose}</p></div>
    <div className="grid gap-3 p-5 md:grid-cols-3"><Cell label="Working now" value={active?.name??matter.primaryTrack}/><Cell label="Next proof point" value={milestone?.title??matter.nextDraft}/><Cell label="Professional control" value={matter.aiUsageRule}/></div>
   </div>
  </div>
  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
   <Lane icon={<Scale className="h-4 w-4"/>} title="Decisions" count={runtime.decisions.length} text={runtime.decisions[0]?.title??"No governed decision recorded yet."}/>
   <Lane icon={<MessagesSquare className="h-4 w-4"/>} title="Client instructions" count={runtime.instructions.length} text={runtime.instructions[0]?.instruction??"No client instruction recorded yet."}/>
   <Lane icon={<FileCheck2 className="h-4 w-4"/>} title="Evidence & provenance" count={runtime.evidence.length} text={runtime.evidence[0]?.title??"No provenance record captured yet."}/>
   <Lane icon={<Handshake className="h-4 w-4"/>} title="Professional handoffs" count={runtime.handoffs.length} text={runtime.handoffs[0]?.purpose??"No professional handoff open."}/>
  </div>
 </section>
}
function Cell({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-[#f5f7f4] p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#0f5b49]">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{value}</p></div>}
function Lane({icon,title,count,text}:{icon:React.ReactNode;title:string;count:number;text:string}){return <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><span className="rounded-xl bg-[#edf4f0] p-2 text-[#0b493b]">{icon}</span><span className="text-xs font-black text-slate-400">{count}</span></div><div className="mt-4 flex items-center gap-2"><h3 className="text-sm font-bold">{title}</h3>{count>0?<BadgeCheck className="h-3.5 w-3.5 text-[#0f5b49]"/>:null}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{text}</p><div className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-[.12em] text-[#0f5b49]">Matter record<ArrowRight className="h-3 w-3"/></div></div>}