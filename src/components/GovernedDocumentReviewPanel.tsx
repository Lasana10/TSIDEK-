"use client";
import {useCallback,useEffect,useState} from "react";
import {useLocale} from "@/components/LocaleProvider";
type Doc={id:string;title:string;document_type:string|null;status:string;review_status:string;sharing_policy:string;originalStored:boolean;review_note:string|null};
export default function GovernedDocumentReviewPanel({matterId}:{matterId:string}){
 const {locale}=useLocale();const t=(en:string,fr:string)=>locale==="fr"?fr:en;
 const [docs,setDocs]=useState<Doc[]>([]),[note,setNote]=useState<Record<string,string>>({}),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
 const load=useCallback(async()=>{
  const r=await fetch(`/api/matters/${matterId}/document-review`,{credentials:"include",cache:"no-store"});
  const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||"Document review unavailable");
  setDocs(data.documents??[]);
 },[matterId]);
 useEffect(()=>{void load().catch(e=>setMessage(e instanceof Error?e.message:"Unable to load review"));},[load]);
 async function act(id:string,action:string){
  setBusy(id);setMessage("");
  try{
   const r=await fetch(`/api/matters/${matterId}/document-review`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,documentId:id,note:note[id]||""})});
   const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||"Document action failed");
   await load();setMessage(t("Document state updated with audit record.","État du document mis à jour et tracé."));
  }catch(e){setMessage(e instanceof Error?e.message:"Action failed")}finally{setBusy("");}
 }
 return <section id="governed-document-review" className="scroll-mt-8 rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-800">{t("Governed document custody","Conservation et contrôle des documents")}</p>
  <h2 className="mt-2 text-2xl font-semibold">{t("Review → Approve → File → Archive / Share","Examiner → Approuver → Classer → Archiver / Partager")}</h2>
  <p className="mt-2 text-sm text-slate-600">{t("Only approved documents with an existing private-vault original can be filed or shared with a client.","Seuls les documents approuvés, avec original présent dans le coffre privé, peuvent être classés ou partagés avec un client.")}</p>
  {message&&<div role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{message}</div>}
  <div className="mt-5 space-y-3">{docs.map(d=><article key={d.id} className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{d.title}</p><p className="mt-1 text-xs text-slate-500">{d.document_type||t("Document","Document")} · {d.status} · {d.review_status}</p></div>
      <span className="text-xs text-emerald-800">{d.originalStored?t("Vault original recorded","Original enregistré"):t("No stored original","Aucun original enregistré")}</span></div>
    <label className="mt-3 block text-xs">{t("Review note / reason","Note / motif de révision")}
      <input value={note[d.id]??""} onChange={e=>setNote(p=>({...p,[d.id]:e.target.value}))} className="mt-2 w-full rounded-lg border p-2 text-sm" maxLength={2000}/></label>
    <div className="mt-3 flex flex-wrap gap-2">
      {([["submit",t("Submit","Soumettre")],["approve",t("Approve","Approuver")],["return",t("Request changes","Demander correction")],["file",t("File","Classer")],["archive",t("Archive","Archiver")],["share",t("Share with client","Partager avec le client")],["unshare",t("Withdraw sharing","Retirer le partage")]] as const).map(([action,label])=>
       <button key={action} disabled={Boolean(busy)||(["approve","file","archive","share"].includes(action)&&!d.originalStored)} onClick={()=>void act(d.id,action)} className="rounded-lg border border-emerald-800/20 px-3 py-2 text-xs font-semibold text-emerald-950 disabled:opacity-40">{label}</button>)}
    </div>
    {d.sharing_policy==="Client-share ready"&&<p className="mt-2 text-xs text-emerald-800">{t("Approved for client access subject to active client grant.","Partage approuvé, sous réserve d'un accès client actif.")}</p>}
  </article>)}
  {!docs.length&&<p className="text-sm text-slate-500">{t("No document records yet.","Aucun document enregistré.")}</p>}
  </div>
 </section>;
}
