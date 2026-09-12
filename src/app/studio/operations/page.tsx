"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, LockKeyhole, MessageCircleMore, PhoneCall, Save, ShieldCheck, WandSparkles } from "lucide-react";

type Interaction = {
  whatsapp_enabled:boolean; call_logging_enabled:boolean; call_recording_enabled:boolean; transcription_enabled:boolean;
  walk_in_enabled:boolean; email_ingestion_enabled:boolean; ai_extraction_enabled:boolean; automatic_matter_matching:boolean;
  default_ai_mode:string; recording_retention_days:number; transcript_retention_days:number;
};
type Ai = { user_facing_mode:string; highly_confidential_mode:string; allow_personal_provider_keys:boolean; store_prompt_text:boolean; prompt_retention_days:number };
const field = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-900/5";

export default function OperatingSettingsPage(){
  const [interaction,setInteraction]=useState<Interaction|null>(null);
  const [ai,setAi]=useState<Ai|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{fetch("/api/firm/operating-settings",{cache:"no-store"}).then(r=>r.json()).then(p=>{if(!p.success)throw new Error(p.error);setInteraction(p.interaction);setAi(p.ai)}).catch(e=>setMessage(e.message)).finally(()=>setLoading(false));},[]);
  async function save(){if(!interaction||!ai)return;setSaving(true);setMessage("");try{for(const payload of [{section:"interaction",...interaction},{section:"ai",...ai}]){const r=await fetch("/api/firm/operating-settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const p=await r.json();if(!p.success)throw new Error(p.error)}setMessage("Operating policy saved.");}catch(e){setMessage(e instanceof Error?e.message:"Unable to save settings.");}finally{setSaving(false)}}
  if(loading)return <main className="min-h-screen bg-slate-50 p-6">Loading operating policy…</main>;
  if(!interaction||!ai)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8">{message||"Settings unavailable."}</div></main>;

  const toggle=(key:keyof Interaction)=><button type="button" onClick={()=>setInteraction(v=>v?{...v,[key]:!v[key]}:v)} className={`h-7 w-12 rounded-full p-1 transition ${interaction[key]?"bg-emerald-800":"bg-slate-200"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${interaction[key]?"translate-x-5":""}`}/></button>;

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f2_100%)] p-4 text-slate-800 md:p-6 xl:p-8"><div className="mx-auto max-w-[1500px] space-y-5">
    <section className="rounded-[2rem] bg-[#082b22] p-6 text-white shadow-xl md:p-8"><Link href="/studio" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60"><ArrowLeft className="h-4 w-4"/>Firm Studio</Link><div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Operating policy</p><h1 className="mt-2 text-4xl font-semibold">Privacy, communication and AI controls</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Keep everyday use simple while governors decide which channels, recording, transcription and AI modes the firm permits.</p></div><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-emerald-950 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Saving…":"Save policy"}</button></div></section>
    {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><MessageCircleMore className="h-5 w-5 text-emerald-800"/><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Interaction capture</p><h2 className="text-xl font-semibold text-slate-950">Switch channels only when useful</h2></div></div><div className="mt-5 space-y-3">
        <Setting title="Walk-ins / office visits" text="Keep ordinary physical office intake first-class." control={toggle("walk_in_enabled")}/>
        <Setting title="WhatsApp integration" text="Allow WhatsApp events to enter the governed interaction stream." control={toggle("whatsapp_enabled")}/>
        <Setting title="Call logging" text="Let staff record that a call happened even without audio." control={toggle("call_logging_enabled")}/>
        <Setting title="Call recording" text="Permit recording only where firm policy and consent allow." control={toggle("call_recording_enabled")}/>
        <Setting title="Transcription" text="Permit transcription for authorized recordings or voice notes." control={toggle("transcription_enabled")}/>
        <Setting title="Email ingestion" text="Allow email to create governed interaction records." control={toggle("email_ingestion_enabled")}/>
        <Setting title="AI extraction" text="Allow suggestions for facts, deadlines, commitments and tasks." control={toggle("ai_extraction_enabled")}/>
        <Setting title="Automatic matter matching" text="Let the system suggest a matching matter; users still confirm uncertain matches." control={toggle("automatic_matter_matching")}/>
      </div><div className="mt-5 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Recording retention<input type="number" className={`${field} mt-2`} value={interaction.recording_retention_days} onChange={e=>setInteraction({...interaction,recording_retention_days:Number(e.target.value)})}/></label><label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Transcript retention<input type="number" className={`${field} mt-2`} value={interaction.transcript_retention_days} onChange={e=>setInteraction({...interaction,transcript_retention_days:Number(e.target.value)})}/></label></div></div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BrainCircuit className="h-5 w-5 text-emerald-800"/><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">AI policy</p><h2 className="text-xl font-semibold text-slate-950">Hide provider complexity from staff</h2></div></div><div className="mt-5 space-y-4"><label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Normal user mode<select className={`${field} mt-2`} value={ai.user_facing_mode} onChange={e=>setAi({...ai,user_facing_mode:e.target.value})}><option value="standard">Standard</option><option value="high_accuracy">High accuracy</option><option value="private">Private</option><option value="local">Local</option></select></label><label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Highly confidential matters<select className={`${field} mt-2`} value={ai.highly_confidential_mode} onChange={e=>setAi({...ai,highly_confidential_mode:e.target.value})}><option value="local">Local only</option><option value="private">Private route</option><option value="disabled">AI disabled</option></select></label><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><LockKeyhole className="mr-2 inline h-4 w-4"/>The ordinary user sees modes, not provider names. Provider/API routing remains an administrator concern.</div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><WandSparkles className="mr-2 inline h-4 w-4"/>AI suggestions remain proposals. Lawyer-confirmed facts, instructions and deadlines remain authoritative.</div></div></div>
    </section>
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-800"/><div><h2 className="text-lg font-semibold text-slate-950">Everyday confidentiality stays simple</h2><p className="mt-1 text-sm text-slate-500">Firm · Restricted · Highly confidential. The platform translates these into ethical walls, AI/storage restrictions and sharing controls underneath.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">Firm</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Restricted</span><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Highly confidential</span></div></section>
  </div></main>;
}
function Setting({title,text,control}:{title:string;text:string;control:React.ReactNode}){return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4"><div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>{control}</div>}
