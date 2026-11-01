"use client";
import { useCallback,useEffect,useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
type Source={id:string;title:string;publisher:string;jurisdiction:string;source_url:string|null;version_label:string|null;ingestion_status:string;verification_status:string;verified_at:string|null;source_class:string};
type Hit={chunk_id:string;title:string;content:string;source_url:string|null;canonical_uri:string|null;section_path:string|null;publisher:string;source_checksum:string;version_label:string|null;valid_from:string|null;valid_until:string|null;rank:number};
type Citation={id:string;source_title:string;source_checksum:string;quoted_excerpt:string;source_version:string|null;citation_note:string|null};
export default function MatterLawBankPanel({matterId}:{matterId:string}){
 const {locale}=useLocale(),t=(en:string,fr:string)=>locale==="fr"?fr:en;
 const[query,setQuery]=useState(""),[asOf,setAsOf]=useState(new Date().toISOString().slice(0,10)),[hits,setHits]=useState<Hit[]>([]);
 const[sources,setSources]=useState<Source[]>([]),[citations,setCitations]=useState<Citation[]>([]);
 const[note,setNote]=useState<Record<string,string>>({}),[reviewNote,setReviewNote]=useState<Record<string,string>>({}),[rights,setRights]=useState<Record<string,string>>({});
 const[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const [a,b]=await Promise.all([
   fetch("/api/legal-sources",{cache:"no-store",credentials:"include"}),
   fetch(`/api/matters/${matterId}/citations`,{cache:"no-store",credentials:"include"})]);
  const x=await a.json(),y=await b.json();
  if(!a.ok||!x.success)throw Error(x.error||"Source registry unavailable");
  if(!b.ok||!y.success)throw Error(y.error||"Matter citations unavailable");
  setSources(x.sources??[]);setCitations(y.citations??[]);
 },[matterId]);
 useEffect(()=>{void load().catch(e=>setNotice(e instanceof Error?e.message:"Unable to load legal sources"));},[load]);
 async function search(){
  setBusy("search");setNotice("");
  try{
   const r=await fetch("/api/legal-research",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query,matterId,asOfDate:asOf,limit:12})});
   const x=await r.json();if(!r.ok||!x.success)throw Error(x.error||"Research failed");
   setHits(x.hits??[]);if(x.warning)setNotice(x.warning);
  }catch(e){setNotice(e instanceof Error?e.message:"Research failed")}finally{setBusy("");}
 }
 async function cite(chunkId:string){
  setBusy(chunkId);setNotice("");
  try{
   const r=await fetch(`/api/matters/${matterId}/citations`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chunkId,note:note[chunkId]||""})});
   const x=await r.json();if(!r.ok||!x.success)throw Error(x.error||"Unable to cite");
   await load();setNotice(t("Verified passage cited in matter record.","Passage vérifié cité dans le dossier."));
  }catch(e){setNotice(e instanceof Error?e.message:"Unable to cite")}finally{setBusy("");}
 }
 async function review(source:Source,action:"verify"|"reject"|"revoke"){
  setBusy(source.id);setNotice("");
  try{
   const r=await fetch("/api/legal-sources/review",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({sourceId:source.id,action,sourceClass:source.source_class==="unclassified"?"secondary":source.source_class,
    note:reviewNote[source.id]||"",rightsAttestation:rights[source.id]||""})});
   const x=await r.json();if(!r.ok||!x.success)throw Error(x.error||"Review failed");
   await load();setNotice(t("Source review recorded. Verify actual text and law before relying on it.","Révision enregistrée. Contrôler le texte et le droit applicable avant utilisation."));
  }catch(e){setNotice(e instanceof Error?e.message:"Review failed")}finally{setBusy("");}
 }
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
  <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">LawBank · {t("Trusted matter research","Recherche juridique vérifiée")}</p>
  <h2 className="mt-2 text-xl font-semibold">{t("Research, verify and cite legal sources","Rechercher, vérifier et citer les sources juridiques")}</h2>
  <p className="mt-2 text-sm text-slate-600">{t("Only professionally verified, rights-cleared passages effective on the selected date appear as research evidence. Source discovery is not a legal opinion.","Seuls les passages vérifiés par un professionnel, autorisés et en vigueur à la date choisie apparaissent comme preuves de recherche. La découverte ne constitue pas un avis juridique.")}</p>
  {notice&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">{notice}</p>}
  <div className="mt-5 flex flex-wrap gap-3"><input aria-label="Legal research" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search laws and provisions","Chercher des lois et dispositions")} className="min-w-[180px] flex-1 rounded-xl border p-3 text-sm"/><input aria-label="Effective date" type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} className="rounded-xl border p-3 text-sm"/><button disabled={Boolean(busy)||query.trim().length<3} onClick={()=>void search()} className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("Search verified law","Rechercher les textes vérifiés")}</button></div>
  <div className="mt-4 space-y-3">{hits.map(h=><article key={h.chunk_id} className="rounded-xl border p-4"><p className="font-semibold">{h.title}</p><p className="mt-1 text-xs text-slate-500">{h.publisher} · {h.version_label||t("Version unspecified","Version non précisée")} · {h.section_path||""}</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{h.content.length>900?h.content.slice(0,900)+"…":h.content}</p>{h.source_url&&<a href={h.source_url} rel="noopener noreferrer" target="_blank" className="mt-2 block text-xs text-emerald-800 underline">{t("Original source","Source originale")}</a>}<input aria-label="Citation note" maxLength={1000} value={note[h.chunk_id]??""} onChange={e=>setNote(x=>({...x,[h.chunk_id]:e.target.value}))} placeholder={t("Why this passage matters","Pertinence du passage")} className="mt-3 w-full rounded-lg border p-2 text-xs"/><button disabled={Boolean(busy)} onClick={()=>void cite(h.chunk_id)} className="mt-2 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{t("Attach verified citation","Ajouter la citation vérifiée")}</button></article>)}</div>
  <h3 className="mt-7 font-semibold">{t("Matter citation register","Registre des citations du dossier")}</h3><div className="mt-2 space-y-2">{citations.map(c=><div key={c.id} className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-semibold">{c.source_title} · {c.source_version||""}</p><p className="mt-1 text-slate-600">{c.quoted_excerpt.slice(0,240)}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{c.source_checksum.slice(0,16)}</p></div>)}{!citations.length&&<p className="text-sm text-slate-500">{t("No citations saved yet.","Aucune citation enregistrée.")}</p>}</div>
  <details className="mt-6 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">{t("Review firm legal sources (authorized governors only)","Examiner les sources du cabinet (responsables autorisés)")}</summary><div className="mt-4 space-y-3">{sources.filter(s=>s.verification_status!=="verified"||s.ingestion_status!=="ready").slice(0,30).map(s=><div key={s.id} className="rounded-lg border p-3"><p className="text-sm font-semibold">{s.title}</p><p className="text-xs text-slate-500">{s.publisher} · {s.jurisdiction} · {s.ingestion_status} · {s.verification_status}</p><textarea aria-label="Review rationale" value={reviewNote[s.id]??""} onChange={e=>setReviewNote(v=>({...v,[s.id]:e.target.value}))} placeholder={t("Explain textual, jurisdictional and temporal verification (20+ characters)","Décrire les vérifications textuelles, juridictionnelles et temporelles (20 caractères minimum)")} className="mt-2 w-full rounded-lg border p-2 text-xs"/><textarea aria-label="Rights assessment" value={rights[s.id]??""} onChange={e=>setRights(v=>({...v,[s.id]:e.target.value}))} placeholder={t("Explain lawful reuse / licensing basis","Préciser la base légale de réutilisation / licence")} className="mt-2 w-full rounded-lg border p-2 text-xs"/><div className="mt-2 flex gap-2"><button disabled={Boolean(busy)||s.ingestion_status!=="ready"&&s.ingestion_status!=="needs_review"} onClick={()=>void review(s,"verify")} className="rounded-lg border px-3 py-2 text-xs">{t("Verify","Vérifier")}</button><button disabled={Boolean(busy)} onClick={()=>void review(s,"reject")} className="rounded-lg border px-3 py-2 text-xs">{t("Reject","Rejeter")}</button></div></div>)}</div></details>
 </section>;
}