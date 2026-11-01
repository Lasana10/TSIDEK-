"use client";
import {useCallback,useEffect,useState} from "react";
import {useLocale} from "@/components/LocaleProvider";
type Hit={chunk_id:string;source_document_id:string;title:string;jurisdiction:string;section_path:string|null;content:string;source_url:string|null;canonical_uri:string|null;publisher:string;version_label:string|null;valid_from:string|null;valid_until:string|null;verified_at:string;rank:number;source_class:string};
type Citation={id:string;source_title:string;quoted_excerpt:string;cited_at:string;source_version:string|null;citation_note:string|null;currentness:"current_as_recorded"|"recheck_required";currentnessReason:string|null};
type Source={id:string;title:string;publisher:string;jurisdiction:string;ingestion_status:string;verification_status:string;source_class:string;source_url:string|null};
export default function VerifiedMatterLegalResearch({matterId}:{matterId:string}){
 const {locale}=useLocale(),tr=(en:string,fr:string)=>locale==="fr"?fr:en;
 const [query,setQuery]=useState(""),[asOfDate,setAsOfDate]=useState(new Date().toISOString().slice(0,10));
 const [hits,setHits]=useState<Hit[]>([]),[citations,setCitations]=useState<Citation[]>([]);
 const [sources,setSources]=useState<Source[]>([]),[reason,setReason]=useState<Record<string,string>>({});
 const [classification,setClassification]=useState<Record<string,string>>({});
 const [rights,setRights]=useState<Record<string,string>>({});
 const [status,setStatus]=useState(""),[busy,setBusy]=useState("");
 const load=useCallback(async()=>{
  const [c,s]=await Promise.all([
   fetch(`/api/legal-source-governance?matterId=${matterId}`,{credentials:"include",cache:"no-store"}),
   fetch("/api/legal-source-governance",{credentials:"include",cache:"no-store"})
  ]);
  const a=await c.json(),b=await s.json();
  if(!c.ok||!a.success)throw new Error(a.error||"Citation ledger unavailable");
  setCitations(a.citations??[]);
  if(s.ok&&b.success)setSources(b.sources??[]);
 },[matterId]);
 useEffect(()=>{void load().catch(e=>setStatus(e instanceof Error?e.message:"Unable to load legal sources"));},[load]);
 async function research(){
  setBusy("research");setStatus("");
  try{
   const r=await fetch("/api/legal-research",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,asOfDate,matterId,limit:20})});
   const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||"Research failed");
   setHits(data.hits??[]);setStatus(data.warning||tr("Only professionally reviewed source text is returned. Verify currency, relevance and legal effect.","Seuls les textes vérifiés par un professionnel sont renvoyés. Vérifiez leur actualité, leur pertinence et leur portée juridique."));
  }catch(e){setStatus(e instanceof Error?e.message:"Search failed");}finally{setBusy("");}
 }
 async function action(payload:Record<string,unknown>,key:string){
  setBusy(key);setStatus("");
  try{
   const r=await fetch("/api/legal-source-governance",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||"Source operation failed");
   await load();
   setStatus(tr("Recorded with source provenance and firm authorization.","Enregistré avec provenance et autorisation du cabinet."));
  }catch(e){setStatus(e instanceof Error?e.message:"Unable to record operation");}finally{setBusy("");}
 }
 return <section id="verified-matter-research" className="scroll-mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
 <p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-900">{tr("Verified LawBank · matter citations","LawBank vérifié · citations du dossier")}</p>
 <h2 className="mt-2 text-2xl font-semibold">{tr("Find, check and cite the actual law","Trouver, vérifier et citer les sources juridiques")}</h2>
 <p className="mt-2 text-sm text-slate-600">{tr("Intake does not equal verified authority. Source reviewers document professional checks and content rights before passages become eligible for research.","Un texte importé n’est pas une autorité vérifiée. Les responsables documentent les vérifications et les droits d’utilisation avant toute citation.")}</p>
 {status&&<p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{status}</p>}
 <div className="mt-4 flex flex-wrap items-end gap-3">
  <label className="min-w-[180px] flex-1 text-xs font-semibold">{tr("Search legislation and legal text","Chercher dans les textes juridiques")}
   <input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder={tr("Search phrase or subject","Expression ou sujet")}/></label>
  <label className="text-xs font-semibold">{tr("Law as of","Droit au")}</label>
  <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)} className="rounded-xl border p-3 text-sm"/>
  <button disabled={Boolean(busy)||query.trim().length<3} onClick={()=>void research()} className="rounded-xl bg-emerald-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{tr("Research verified sources","Rechercher les sources vérifiées")}</button>
 </div>
 <div className="mt-5 grid gap-3 lg:grid-cols-2">{hits.map(h=><article key={h.chunk_id} className="rounded-2xl border p-4">
  <h3 className="text-sm font-semibold">{h.title}</h3>
  <p className="mt-1 text-xs text-slate-500">{h.publisher} · {h.jurisdiction} · {h.source_class} · {h.section_path||tr("Passage","Extrait")}</p>
  <p className="mt-2 text-xs text-slate-600">{tr("Verified","Vérifié")} {h.verified_at.slice(0,10)} · {h.version_label||tr("Version not specified","Version non indiquée")}</p>
  <blockquote className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap border-l-2 border-emerald-700 pl-3 text-sm text-slate-700">{h.content}</blockquote>
  {(h.source_url||h.canonical_uri)&&<a href={h.source_url||h.canonical_uri||"#"} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-emerald-900 underline">{tr("Source reference","Référence de la source")}</a>}
  <button disabled={Boolean(busy)} onClick={()=>void action({action:"cite",matterId,chunkId:h.chunk_id},h.chunk_id)} className="mt-3 block rounded-lg bg-emerald-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{tr("Attach verified passage to matter","Joindre cet extrait vérifié au dossier")}</button>
 </article>)}</div>
 <div className="mt-6 border-t pt-5"><h3 className="font-semibold">{tr("Matter citation record","Registre des citations du dossier")}</h3>
 <div className="mt-3 space-y-2">{citations.map(c=><article key={c.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold">{c.source_title} <span className="text-xs text-slate-500">{c.source_version||""}</span></p><p className="mt-1 line-clamp-3 text-xs text-slate-600">{c.quoted_excerpt}</p><p className="mt-1 text-xs text-slate-500">{new Date(c.cited_at).toLocaleString()}</p>
 {c.currentness==="recheck_required"?<p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-950">{tr("Recheck source before legal reliance","Revérifiez la source avant toute utilisation juridique")} · {c.currentnessReason==="review_revoked_or_pending"?tr("Approval revoked or pending","Approbation révoquée ou en attente"):c.currentnessReason==="expired"?tr("Effective period ended","Période de vigueur terminée"):c.currentnessReason==="validity_dates_unconfirmed"?tr("Effective dates not confirmed","Dates de vigueur non confirmées"):c.currentnessReason||tr("Source status changed","Statut de la source modifié")}</p>:<p className="mt-2 text-xs font-semibold text-emerald-800">{tr("Source still marked verified as of today","Source toujours marquée vérifiée à ce jour")}</p>}</article>)}{!citations.length&&<p className="text-sm text-slate-500">{tr("No legally verified citations have been saved.","Aucune citation vérifiée enregistrée.")}</p>}</div></div>
 {sources.length>0&&<div className="mt-6 border-t pt-5"><h3 className="font-semibold">{tr("Source verification queue (authorized firm governors only)","Sources à vérifier (responsables autorisés du cabinet)")}</h3>
 <div className="mt-3 space-y-3">{sources.slice(0,25).map(s=><div key={s.id} className="rounded-xl border p-3">
  <p className="font-semibold text-sm">{s.title}</p><p className="mt-1 text-xs text-slate-500">{s.jurisdiction} · {s.ingestion_status} · {s.verification_status}</p>
  <label className="mt-2 block text-xs">{tr("Source classification","Nature du document")}
   <select className="mt-1 w-full rounded-lg border p-2 text-sm" value={classification[s.id]||s.source_class||"unclassified"} onChange={e=>setClassification(v=>({...v,[s.id]:e.target.value}))}>
   <option value="unclassified">Unclassified</option><option value="official">Official</option><option value="secondary">Secondary commentary</option><option value="internal">Internal</option></select></label>
  <textarea aria-label="Source verification reasoning" className="mt-2 w-full rounded-lg border p-2 text-sm" rows={2} placeholder={tr("What did you verify? Source, date, status, applicability…","Vérifications : source, date, vigueur, applicabilité…")} value={reason[s.id]||""} onChange={e=>setReason(v=>({...v,[s.id]:e.target.value}))}/>
  <textarea aria-label="Lawful content use" className="mt-2 w-full rounded-lg border p-2 text-sm" rows={2} placeholder={tr("Document lawful access, copyright and intended reuse","Justifier l’accès licite, les droits et la réutilisation")} value={rights[s.id]||""} onChange={e=>setRights(v=>({...v,[s.id]:e.target.value}))}/>
  <div className="mt-2 flex flex-wrap gap-2">{(["verify","reject","revoke"] as const).map(decision=><button key={decision} disabled={Boolean(busy)||!reason[s.id]||reason[s.id].trim().length<20||(decision==="verify"&&(!rights[s.id]||rights[s.id].trim().length<20))} onClick={()=>void action({action:"review",sourceId:s.id,decision,sourceClass:classification[s.id]||s.source_class,reviewNote:reason[s.id],rightsAttestation:rights[s.id]},s.id)} className="rounded-lg border border-emerald-800 px-3 py-2 text-xs disabled:opacity-40">{decision}</button>)}</div>
 </div>)}</div></div>}
 </section>;
}
