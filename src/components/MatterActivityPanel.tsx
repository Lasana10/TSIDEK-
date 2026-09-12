"use client";

import { useEffect, useState } from "react";
import { Activity, BriefcaseBusiness, CalendarClock, FileText, Landmark, MessageSquareText, Receipt, ScrollText } from "lucide-react";

type Item={id:string;kind:string;title:string;detail?:string|null;at:string;status?:string|null};
type Payload={success:boolean;error?:string;activity?:Item[]};

const icons:Record<string,typeof Activity>={interaction:MessageSquareText,task:CalendarClock,document:FileText,client_update:Landmark,finance:Receipt,commitment:ScrollText,event:BriefcaseBusiness};

export default function MatterActivityPanel({matterId}:{matterId:string}){
 const [data,setData]=useState<Payload|null>(null);const [filter,setFilter]=useState("all");
 useEffect(()=>{fetch(`/api/matters/${matterId}/activity`,{cache:"no-store"}).then(r=>r.json()).then(setData).catch(e=>setData({success:false,error:e instanceof Error?e.message:"Unable to load activity."}));},[matterId]);
 if(!data)return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5">Loading matter activity…</section>;
 const all=data.activity??[];const shown=filter==="all"?all:all.filter(item=>item.kind===filter);
 return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-[#0f5b49]"><Activity className="h-5 w-5"/><span className="text-[10px] font-black uppercase tracking-[0.2em]">Matter activity</span></div><h2 className="mt-2 text-2xl font-semibold text-slate-950">One chronological legal record</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Visits, calls, WhatsApp/email interactions, tasks, documents, client updates, financial entries and commitments appear together without creating another messaging system.</p></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">All activity</option><option value="interaction">Interactions</option><option value="task">Tasks</option><option value="document">Documents</option><option value="client_update">Client updates</option><option value="finance">Finance</option><option value="commitment">Commitments</option><option value="event">System / matter events</option></select></div>
  {!data.success?<div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{data.error||"Unable to load matter activity."}</div>:null}
  <div className="mt-5 space-y-2">{shown.length===0?<div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No activity recorded for this view yet.</div>:shown.slice(0,60).map(item=>{const Icon=icons[item.kind]||Activity;return <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-100 p-4"><div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-[#0f5b49]"><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{item.title}</p>{item.status?<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.status}</span>:null}</div>{item.detail?<p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</p>:null}<p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.kind.replaceAll("_"," ")} · {new Date(item.at).toLocaleString()}</p></div></div>})}</div>
 </section>;
}
