"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Braces, Save, SlidersHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

type Recommendation = {
  id:string; title:string; description?:string; category:string; status:string; suggested_configuration:Record<string,unknown>;
};

const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700/40";
const label=(key:string)=>key.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());

export default function ModifyRecommendationPage(){
  const params=useParams<{recommendationId:string}>(); const router=useRouter();
  const [recommendation,setRecommendation]=useState<Recommendation|null>(null);
  const [description,setDescription]=useState(""); const [configuration,setConfiguration]=useState<Record<string,unknown>>({});
  const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);

  useEffect(()=>{fetch("/api/firm/ways-of-working",{cache:"no-store"}).then(r=>r.json()).then(p=>{
    if(!p.success) throw new Error(p.error); const item=(p.recommendations||[]).find((r:Recommendation)=>r.id===params.recommendationId);
    if(!item) throw new Error("Recommendation not found."); setRecommendation(item); setDescription(item.description||""); setConfiguration(item.suggested_configuration||{});
  }).catch(e=>setMessage(e.message));},[params.recommendationId]);

  const entries=useMemo(()=>Object.entries(configuration),[configuration]);
  function update(key:string,value:unknown){setConfiguration(current=>({...current,[key]:value}))}

  async function save(){
    if(!recommendation)return; setSaving(true);setMessage("");
    try{
      const r=await fetch("/api/firm/ways-of-working",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"modify",recommendationId:recommendation.id,description,configuration})});
      const p=await r.json(); if(!p.success)throw new Error(p.error||"Unable to apply modification.");
      router.push("/firm-control/ways-of-working"); router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to apply modification.");setSaving(false)}
  }

  return <main className="min-h-screen bg-[#f4f6f3] p-4 text-slate-800 md:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <Link href="/firm-control/ways-of-working" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"><ArrowLeft className="h-4 w-4"/>Ways of Working</Link>
    <section className="rounded-[2rem] bg-[#082b22] p-6 text-white"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">Modify recommendation</p><h1 className="mt-2 text-3xl font-semibold">{recommendation?.title||"Operating recommendation"}</h1><p className="mt-3 text-sm leading-6 text-white/65">Adjust the recommendation before adopting it. The result becomes the firm&apos;s governed operating rule; no hidden configuration is applied.</p></section>
    {message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</div>}
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><SlidersHorizontal className="h-5 w-5 text-emerald-800"/><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Firm-facing rule</p><h2 className="text-lg font-semibold text-slate-950">What staff should understand</h2></div></div>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} className="mt-4 min-h-40 w-full rounded-2xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-emerald-700/40"/>
        <p className="mt-3 text-xs leading-5 text-slate-500">Describe the operating expectation in normal firm language. Technical controls remain below.</p>
      </div>
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Braces className="h-5 w-5 text-emerald-800"/><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Operating controls</p><h2 className="text-lg font-semibold text-slate-950">Configure without editing JSON</h2></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{entries.map(([key,value])=><ConfigField key={key} name={key} value={value} onChange={next=>update(key,next)}/>)}</div>
        {!entries.length?<p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">This recommendation has no configurable controls.</p>:null}
      </div>
    </section>
    <details className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-xs text-slate-500">
      <summary className="cursor-pointer font-bold text-slate-700">Advanced configuration preview</summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-100">{JSON.stringify(configuration,null,2)}</pre>
    </details>
    <button onClick={()=>void save()} disabled={saving||!recommendation} className="inline-flex items-center gap-2 rounded-2xl bg-[#082b22] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Applying…":"Apply modified setup"}</button>
  </div></main>
}

function ConfigField({name,value,onChange}:{name:string;value:unknown;onChange:(value:unknown)=>void}){
 const title=label(name);
 if(typeof value==="boolean")return <label className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)} className="h-4 w-4"/><span>{title}</span></label>;
 if(typeof value==="number")return <label className="block rounded-xl border border-slate-200 p-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{title}<input type="number" value={value} onChange={e=>onChange(Number(e.target.value))} className={`${field} mt-2 normal-case`}/></label>;
 if(Array.isArray(value))return <label className="block rounded-xl border border-slate-200 p-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{title}<input value={value.join(", ")} onChange={e=>onChange(e.target.value.split(",").map(x=>x.trim()).filter(Boolean))} className={`${field} mt-2 normal-case`} placeholder="Comma-separated values"/><span className="mt-1 block text-[10px] normal-case font-normal text-slate-400">Separate multiple values with commas.</span></label>;
 if(value&&typeof value==="object")return <div className="rounded-xl border border-slate-200 p-3 md:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{title}</p><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(value,null,2)}</pre><p className="mt-2 text-[10px] text-slate-400">Nested controls are preserved and read-only here.</p></div>;
 return <label className="block rounded-xl border border-slate-200 p-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{title}<input value={String(value??"")} onChange={e=>onChange(e.target.value)} className={`${field} mt-2 normal-case`}/></label>;
}
