"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CirclePlus, Clock3, FileCheck2, ReceiptText } from "lucide-react";

type Report={id:string;matter_id:string;activity_type:string;title:string;summary:string;outcome?:string|null;next_action?:string|null;occurred_at:string;minutes:number;billable:boolean;expense_xaf:number;status:string};
type Matter={id:string;title:string;client_name:string};
type Payload={success:boolean;error?:string;reports?:Report[];matters?:Matter[]};
const field="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none";

export default function ActivityReportsPage(){
 const[data,setData]=useState<Payload>({success:true,reports:[],matters:[]});
 const[loading,setLoading]=useState(true);
 const[open,setOpen]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const[form,setForm]=useState({matterId:"",activityType:"consultation",title:"",summary:"",outcome:"",nextAction:"",minutes:"0",billable:true,expenseXaf:"0",expenseDescription:""});

 async function load(){
   setLoading(true);
   try{
    const response=await fetch("/api/activity-reports",{cache:"no-store",credentials:"include"});
    const payload=await response.json();
    if(!response.ok||!payload.success) throw new Error(payload.error||"Unable to load activity reports.");
    setData(payload);
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to load activity reports.");}
   finally{setLoading(false);}
 }
 useEffect(()=>{void load()},[]);
 const matterMap=useMemo(()=>new Map((data.matters??[]).map(item=>[item.id,item])),[data.matters]);

 async function create(event:FormEvent){
   event.preventDefault();setBusy(true);setMessage("");
   try{
     const response=await fetch("/api/activity-reports",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,minutes:Number(form.minutes),expenseXaf:Number(form.expenseXaf)})});
     const payload=await response.json();
     if(!response.ok||!payload.success) throw new Error(payload.error||"Unable to save compte rendu.");
     setOpen(false);
     await load();
     setMessage("Compte rendu saved; time and case expense were propagated where applicable.");
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to save compte rendu.");}
   finally{setBusy(false);}
 }

 return <main className="min-h-screen bg-[#eef2ef] p-3 text-slate-900 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1700px] space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>Workspace</Link>
   <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white"><CirclePlus className="h-4 w-4"/>New compte rendu</button>
  </div>
  <section className="rounded-[2rem] bg-[#082b22] p-6 text-white md:p-8 xl:p-10">
   <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d8bb79]">Compte rendu & billing evidence</p>
   <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Record the work once; reuse it for accountability and billing.</h1>
   <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">A consultation, hearing, research session or mission can create the case record and propagate billable time and disbursement data.</p>
  </section>
  {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}
  {loading?<div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500">Loading activity reports…</div>:
  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
   {(data.reports??[]).map(item=><article key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf4f0] text-[#0f5b49]"><FileCheck2 className="h-5 w-5"/></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase">{item.status}</span></div>
    <p className="mt-4 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">{item.activity_type.replaceAll("_"," ")}</p>
    <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>
    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><p className="font-semibold text-slate-700">{matterMap.get(item.matter_id)?.client_name} — {matterMap.get(item.matter_id)?.title}</p><p className="mt-1">{item.minutes} min · {item.billable?"Billable":"Non-billable"} · {item.expense_xaf||0} XAF expense</p>{item.next_action&&<p className="mt-1">Next: {item.next_action}</p>}</div>
   </article>)}
   {!(data.reports??[]).length&&<div className="md:col-span-2 xl:col-span-3 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><ReceiptText className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-3 text-sm text-slate-500">No compte rendu yet.</p></div>}
  </section>}
 </div>
 {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" onClick={()=>!busy&&setOpen(false)}>
  <form onSubmit={create} onClick={e=>e.stopPropagation()} className="w-full max-w-3xl rounded-[1.8rem] bg-white p-5 shadow-2xl">
   <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-[#0f5b49]"/><h2 className="text-2xl font-semibold">New compte rendu</h2></div>
   <div className="mt-5 grid gap-3 md:grid-cols-2">
    <select required className={field} value={form.matterId} onChange={e=>setForm({...form,matterId:e.target.value})}><option value="">Select case</option>{(data.matters??[]).map(item=><option key={item.id} value={item.id}>{item.client_name} — {item.title}</option>)}</select>
    <select className={field} value={form.activityType} onChange={e=>setForm({...form,activityType:e.target.value})}><option value="consultation">Consultation</option><option value="hearing">Hearing</option><option value="research">Research</option><option value="drafting">Drafting</option><option value="meeting">Meeting</option><option value="call">Call</option><option value="mission">External mission</option><option value="legal_work">Other legal work</option></select>
    <input required className={field} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Activity title"/>
    <input className={field} inputMode="numeric" value={form.minutes} onChange={e=>setForm({...form,minutes:e.target.value})} placeholder="Minutes"/>
    <textarea required className={field+" md:col-span-2 min-h-24"} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})} placeholder="What happened / work performed"/>
    <textarea className={field+" min-h-20"} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})} placeholder="Outcome"/>
    <textarea className={field+" min-h-20"} value={form.nextAction} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Next action"/>
    <input className={field} inputMode="numeric" value={form.expenseXaf} onChange={e=>setForm({...form,expenseXaf:e.target.value})} placeholder="Expense / disbursement XAF"/>
    <input className={field} value={form.expenseDescription} onChange={e=>setForm({...form,expenseDescription:e.target.value})} placeholder="Expense description"/>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.billable} onChange={e=>setForm({...form,billable:e.target.checked})}/>Billable work</label>
   </div>
   <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-2.5 text-sm font-bold text-white">{busy?"Saving…":"Save compte rendu"}</button></div>
  </form>
 </div>}
 </main>
}
