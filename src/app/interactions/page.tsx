"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquareText, Phone, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

type Party = { id:string; display_name:string; phone?:string|null; email?:string|null; client_status:string; preferred_language:string };
type Interaction = { id:string; interaction_type:string; occurred_at:string; subject?:string|null; raw_note?:string|null; confidentiality_level:string; verification_status:string; primary_party_id?:string|null; matter_id?:string|null };
type Payload = { success:boolean; error?:string; parties?:Party[]; interactions?:Interaction[]; policy?:Record<string,unknown>|null };

const input = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-900/5";
const types = [
  ["walk_in","Walk-in / office"], ["office_meeting","Office meeting"], ["phone_call","Phone call"], ["whatsapp","WhatsApp"], ["email","Email"], ["portal","Client portal"], ["referral","Referral"], ["court_encounter","Court / external encounter"], ["other","Other"]
] as const;

export default function InteractionsPage(){
  const [data,setData]=useState<Payload>({success:true,parties:[],interactions:[]});
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [partyId,setPartyId]=useState("");
  const [type,setType]=useState("walk_in");
  const [subject,setSubject]=useState("");
  const [note,setNote]=useState("");
  const [confidentiality,setConfidentiality]=useState("firm");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const [newName,setNewName]=useState("");
  const [newPhone,setNewPhone]=useState("");

  async function load(q=""){
    const res=await fetch(`/api/interactions${q?`?q=${encodeURIComponent(q)}`:""}`,{cache:"no-store"});
    const payload=await res.json(); setData(payload);
  }
  useEffect(()=>{load().catch(e=>setData({success:false,error:e.message})).finally(()=>setLoading(false));},[]);
  useEffect(()=>{const t=setTimeout(()=>{if(search.trim()) load(search.trim()).catch(()=>{}); else load().catch(()=>{});},250);return()=>clearTimeout(t);},[search]);

  const parties=data.parties??[];
  const interactions=data.interactions??[];
  const selected=useMemo(()=>parties.find(p=>p.id===partyId),[parties,partyId]);

  async function createParty(){
    if(!newName.trim()) return; setSaving(true); setMessage("");
    try{const r=await fetch("/api/interactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_party",displayName:newName,phone:newPhone})});const p=await r.json();if(!p.success)throw new Error(p.error);setPartyId(p.party.id);setNewName("");setNewPhone("");await load(search);setMessage("Contact created and selected.");}catch(e){setMessage(e instanceof Error?e.message:"Unable to create contact.");}finally{setSaving(false)}
  }

  async function createInteraction(){
    if(!partyId && !note.trim() && !subject.trim()){setMessage("Select a person or add a short note.");return;}
    setSaving(true);setMessage("");
    try{const r=await fetch("/api/interactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({interactionType:type,partyId:partyId||null,subject,note,confidentialityLevel:confidentiality,requestAnalysis:false,requestTranscription:false})});const p=await r.json();if(!p.success)throw new Error(p.error);setSubject("");setNote("");setMessage("Interaction recorded.");await load(search);}catch(e){setMessage(e instanceof Error?e.message:"Unable to record interaction.");}finally{setSaving(false)}
  }

  if(loading) return <main className="min-h-screen bg-slate-50 p-6">Loading interaction desk…</main>;
  if(!data.success) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8">{data.error||"Unable to load."}</div></main>;

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#edf3f1_100%)] p-4 text-slate-800 md:p-6 xl:p-8">
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section className="rounded-[2rem] bg-[#082b22] p-6 text-white shadow-xl md:p-8">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60"><ArrowLeft className="h-4 w-4"/>Workspace</Link>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Interaction desk</p><h1 className="mt-2 text-4xl font-semibold">Record what actually happened.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Walk-ins, meetings, calls, WhatsApp, email and referrals enter one governed stream. Known people are reused; new people need only the minimum.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/70"><ShieldCheck className="mr-2 inline h-4 w-4"/>AI/transcription stay optional and policy-controlled.</div></div>
      </section>

      {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><Search className="h-5 w-5 text-emerald-800"/><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Search first</p><h2 className="text-xl font-semibold text-slate-950">Find existing person or client</h2></div></div>
            <input className={`${input} mt-4`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone or email"/>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">{parties.map(p=><button key={p.id} onClick={()=>setPartyId(p.id)} className={`w-full rounded-2xl border p-3 text-left ${partyId===p.id?"border-emerald-700 bg-emerald-50":"border-slate-100"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{p.display_name}</p><p className="text-xs text-slate-500">{[p.phone,p.email].filter(Boolean).join(" • ")||"No contact detail"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{p.client_status.replace("_"," ")}</span></div></button>)}</div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><UserPlus className="h-5 w-5 text-emerald-800"/><h2 className="text-lg font-semibold text-slate-950">New person — minimum capture</h2></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><input className={input} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name"/><input className={input} value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Phone (optional)"/></div>
            <button onClick={createParty} disabled={saving||!newName.trim()} className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Create contact</button>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><MessageSquareText className="h-5 w-5 text-emerald-800"/><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">One capture surface</p><h2 className="text-xl font-semibold text-slate-950">{selected?`Record interaction — ${selected.display_name}`:"Record interaction"}</h2></div></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2"><select className={input} value={type} onChange={e=>setType(e.target.value)}>{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select className={input} value={confidentiality} onChange={e=>setConfidentiality(e.target.value)}><option value="firm">Firm</option><option value="restricted">Restricted</option><option value="highly_confidential">Highly confidential</option></select></div>
            <input className={`${input} mt-3`} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Short reason / subject (optional)"/>
            <textarea className={`${input} mt-3 min-h-36`} value={note} onChange={e=>setNote(e.target.value)} placeholder="Short note, dictated summary or what changed…"/>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={createInteraction} disabled={saving} className="rounded-2xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Record interaction"}</button><span className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500"><Phone className="mr-2 inline h-4 w-4"/>Recording/transcription appear only when enabled by firm policy.</span></div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-emerald-800"/><h2 className="text-lg font-semibold text-slate-950">Recent interactions</h2></div>
            <div className="mt-4 space-y-2">{interactions.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No interaction records yet.</p>:interactions.slice(0,12).map(i=><div key={i.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-900">{i.subject||i.interaction_type.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(i.occurred_at).toLocaleString()} · {i.confidentiality_level.replaceAll("_"," ")}</p>{i.raw_note&&<p className="mt-2 line-clamp-2 text-sm text-slate-600">{i.raw_note}</p>}</div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{i.verification_status}</span></div></div>)}</div>
          </div>
        </section>
      </div>
    </div>
  </main>;
}
