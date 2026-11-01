"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowLeft,Check,Loader2,Plus,Trash2,UserRound } from "lucide-react";
type Item={id:string;kind:string;title:string;body:string;status:string};
type Payload={success:boolean;error?:string;email?:string;profile:{display_name:string;profession_claim:string;preferred_language:string}|null;items:Item[];firmMemberships:{firm_id:string;role_key:string;title:string|null;firmName:string}[]};
const professions=["unspecified","lawyer","bailiff","magistrate","clerk","paralegal","student","client","other"];
const input="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700";
export default function PersonalWorkspace(){
 const [data,setData]=useState<Payload|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[name,setName]=useState(""),[profession,setProfession]=useState("unspecified");
 const [kind,setKind]=useState("task"),[title,setTitle]=useState(""),[body,setBody]=useState("");
 async function load(){
  const res=await fetch("/api/personal-workspace",{credentials:"include",cache:"no-store"});
  if(res.status===401){window.location.replace("/auth?redirectTo=%2Fme");return;}
  const p=await res.json() as Payload;
  if(!res.ok||!p.success)throw new Error(p.error??"Unable to load workspace.");
  setData(p);setName(p.profile?.display_name??"");setProfession(p.profile?.profession_claim??"unspecified");
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:"Load failed.")).finally(()=>setLoading(false));},[]);
 async function save(method:"POST"|"PATCH"|"DELETE",payload:Record<string,unknown>,id?:string){
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/personal-workspace"+(id?"?id="+encodeURIComponent(id):""),{method,credentials:"include",headers:{"Content-Type":"application/json"},...(method==="DELETE"?{}:{body:JSON.stringify(payload)})});
   const r=await res.json() as {success?:boolean;error?:string};
   if(!res.ok||!r.success)throw new Error(r.error??"Save failed.");
   if(payload.action==="create_item"){setTitle("");setBody("");}
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Save failed.");}finally{setBusy(false);}
 }
 async function enterFirm(firmId:string){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/session/active-firm",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({firmId})});
   const result=await response.json() as {success?:boolean;error?:string};
   if(!response.ok||!result.success)throw new Error(result.error??"Unable to enter firm.");
   window.location.assign("/workspace");
  }catch(e){setError(e instanceof Error?e.message:"Unable to enter firm.");setBusy(false);}
 }
 if(loading)return <main className="grid min-h-screen place-items-center"><Loader2 aria-label="Loading" className="animate-spin"/></main>;
 return <main className="min-h-screen bg-[#f5f7f4] px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl">
  {data?.firmMemberships.length?<Link href="/workspace" className="flex items-center gap-2 text-sm text-emerald-900"><ArrowLeft size={16}/> Firm workspace</Link>:null}
  <header className="mt-6 rounded-3xl bg-[#092c23] p-8 text-white"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-200"><UserRound size={16}/> TSIDKENU · LEGAL LIFE</p>
  <h1 className="mt-4 text-3xl font-semibold">Your independent professional space</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">One permanent identity, separate from firm-owned matters. This area is for your personal non-confidential notes, research and tasks.</p><p className="mt-3 text-xs text-amber-100">Self-declared professions do not establish professional authority or verified credentials.</p></header>
  {error?<div role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{error}</div>:null}
  <div className="mt-6 grid gap-6 md:grid-cols-2">
   <div className="space-y-6"><section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">My identity</h2><p className="mt-1 text-xs text-slate-500">{data?.email}</p>
    <label className="mt-5 block text-sm">Display name<input className={input} value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
    <label className="mt-4 block text-sm">Professional capacity (self-declared)<select className={input} value={profession} onChange={e=>setProfession(e.target.value)}>{professions.map(p=><option value={p} key={p}>{p}</option>)}</select></label>
    <button disabled={busy||!name.trim()} className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>void save("POST",{action:"profile",displayName:name,profession,language:data?.profile?.preferred_language??"en"})}><Check size={16}/> Save profile</button>
   </section><section id="my-organizations" className="scroll-mt-8 rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">My organizations</h2><p className="mt-2 text-sm text-slate-500">Your firm permissions remain separate.</p>
   {data?.firmMemberships.length?<ul className="mt-4 space-y-2">{data.firmMemberships.map(m=><li key={m.firm_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span><strong>{m.firmName}</strong> <span className="text-slate-500">· {m.title||m.role_key}</span></span><button disabled={busy} onClick={()=>void enterFirm(m.firm_id)} className="rounded-lg bg-emerald-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Enter firm</button></li>)}</ul>:<div className="mt-4 space-y-3"><p className="text-sm text-slate-500">No firm membership required. Your personal space is ready.</p><Link href="/onboarding" className="inline-flex rounded-xl border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900">Set up a firm workspace</Link></div>}</section></div>
   <div className="space-y-6"><section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Create personal work</h2>
    <label className="mt-4 block text-sm">Type<select className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="task">Task</option><option value="note">Note</option><option value="research">Research</option></select></label>
    <label className="mt-4 block text-sm">Title<input className={input} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="mt-4 block text-sm">Details<textarea className={input} rows={3} maxLength={20000} value={body} onChange={e=>setBody(e.target.value)}/></label>
    <button disabled={busy||!title.trim()} className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>void save("POST",{action:"create_item",kind,title,body})}><Plus size={16}/> Add personal item</button>
   </section><section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Personal work queue</h2>
   {!data?.items.length?<p className="mt-4 text-sm text-slate-500">No personal items yet.</p>:<div className="mt-4 space-y-3">{data.items.map(item=><article key={item.id} className="rounded-xl border p-4"><div className="flex justify-between gap-4"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-slate-500">{item.kind} · {item.status}</p></div><div className="flex gap-2"><button aria-label="Toggle done" disabled={busy} className="rounded-lg border p-2" onClick={()=>void save("PATCH",{id:item.id,status:item.status==="done"?"open":"done"})}><Check size={16}/></button><button aria-label="Delete item" disabled={busy} className="rounded-lg border p-2 text-rose-700" onClick={()=>void save("DELETE",{},item.id)}><Trash2 size={16}/></button></div></div>{item.body?<p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>:null}</article>)}</div>}</section></div>
  </div>
 </div></main>;
}
