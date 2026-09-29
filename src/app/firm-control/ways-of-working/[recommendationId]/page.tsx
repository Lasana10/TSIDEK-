"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

type Recommendation = {
  id:string; title:string; description?:string; category:string; status:string; suggested_configuration:Record<string,unknown>;
};

export default function ModifyRecommendationPage(){
  const params=useParams<{recommendationId:string}>(); const router=useRouter();
  const [recommendation,setRecommendation]=useState<Recommendation|null>(null);
  const [description,setDescription]=useState(""); const [configuration,setConfiguration]=useState("{}");
  const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);

  useEffect(()=>{fetch("/api/firm/ways-of-working",{cache:"no-store"}).then(r=>r.json()).then(p=>{
    if(!p.success) throw new Error(p.error); const item=(p.recommendations||[]).find((r:Recommendation)=>r.id===params.recommendationId);
    if(!item) throw new Error("Recommendation not found."); setRecommendation(item); setDescription(item.description||""); setConfiguration(JSON.stringify(item.suggested_configuration||{},null,2));
  }).catch(e=>setMessage(e.message));},[params.recommendationId]);

  async function save(){
    if(!recommendation)return; setSaving(true);setMessage("");
    try{
      const parsed=JSON.parse(configuration);
      const r=await fetch("/api/firm/ways-of-working",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"modify",recommendationId:recommendation.id,description,configuration:parsed})});
      const p=await r.json(); if(!p.success)throw new Error(p.error||"Unable to apply modification.");
      router.push("/firm-control/ways-of-working"); router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to apply modification.");setSaving(false)}
  }

  return <main className="min-h-screen bg-[#f4f6f3] p-4 text-slate-800 md:p-8"><div className="mx-auto max-w-4xl space-y-5">
    <Link href="/firm-control/ways-of-working" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"><ArrowLeft className="h-4 w-4"/>Ways of Working</Link>
    <section className="rounded-[2rem] bg-[#082b22] p-6 text-white"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">Modify recommendation</p><h1 className="mt-2 text-3xl font-semibold">{recommendation?.title||"Operating recommendation"}</h1><p className="mt-3 text-sm leading-6 text-white/65">Adjust the recommendation before adopting it. TSIDKENU will store your version as the firm&apos;s operating rule.</p></section>
    {message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</div>}
    <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
      <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Firm-facing description<textarea value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 p-4 text-sm normal-case outline-none"/></label>
      <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Operating configuration<textarea value={configuration} onChange={e=>setConfiguration(e.target.value)} spellCheck={false} className="mt-2 min-h-72 w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs normal-case text-slate-100 outline-none"/></label>
      <button onClick={()=>void save()} disabled={saving||!recommendation} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#082b22] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Applying…":"Apply modified setup"}</button>
    </section>
  </div></main>
}
