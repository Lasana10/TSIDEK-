"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Gavel, Route } from "lucide-react";

type ProcedureItem = string | { title?: string; detail?: string };
type ProcedureTrack = { label_en?: string; configuration?: { steps?: ProcedureItem[]; required_documents?: ProcedureItem[]; risks?: ProcedureItem[] } };
type Authority = { id:string; title:string; citation?:string|null; authority_type?:string|null; issuing_body?:string|null; verification_status?:string|null };
type ComplianceItem = { id:string; label:string; status:string };
type ComplianceChecklist = { id:string; title:string; overall_status:string; compliance_checklist_items?:ComplianceItem[] };
type Payload={success:boolean;error?:string;procedureTracks?:ProcedureTrack[];authorities?:Authority[];compliance?:ComplianceChecklist[]};

export default function ProcedureGuidancePanel({matterId}:{matterId:string}){
 const [data,setData]=useState<Payload|null>(null);
 useEffect(()=>{
   let active=true;
   fetch(`/api/matters/${matterId}/procedure`,{cache:"no-store"})
     .then(r=>r.json() as Promise<Payload>)
     .then(payload=>{if(active)setData(payload)})
     .catch(error=>{if(active)setData({success:false,error:error instanceof Error?error.message:"Unable to load procedure guidance"})});
   return()=>{active=false};
 },[matterId]);
 const track=data?.procedureTracks?.[0];
 const config=track?.configuration??{};
 const steps=Array.isArray(config.steps)?config.steps:[];
 const docs=Array.isArray(config.required_documents)?config.required_documents:[];
 const risks=Array.isArray(config.risks)?config.risks:[];
 return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[#0f5b49]"><Route className="h-5 w-5"/><span className="text-[10px] font-black uppercase tracking-[.2em]">Procedure & compliance intelligence</span></div><h2 className="mt-2 text-2xl font-semibold text-slate-950">{track?.label_en||"Matter procedure guidance"}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Guidance is driven by the matter classification, firm procedure parameters, compliance controls and Law Bank sources. It supports professional judgment; it does not silently decide law.</p></div><Link href="/law-bank" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"><BookOpenCheck className="h-4 w-4"/>Open Law Bank</Link></div>
  {data?.error&&<div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{data.error}</div>}
  <div className="mt-5 grid gap-4 xl:grid-cols-3">
   <Box title="Procedure sequence" icon={<Route className="h-4 w-4"/>}>{steps.length?steps.map((step,index)=><div key={index} className="flex gap-3 border-b border-slate-100 py-2 last:border-0"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-800">{index+1}</span><div><p className="text-sm font-semibold text-slate-900">{typeof step==="string"?step:step.title||`Step ${index+1}`}</p>{typeof step==="object"&&step.detail&&<p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>}</div></div>):<p className="text-sm text-slate-400">No configured procedure track matches yet. Configure one in Firm Studio; source authorities remain visible.</p>}</Box>
   <Box title="Required documents & risks" icon={<CheckCircle2 className="h-4 w-4"/>}><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Documents</p>{docs.map((item,index)=><p key={`d${index}`} className="mt-2 text-sm text-slate-600">• {typeof item==="string"?item:item.title}</p>)}{!docs.length&&<p className="mt-2 text-sm text-slate-400">No procedure-specific required documents configured.</p>}<p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Risks</p>{risks.map((item,index)=><p key={`r${index}`} className="mt-2 text-sm text-slate-600">• {typeof item==="string"?item:item.title}</p>)}{!risks.length&&<p className="mt-2 text-sm text-slate-400">No procedure-specific risk notes configured.</p>}</Box>
   <Box title="Supporting authorities" icon={<Gavel className="h-4 w-4"/>}>{(data?.authorities||[]).slice(0,8).map(authority=><div key={authority.id} className="border-b border-slate-100 py-2 last:border-0"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{authority.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-slate-500">{authority.verification_status}</span></div><p className="mt-1 text-xs text-slate-500">{[authority.citation,authority.authority_type,authority.issuing_body].filter(Boolean).join(" · ")}</p></div>)}{!(data?.authorities||[]).length&&<p className="text-sm text-slate-400">No matching firm authority has been indexed yet.</p>}</Box>
  </div>
  {(data?.compliance||[]).length>0&&<div className="mt-5 rounded-2xl border border-slate-100 p-4"><p className="text-sm font-semibold text-slate-950">Live compliance controls</p><div className="mt-3 grid gap-3 md:grid-cols-2">{(data?.compliance||[]).map(checklist=><div key={checklist.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{checklist.title}</p><span className="text-xs text-slate-500">{checklist.overall_status}</span></div>{(checklist.compliance_checklist_items||[]).map(item=><p key={item.id} className="mt-2 text-xs text-slate-600">• {item.label} · {item.status}</p>)}</div>)}</div></div>}
 </section>
}
function Box({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <div className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-950">{icon}{title}</div><div className="mt-3">{children}</div></div>}
