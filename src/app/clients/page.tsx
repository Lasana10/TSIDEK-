"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CirclePlus, Mail, Phone, Search, UserRound, Users } from "lucide-react";

type Client = { id:string; party_type:string; display_name:string; phone?:string|null; email?:string|null; client_status:string };
type Case = { id:string; title:string; client_name:string; status:string; matter_type?:string|null };
type Prospect = { id:string; prospect_name:string; status:string };
type Payload = { success:boolean; error?:string; clients?:Client[]; cases?:Case[]; prospects?:Prospect[] };

const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none";

export default function ClientsPage() {
  const [data,setData] = useState<Payload>({success:true,clients:[],cases:[],prospects:[]});
  const [loading,setLoading] = useState(true);
  const [query,setQuery] = useState("");
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [form,setForm] = useState({displayName:"",partyType:"individual",phone:"",email:"",preferredLanguage:"en",preferredChannel:"whatsapp"});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/clients",{cache:"no-store",credentials:"include"});
      const payload = await response.json();
      if(!response.ok || !payload.success) throw new Error(payload.error || "Unable to load clients.");
      setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load clients.");
    } finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);

  const casesByClient = useMemo(()=>{
    const map = new Map<string,Case[]>();
    for(const item of data.cases ?? []) {
      const key = item.client_name.trim().toLowerCase();
      map.set(key,[...(map.get(key) ?? []),item]);
    }
    return map;
  },[data.cases]);

  const visible = (data.clients ?? []).filter((client)=>{
    const haystack = [client.display_name,client.phone,client.email,client.client_status].filter(Boolean).join(" ").toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  async function createClient(event:FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/clients",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const payload = await response.json();
      if(!response.ok || !payload.success) throw new Error(payload.error || "Unable to create client.");
      setOpen(false);
      setForm({displayName:"",partyType:"individual",phone:"",email:"",preferredLanguage:"en",preferredChannel:"whatsapp"});
      await load();
      setMessage("Client relationship created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create client.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#eef2ef] p-3 text-slate-900 sm:p-5 lg:p-7">
    <div className="mx-auto max-w-[1760px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>Workspace</Link>
        <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white"><CirclePlus className="h-4 w-4"/>New client</button>
      </div>
      <section className="overflow-hidden rounded-[2rem] bg-[#082b22] text-white">
        <div className="grid xl:grid-cols-[1fr_420px]">
          <div className="p-6 md:p-8 xl:p-10">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d8bb79]">Client relationships</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Clients, cases and communication in one relationship view.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Search by person, organisation, phone or email, then follow every linked case from one client record.</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/10">
            <Metric label="Clients" value={data.clients?.length || 0}/>
            <Metric label="Open intake" value={(data.prospects ?? []).filter(x=>!["closed","converted","rejected"].includes((x.status || "").toLowerCase())).length}/>
            <Metric label="Cases" value={data.cases?.length || 0}/>
            <Metric label="Relationships" value={(data.clients?.length || 0)+(data.prospects?.length || 0)}/>
          </div>
        </div>
      </section>
      {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400"/><input className="w-full py-3 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search client, phone, email or status…"/></label>
      </section>
      {loading ? <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500">Loading client relationships…</div> :
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map(client=>{
          const linked = casesByClient.get(client.display_name.trim().toLowerCase()) ?? [];
          return <article key={client.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf4f0] text-[#0f5b49]">{client.party_type==="organisation"?<Building2 className="h-5 w-5"/>:<UserRound className="h-5 w-5"/>}</div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase">{client.client_status}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{client.display_name}</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-500">
              {client.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4"/>{client.phone}</p>}
              {client.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4"/>{client.email}</p>}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Linked cases</p><span className="text-xs font-bold text-slate-500">{linked.length}</span></div>
              <div className="mt-2 space-y-2">{linked.slice(0,3).map(item=><Link key={item.id} href={"/matters/"+item.id} className="block rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.status} · {item.matter_type || "Case"}</p></Link>)}{!linked.length && <p className="text-xs text-slate-400">No linked case yet.</p>}</div>
            </div>
          </article>
        })}
        {!visible.length && <div className="md:col-span-2 2xl:col-span-3 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Users className="mx-auto h-7 w-7 text-slate-400"/><p className="mt-3 text-sm text-slate-500">No client matches this search.</p></div>}
      </section>}
    </div>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" onClick={()=>!busy&&setOpen(false)}>
      <form onSubmit={createClient} onClick={e=>e.stopPropagation()} className="w-full max-w-2xl rounded-[1.8rem] bg-white p-5 shadow-2xl md:p-6">
        <h2 className="text-2xl font-semibold">Create client</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input required className={field} value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} placeholder="Client / organisation name"/>
          <select className={field} value={form.partyType} onChange={e=>setForm({...form,partyType:e.target.value})}><option value="individual">Individual</option><option value="organisation">Organisation</option></select>
          <input className={field} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone"/>
          <input className={field} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email"/>
          <select className={field} value={form.preferredLanguage} onChange={e=>setForm({...form,preferredLanguage:e.target.value})}><option value="en">English</option><option value="fr">French</option></select>
          <select className={field} value={form.preferredChannel} onChange={e=>setForm({...form,preferredChannel:e.target.value})}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option></select>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-2.5 text-sm font-bold text-white">{busy?"Saving…":"Create client"}</button></div>
      </form>
    </div>}
  </main>
}

function Metric({label,value}:{label:string;value:number}) {
  return <div className="bg-white/[.045] p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>
}