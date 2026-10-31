"use client";
import { useCallback,useEffect,useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
type Update={id:string;title:string;body:string;status:string;created_at:string};
type Grant={id:string;client_email:string};
type Publication={id:string;update_id:string;grant_id:string;client_email:string;published_at:string};
type Ack={publication_id:string;acknowledged_at:string;client_email:string};
type Data={success:boolean;error?:string;updates?:Update[];grants?:Grant[];publications?:Publication[];acknowledgements?:Ack[]};
export default function MatterClientDeliveryPanel({matterId}:{matterId:string}){
 const {locale}=useLocale();const t=(en:string,fr:string)=>locale==="fr"?fr:en;
 const [data,setData]=useState<Data|null>(null);
 const [title,setTitle]=useState(""),[message,setMessage]=useState("");
 const [busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const [selectedGrants,setSelectedGrants]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  const r=await fetch(`/api/matters/${matterId}/client-delivery`,{credentials:"include",cache:"no-store"});
  const p=await r.json() as Data;if(!r.ok||!p.success)throw new Error(p.error||"Unable to load client deliveries");
  setData(p);
 },[matterId]);
 useEffect(()=>{void load().catch(e=>setNotice(e instanceof Error?e.message:"Unable to load client updates"));},[load]);
 async function act(action:"draft"|"approve"|"publish",updateId?:string){
  setBusy(updateId??"draft");setNotice("");
  try{
   const r=await fetch(`/api/matters/${matterId}/client-delivery`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,updateId,grantId:updateId?selectedGrants[updateId]:null,title,message}),
   });
   const p=await r.json() as {success:boolean;error?:string};if(!r.ok||!p.success)throw new Error(p.error||"Action failed");
   if(action==="draft"){setTitle("");setMessage("");}
   await load();
   setNotice(action==="draft"?t("Draft saved for review.","Projet enregistré pour examen."):action==="approve"?t("Approved for controlled client publication.","Approuvé pour publication au client."):t("Published to the authorized client portal. Client acknowledgment is pending.","Publié dans l'espace client autorisé. Accusé de lecture en attente."));
  }catch(e){setNotice(e instanceof Error?e.message:"Action failed");}
  finally{setBusy("");}
 }
 const publications=data?.publications??[],acks=data?.acknowledgements??[],grants=data?.grants??[];
 return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-800">{t("Governed client communication","Communication client contrôlée")}</p>
  <h2 className="mt-2 text-2xl font-semibold">{t("From professional approval to client acknowledgment","De l’approbation professionnelle à l’accusé de lecture du client")}</h2>
  <p className="mt-2 text-sm leading-6 text-slate-600">{t("Publishing makes an update available to one authorized client. It does not prove the client read it. Only the client can acknowledge after sign-in.","La publication rend le message accessible à un client autorisé, sans prouver sa lecture. Seul le client connecté peut confirmer sa lecture.")}</p>
  {notice&&<div role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{notice}</div>}
  <div className="mt-5 space-y-2">
   <label className="block text-sm font-semibold">{t("Update title","Titre de la communication")}
    <input maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm" /></label>
   <label className="block text-sm font-semibold">{t("Client-safe message","Message destiné au client")}
    <textarea maxLength={10000} rows={3} value={message} onChange={e=>setMessage(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm"/></label>
   <button disabled={Boolean(busy)||title.trim().length<4||message.trim().length<10} onClick={()=>void act("draft")} className="rounded-xl bg-emerald-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{t("Save review draft","Enregistrer le projet à examiner")}</button>
  </div>
  <div className="mt-6 space-y-3">
   {(data?.updates??[]).map(u=>{
    const associated=publications.filter(p=>p.update_id===u.id);
    return <article key={u.id} className="rounded-2xl border border-slate-200 p-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{u.title}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{u.status}</span></div>
     <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{u.body}</p>
     {u.status==="Draft"&&<button disabled={Boolean(busy)} onClick={()=>void act("approve",u.id)} className="mt-3 rounded-lg bg-emerald-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{t("Approve professionally","Approuver professionnellement")}</button>}
     {(u.status==="Approved"||u.status==="Published")&&<div className="mt-3 flex flex-wrap gap-2">
      <label className="text-xs">{t("Authorized recipient","Destinataire autorisé")}
       <select value={selectedGrants[u.id]??""} onChange={e=>setSelectedGrants(p=>({...p,[u.id]:e.target.value}))} className="ml-2 rounded-lg border p-2 text-xs"><option value="">{t("Choose client","Choisir le client")}</option>{grants.map(g=><option key={g.id} value={g.id}>{g.client_email}</option>)}</select>
      </label>
      <button disabled={Boolean(busy)||!selectedGrants[u.id]} onClick={()=>void act("publish",u.id)} className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{t("Publish to client portal","Publier dans l’espace client")}</button>
     </div>}
     {associated.length>0&&<ul className="mt-3 space-y-1 text-xs text-slate-600">{associated.map(p=>{
      const ack=acks.find(a=>a.publication_id===p.id);
      return <li key={p.id}>{p.client_email}: {ack?t("Client acknowledged","Lecture confirmée par le client")+" · "+new Date(ack.acknowledged_at).toLocaleString():t("Available; awaiting client acknowledgment","Disponible ; lecture non confirmée")}</li>;
     })}</ul>}
    </article>;
   })}
   {!data?.updates?.length&&<p className="text-sm text-slate-500">{t("No client updates created for this matter.","Aucune communication enregistrée pour ce dossier.")}</p>}
  </div>
 </section>;
}
