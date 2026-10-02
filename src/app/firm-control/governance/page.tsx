"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

type GovernanceRequest={
 id:string;matter_id:string;request_type:string;status:string;reason:string;requested_at:string;decision_note?:string|null;
 matters?:{title?:string;case_reference?:string;client_name?:string}|null;
};
type ApiPayload={success?:boolean;requests?:GovernanceRequest[];error?:string};

export default function GovernancePage(){
 const[requests,setRequests]=useState<GovernanceRequest[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);const[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);setError(null);try{const r=await fetch("/api/firm/governance/record-changes",{cache:"no-store",credentials:"include"});const p=await r.json() as ApiPayload;if(!r.ok||!p.success)throw new Error(p.error||"Unable to load governance queue.");setRequests(p.requests??[])}catch(e){setError(e instanceof Error?e.message:"Unable to load governance queue.")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 async function decide(item:GovernanceRequest,decision:"approve"|"reject"){
   const note=window.prompt(decision==="approve"?"Approval note (optional)":"Why are you rejecting this removal request?")?.trim()||"";
   if(decision==="reject"&&!note)return;
   setBusy(item.id);setError(null);setMessage(null);
   try{const r=await fetch("/api/firm/governance/record-changes",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:item.id,decision,decisionNote:note})});const p=await r.json() as ApiPayload;if(!r.ok||!p.success)throw new Error(p.error||"Unable to decide request.");setMessage(decision==="approve"?"Removal approved. The mistaken empty case is now removed from active records.":"Removal request rejected. The case remains protected.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to decide request.")}finally{setBusy(null)}
 }
 const pending=requests.filter(r=>r.status==="pending");
 return <main className="min-h-screen px-4 py-6 md:px-7 xl:px-10"><div className="mx-auto max-w-6xl space-y-5">
   <div className="flex items-center justify-between gap-4"><Link href="/firm-control" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><ArrowLeft className="h-4 w-4"/>Firm Control</Link><span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.13em] text-amber-700">{pending.length} pending</span></div>
   <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-start gap-4"><div className="rounded-2xl bg-[var(--firm-primary)] p-3 text-white"><ShieldCheck className="h-5 w-5"/></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-400">Firm governance</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Protected record decisions</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Case removal is exceptional. Only the Firm Owner or Managing Partner can decide a request, the requester cannot decide their own request, and any legal or financial history converts the safe action to archive-only.</p></div></div></section>
   {message?<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>:null}{error?<div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>:null}
   <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-400">Approval queue</p><h2 className="mt-1 text-xl font-semibold">Case removal requests</h2></div></div>
    <div className="mt-5 space-y-3">{loading?<div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--firm-primary)]"/></div>:requests.length===0?<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No case-removal requests.</div>:requests.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${item.status==="pending"?"bg-amber-50 text-amber-700":item.status==="approved"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{item.status}</span><span className="text-[10px] font-bold text-slate-400">{new Date(item.requested_at).toLocaleString()}</span></div><h3 className="mt-2 text-base font-bold text-slate-900">{item.matters?.title||"Case"}</h3><p className="mt-1 text-xs text-slate-500">{item.matters?.case_reference||item.matter_id}{item.matters?.client_name?` · ${item.matters.client_name}`:""}</p><p className="mt-3 text-sm leading-6 text-slate-700">{item.reason}</p>{item.decision_note?<p className="mt-2 text-xs text-slate-500">Decision: {item.decision_note}</p>:null}</div>{item.status==="pending"?<div className="flex gap-2"><button disabled={busy===item.id} onClick={()=>void decide(item,"reject")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><XCircle className="h-4 w-4"/>Reject</button><button disabled={busy===item.id} onClick={()=>void decide(item,"approve")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--firm-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===item.id?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}Approve removal</button></div>:null}</div></article>)}</div>
   </section>
 </div></main>
}
