import { CheckCircle2, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import type { RequestScope } from "@/lib/request-scope";
import { getMatterOperatingSystem } from "@/lib/matter-operating-system.server";

export default async function MatterOperatingChain({matterId,scope}:{matterId:string;scope:RequestScope}){
 const operating=await getMatterOperatingSystem({matterId,scope});
 return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0f5b49]">Matter operating chain</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">From instruction to institutional knowledge</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">One governed chain across the existing Matter, documents, approvals, execution, finance and knowledge layers.</p></div><p className="text-xs font-bold text-slate-400">{operating.stages.filter(x=>x.state==="complete").length}/{operating.stages.length} stages controlled</p></div>
  <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{operating.stages.map(stage=><div key={stage.key} className="rounded-2xl border border-slate-200 bg-[#f8faf8] p-3.5"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{stage.label}</p><StateIcon state={stage.state}/></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-700">{stage.detail}</p></div>)}</div>
 </section>
}
function StateIcon({state}:{state:"complete"|"active"|"attention"|"waiting"}){if(state==="complete")return <CheckCircle2 className="h-4 w-4 text-[#0f5b49]"/>;if(state==="attention")return <CircleAlert className="h-4 w-4 text-amber-600"/>;if(state==="active")return <LoaderCircle className="h-4 w-4 text-slate-600"/>;return <Clock3 className="h-4 w-4 text-slate-300"/>}
