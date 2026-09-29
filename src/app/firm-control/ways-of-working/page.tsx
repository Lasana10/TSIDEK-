"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Check, ChevronRight, RefreshCw, Save, Sparkles, X } from "lucide-react";

type Profile = {
  practice_model:string; professional_count_band:string; practice_areas:string[]; office_count:number;
  approval_model:string; billing_models:string[]; client_types:string[]; litigation_mix:string;
  support_staff_model:string; confidentiality_mode:string; profile_notes?:string|null;
};
type Recommendation = { id:string; category:string; title:string; description?:string; rationale?:string; status:string; suggested_configuration:Record<string,unknown> };
type Rule = { id:string; category:string; title:string; description?:string; status:string; configuration:Record<string,unknown> };

const DEFAULT: Profile = {
  practice_model:"general_practice", professional_count_band:"5_14", practice_areas:["litigation"],
  office_count:1, approval_model:"partner_review", billing_models:["fixed_fee","hourly"], client_types:["individuals","businesses"],
  litigation_mix:"litigation_heavy", support_staff_model:"mixed", confidentiality_mode:"standard", profile_notes:""
};

const PRACTICE_AREAS = [
  ["litigation","Litigation"],["corporate","Corporate / Commercial"],["ip","Intellectual Property"],["employment","Employment"],
  ["tax","Tax"],["real_estate","Real Estate"],["banking","Banking / Finance"],["criminal","Criminal"],["family","Family"]
] as const;

function toggleValue(values:string[], value:string){ return values.includes(value) ? values.filter(v=>v!==value) : [...values,value]; }

