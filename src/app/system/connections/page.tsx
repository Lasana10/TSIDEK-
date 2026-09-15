"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Database, Loader2, LockKeyhole, PlugZap, RefreshCw, Save, ShieldCheck } from "lucide-react";

type Connection = { provider:string; display_name?:string|null; status:string; credential_mode:string; configuration?:Record<string,unknown>; last_verified_at?:string|null; last_error?:string|null };
type Storage = { provider:string; status:string; last_verified_at?:string|null; last_error?:string|null };

const providerFields: Record<string, { label:string; fields:{key:string;label:string;type?:string}[] }> = {
  nextcloud: { label:"Nextcloud", fields:[{key:"baseUrl",label:"Server URL"},{key:"username",label:"Username"},{key:"appPassword",label:"App password",type:"password"}] },
  firebase: { label:"Firebase", fields:[{key:"projectId",label:"Project ID"},{key:"clientEmail",label:"Service-account email"},{key:"privateKey",label:"Private key",type:"password"}] },
  meta_whatsapp: { label:"WhatsApp", fields:[{key:"phoneNumberId",label:"Phone number ID"},{key:"accessToken",label:"Access token",type:"password"},{key:"appSecret",label:"App secret",type:"password"},{key:"verifyToken",label:"Verify token",type:"password"},{key:"graphVersion",label:"Graph version"}] },
  openrouter: { label:"OpenRouter", fields:[{key:"apiKey",label:"API key",type:"password"}] },
  pawapay: { label:"pawaPay", fields:[{key:"apiToken",label:"API token",type:"password"},{key:"environment",label:"Environment (sandbox/production)"},{key:"apiUrl",label:"Optional API URL"}] },
  resend: { label:"Resend", fields:[{key:"apiKey",label:"API key",type:"password"},{key:"fromEmail",label:"From email"}] },
};