export default function WaysOfWorkingPage(){
  const [profile,setProfile]=useState<Profile>(DEFAULT);
  const [recommendations,setRecommendations]=useState<Recommendation[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");

  async function reload(){
    const r=await fetch("/api/firm/ways-of-working",{cache:"no-store"}); const p=await r.json();
    if(!p.success) throw new Error(p.error||"Unable to load ways of working.");
    setProfile({...DEFAULT,...(p.profile||{})}); setRecommendations(p.recommendations||[]); setRules(p.rules||[]);
  }
  useEffect(()=>{reload().catch(e=>setMessage(e.message)).finally(()=>setLoading(false));},[]);

  async function saveProfile(){
    setSaving(true); setMessage("");
    try{
      const r=await fetch("/api/firm/ways-of-working",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(profile)});
      const p=await r.json(); if(!p.success) throw new Error(p.error||"Unable to save.");
      setProfile({...DEFAULT,...(p.profile||{})}); setRecommendations(p.recommendations||[]); setRules(p.rules||[]);
      setMessage("Firm profile saved and recommendations refreshed.");
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");}finally{setSaving(false)}
  }
  async function act(id:string, action:"apply"|"dismiss"){
    setMessage("");
    const r=await fetch("/api/firm/ways-of-working",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recommendationId:id,action})});
    const p=await r.json(); if(!p.success){setMessage(p.error||"Unable to update recommendation.");return}
    setRecommendations(p.recommendations||[]); setRules(p.rules||[]);
  }
  const summary=useMemo(()=>{
    const practice = profile.practice_model.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
    const litigation = profile.litigation_mix.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
    return `${practice} · ${litigation} · ${profile.professional_count_band.replace("_","–")} professionals · ${profile.approval_model.replaceAll("_"," ")}`;
  },[profile]);

  if(loading)return <main className="min-h-screen bg-[#f4f6f3] p-6">Loading ways of working…</main>;

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7f4_0%,#eef2ef_100%)] px-4 py-6 text-slate-800 md:px-6 xl:px-8">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="rounded-[2rem] bg-[#082b22] p-6 text-white shadow-xl md:p-8">
        <Link href="/studio" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60"><ArrowLeft className="h-4 w-4"/>Firm Control</Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Ways of Working</p><h1 className="mt-2 text-4xl font-semibold">Shape how this firm actually operates</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">TSIDKENU recommends a setup from the firm profile. Nothing changes silently: governors apply, modify or dismiss recommendations.</p></div>
          <button onClick={()=>void saveProfile()} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#082b22] disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Saving…":"Save & refresh"}</button>
        </div>
      </section>

      {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-emerald-800"/><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Firm Profile</p><h2 className="text-xl font-semibold text-slate-950">What kind of firm are we?</h2></div></div>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">{summary}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Select label="Practice model" value={profile.practice_model} onChange={v=>setProfile({...profile,practice_model:v})} options={[["general_practice","General practice"],["boutique","Boutique"],["full_service","Full service"],["specialist","Specialist"]]} />
            <Select label="Team size" value={profile.professional_count_band} onChange={v=>setProfile({...profile,professional_count_band:v})} options={[["1_4","1–4"],["5_14","5–14"],["15_30","15–30"],["31_plus","31+"]]} />
            <Select label="Approval model" value={profile.approval_model} onChange={v=>setProfile({...profile,approval_model:v})} options={[["individual_autonomy","Individual autonomy"],["partner_review","Partner review"],["partner_final","Partner final approval"],["committee","Committee / department approval"]]} />
            <Select label="Litigation mix" value={profile.litigation_mix} onChange={v=>setProfile({...profile,litigation_mix:v})} options={[["litigation_heavy","Litigation-heavy"],["mixed","Mixed"],["transactional_heavy","Transactional-heavy"]]} />
            <Select label="Support staff" value={profile.support_staff_model} onChange={v=>setProfile({...profile,support_staff_model:v})} options={[["none","No dedicated support"],["intern_heavy","Intern-heavy"],["paralegal_heavy","Paralegal-heavy"],["mixed","Mixed support team"]]} />
            <Select label="Confidentiality" value={profile.confidentiality_mode} onChange={v=>setProfile({...profile,confidentiality_mode:v})} options={[["standard","Standard"],["strict","Strict"],["high","High / sensitive practice"]]} />
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Offices<input type="number" min={1} value={profile.office_count} onChange={e=>setProfile({...profile,office_count:Math.max(1,Number(e.target.value))})} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"/></label>
          </div>
          <div className="mt-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Practice areas</p><div className="mt-3 flex flex-wrap gap-2">{PRACTICE_AREAS.map(([value,label])=><button key={value} onClick={()=>setProfile({...profile,practice_areas:toggleValue(profile.practice_areas,value)})} className={`rounded-full px-3 py-2 text-xs font-bold ${profile.practice_areas.includes(value)?"bg-[#082b22] text-white":"bg-slate-100 text-slate-600"}`}>{label}</button>)}</div></div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-emerald-800"/><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recommended Setup</p><h2 className="text-xl font-semibold text-slate-950">Recommended for your firm</h2></div></div>
            <p className="mt-2 text-sm text-slate-500">Based on how your firm operates, TSIDKENU recommends these operating patterns.</p>
            <div className="mt-5 space-y-3">{recommendations.filter(r=>r.status==="suggested").length===0?<div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">No open recommendations. Change the firm profile and refresh whenever the practice evolves.</div>:recommendations.filter(r=>r.status==="suggested").map(r=><article key={r.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{r.category.replaceAll("_"," ")}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{r.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{r.description}</p><p className="mt-2 text-xs leading-5 text-slate-400">{r.rationale}</p></div><ChevronRight className="mt-1 h-5 w-5 text-slate-300"/></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void act(r.id,"apply")} className="inline-flex items-center gap-2 rounded-xl bg-[#082b22] px-4 py-2 text-xs font-bold text-white"><Check className="h-3.5 w-3.5"/>Apply</button><Link href={`/firm-control/ways-of-working/${r.id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Modify</Link><button onClick={()=>void act(r.id,"dismiss")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500"><X className="h-3.5 w-3.5"/>Dismiss</button></div></article>)}</div>
          </div>

          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operational configuration</p><h2 className="text-xl font-semibold text-slate-950">What the firm has chosen</h2></div><RefreshCw className="h-5 w-5 text-slate-400"/></div>
            <div className="mt-5 space-y-3">{rules.filter(r=>r.status==="active").length===0?<p className="text-sm text-slate-500">No recommended operating rule has been adopted yet.</p>:rules.filter(r=>r.status==="active").map(r=><div key={r.id} className="rounded-2xl bg-[#f7f9f7] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{r.category.replaceAll("_"," ")}</p><p className="mt-1 font-semibold text-slate-900">{r.title}</p><p className="mt-1 text-sm text-slate-500">{r.description}</p></div>)}</div>
          </div>
        </div>
      </section>
    </div>
  </main>
}

function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:[string,string][]}){return <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm normal-case outline-none">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