export default function ConnectionsPage() {
  const [connections,setConnections]=useState<Connection[]>([]);
  const [storage,setStorage]=useState<Storage|null>(null);
  const [selected,setSelected]=useState("nextcloud");
  const [values,setValues]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const [integrationsResponse,storageResponse]=await Promise.all([fetch("/api/firm/integrations",{cache:"no-store"}),fetch("/api/firm/storage",{cache:"no-store"})]);
    const integrationsJson=await integrationsResponse.json(); const storageJson=await storageResponse.json();
    if(integrationsJson.success) setConnections(integrationsJson.integrations||[]);
    if(storageJson.success) setStorage(storageJson.storage||null);
  }
  useEffect(()=>{void load();},[]);
  const current=useMemo(()=>connections.find((item)=>item.provider===selected),[connections,selected]);

  async function save(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/firm/integrations/credentials",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:selected,credentials:values,displayName:providerFields[selected]?.label})});
      const json=await response.json(); if(!response.ok||!json.success) throw new Error(json.error||"Unable to connect provider.");
      setValues({}); setMessage(`${providerFields[selected]?.label||selected} credentials stored securely. Verify the connection next.`); await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to connect provider.");}finally{setBusy(false);}
  }

  async function verify(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/integrations/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:selected})});
      const json=await response.json(); if(!response.ok||!json.success) throw new Error(json.error||"Verification failed.");
      setMessage(`${providerFields[selected]?.label||selected} verified against the provider.`); await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Verification failed.");}finally{setBusy(false);}
  }

  async function setStorageProvider(provider:string){
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/firm/storage",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,configuration:{}})});const json=await response.json();if(!response.ok||!json.success)throw new Error(json.error||"Unable to change storage.");setStorage(json.storage);setMessage("Firm storage policy updated.");}catch(error){setMessage(error instanceof Error?error.message:"Unable to change storage.");}finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-[#f5f7f4] px-4 py-6 text-slate-700 md:px-6 xl:px-8"><div className="mx-auto max-w-[1500px] space-y-6">
    <section className="rounded-[2rem] bg-[#082b22] p-6 text-white shadow-xl md:p-8"><Link href="/system" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/55"><ArrowLeft className="h-4 w-4"/>System control</Link><div className="mt-5 flex items-start gap-4"><div className="rounded-2xl bg-white/10 p-3"><PlugZap className="h-6 w-6"/></div><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-white/45">Firm-owned infrastructure</p><h1 className="mt-1 text-3xl font-semibold md:text-4xl">Connections & Storage</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">Each firm can connect its own providers. Credentials are encrypted server-side and never displayed back to staff.</p></div></div></section>
    {message?<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>:null}
    <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <section className="space-y-3 rounded-[1.7rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-emerald-900"/><h2 className="text-xl font-semibold text-slate-950">Provider connections</h2></div>{Object.entries(providerFields).map(([provider,definition])=>{const connection=connections.find((item)=>item.provider===provider);return <button key={provider} onClick={()=>{setSelected(provider);setValues({});setMessage("");}} className={`w-full rounded-2xl border p-4 text-left transition ${selected===provider?"border-emerald-800 bg-emerald-50":"border-slate-200"}`}><div className="flex items-center justify-between"><span className="font-semibold text-slate-900">{definition.label}</span>{connection?.status==="verified"?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<RefreshCw className="h-4 w-4 text-slate-400"/>}</div><p className="mt-1 text-xs text-slate-500">{connection?`${connection.status} · ${connection.credential_mode}`:"Not connected for this firm"}</p>{connection?.last_verified_at?<p className="mt-1 text-[11px] text-emerald-700">Verified {new Date(connection.last_verified_at).toLocaleString()}</p>:null}</button>})}</section>
      <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-400">{current?.status||"not connected"}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{providerFields[selected]?.label}</h2></div><ShieldCheck className="h-6 w-6 text-emerald-900"/></div><p className="mt-3 text-sm leading-6 text-slate-500">Enter or rotate this firm&apos;s credentials. Saved secrets cannot be read back from the browser.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{providerFields[selected]?.fields.map((field)=><label key={field.key} className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">{field.label}<input type={field.type||"text"} value={values[field.key]||""} onChange={(event)=>setValues((old)=>({...old,[field.key]:event.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-emerald-700" autoComplete="off"/></label>)}</div><div className="mt-6 flex flex-wrap gap-3"><button disabled={busy||!Object.values(values).some(Boolean)} onClick={save} className="inline-flex items-center gap-2 rounded-full bg-[#082b22] px-5 py-3 text-xs font-black uppercase tracking-[.16em] text-white disabled:opacity-40">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Save encrypted credentials</button><button disabled={busy||!current} onClick={verify} className="inline-flex items-center gap-2 rounded-full border border-emerald-900 px-5 py-3 text-xs font-black uppercase tracking-[.16em] text-emerald-950 disabled:opacity-40"><RefreshCw className="h-4 w-4"/>Verify now</button></div>{current?.last_error?<p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{current.last_error}</p>:null}</section>
    </div>
    <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><Database className="h-5 w-5 text-emerald-900"/><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-400">Storage policy</p><h2 className="text-xl font-semibold text-slate-950">Where this firm keeps document bytes</h2></div></div><div className="mt-5 grid gap-3 md:grid-cols-4">{[["secure_vault","TSIDKENU Secure Vault","Managed private vault"],["nextcloud","Nextcloud","Firm-owned WebDAV storage"],["onedrive","OneDrive","Requires Microsoft authorization"],["local_private","Local / NAS","Requires local connector agent"]].map(([provider,label,text])=><button key={provider} disabled={busy||provider==="onedrive"||provider==="local_private"} onClick={()=>setStorageProvider(provider)} className={`rounded-2xl border p-4 text-left disabled:opacity-45 ${storage?.provider===provider?"border-emerald-800 bg-emerald-50":"border-slate-200"}`}><p className="font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></button>)}</div><p className="mt-4 text-xs text-slate-500">Active: <strong>{storage?.provider||"secure_vault"}</strong>. Secure Vault remains available even when external storage is not connected.</p></section>
  </div></main>;
}
