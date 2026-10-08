"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Clock3, Gavel, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { formatDate } from "@/lib/i18n";

type Matter={id:string;title:string;client_name:string;case_reference?:string|null;status?:string|null;risk_level?:string|null;engagement_nature?:string|null;plan_label?:string|null};
type Lawyer={id:string;full_name:string;role?:string|null};
type Work={id:string;matter_id?:string|null;work_scope:string;title:string;description?:string|null;status:string;priority:string;assigned_to?:string|null;due_at?:string|null};
type Thread={id:string;matter_id?:string|null;title:string;description?:string|null;thread_type:string;status:string;is_pinned:boolean;updated_at:string};
type Message={id:string;thread_id:string;body:string;created_by?:string|null;created_at:string};
type LegacyPayload={success:boolean;error?:string;items?:Work[];matters?:Matter[];lawyers?:Lawyer[];threads?:Thread[];messages?:Message[]};
type MatterDecision={id:string;matter_id:string;title:string;decision?:string|null;status:string;authority_level:string;created_at:string};
type Execution={id:string;matter_id:string;title:string;status:string;execution_mode:string;target_system?:string|null;due_at?:string|null;created_at:string};
type Instruction={id:string;matter_id:string;instruction:string;confirmation_status:string;received_at:string};
type Handoff={id:string;matter_id:string;purpose:string;status:string;external_professional?:string|null;created_at:string};
type Milestone={id:string;matter_id:string;title:string;status:string;due_at?:string|null;sequence_no:number};
type GovernedPayload={success:boolean;error?:string;matters?:Matter[];decisions?:MatterDecision[];executions?:Execution[];instructions?:Instruction[];handoffs?:Handoff[];milestones?:Milestone[]};

type Tab="pulse"|"matter-flow"|"conversations"|"work";
const field="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#7da797]";

export default function Workroom(){
 const{locale,t}=useLocale();
 const bilingual=(en:string,fr:string)=>locale==="fr"?fr:en;
 const[data,setData]=useState<LegacyPayload>({success:true});
 const[governed,setGoverned]=useState<GovernedPayload>({success:true});
 const[tab,setTab]=useState<Tab>("pulse");
 const[query,setQuery]=useState("");
 const[message,setMessage]=useState("");
 const[busy,setBusy]=useState(false);
 const[openThread,setOpenThread]=useState(false);
 const[openWork,setOpenWork]=useState(false);
 const[threadForm,setThreadForm]=useState({title:"",description:"",threadType:"discussion",matterId:""});
 const[workForm,setWorkForm]=useState({title:"",description:"",workScope:"case",matterId:"",assignedTo:"",priority:"normal",dueAt:""});

 async function load(){
  setMessage("");
  try{
   const results=await Promise.allSettled([
    fetch("/api/workroom",{cache:"no-store",credentials:"include"}).then(async response=>{const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error||"Unable to load collaboration Workroom.");return body as LegacyPayload;}),
    fetch("/api/workroom/governed",{cache:"no-store",credentials:"include"}).then(async response=>{const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error||"Unable to load governed Matter flow.");return body as GovernedPayload;}),
   ]);
   const [legacy,canonical]=results;
   setData(legacy.status==="fulfilled"?legacy.value:{success:false,items:[],matters:[],lawyers:[],threads:[],messages:[]});
   setGoverned(canonical.status==="fulfilled"?canonical.value:{success:false,matters:[],decisions:[],executions:[],instructions:[],handoffs:[],milestones:[]});
   if(legacy.status==="rejected"&&canonical.status==="rejected")throw new Error("Workroom unavailable. Neither collaboration nor governed matter operations could be loaded.");
   if(legacy.status==="rejected")setMessage("Conversations and assignments could not load. Governed matter operations remain available.");
   if(canonical.status==="rejected")setMessage("Governed matter operations could not load. Conversations and assignments remain available.");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to load Workroom.")}
 }
 useEffect(()=>{void load()},[]);

 const matters=useMemo(()=>governed.matters??data.matters??[],[governed.matters,data.matters]);
 const matterMap=useMemo(()=>new Map(matters.map(x=>[x.id,x])),[matters]);
 const threads=(data.threads??[]).filter(x=>matches(query,[x.title,x.description,x.thread_type,matterMap.get(x.matter_id??"")?.title]));
 const work=(data.items??[]).filter(x=>matches(query,[x.title,x.description,x.work_scope,x.priority,matterMap.get(x.matter_id??"")?.title]));
 const decisions=(governed.decisions??[]).filter(x=>x.status==="proposed");
 const executions=(governed.executions??[]).filter(x=>!["completed","cancelled"].includes(x.status));
 const instructions=(governed.instructions??[]).filter(x=>!["confirmed","superseded"].includes(x.confirmation_status));
 const handoffs=(governed.handoffs??[]).filter(x=>!["completed","cancelled"].includes(x.status));
 const milestones=(governed.milestones??[]).filter(x=>!["completed","waived"].includes(x.status));
 const activeWork=work.filter(x=>["open","in_progress","review","waiting"].includes(x.status));
 const overdue=work.filter(x=>x.due_at&&new Date(x.due_at)<new Date()&&x.status!=="completed");
 const governedAttention=decisions.length+instructions.length+executions.filter(x=>["failed","awaiting_approval"].includes(x.status)).length+handoffs.filter(x=>x.status==="returned").length;

 async function post(action:string,payload:Record<string,unknown>){setBusy(true);setMessage("");try{const r=await fetch("/api/workroom",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});const p=await r.json();if(!r.ok||!p.success)throw new Error(p.error||"Workroom action failed.");await load();return true}catch(error){setMessage(error instanceof Error?error.message:"Workroom action failed.");return false}finally{setBusy(false)}}
 async function createThread(e:FormEvent){e.preventDefault();if(await post("create_thread",{...threadForm,matterId:threadForm.matterId||null})){setOpenThread(false);setThreadForm({title:"",description:"",threadType:"discussion",matterId:""})}}
 async function createWork(e:FormEvent){e.preventDefault();if(await post("create",{...workForm,matterId:workForm.matterId||null,dueAt:workForm.dueAt||null})){setOpenWork(false);setWorkForm({title:"",description:"",workScope:"case",matterId:"",assignedTo:"",priority:"normal",dueAt:""})}}

 return <main className="min-h-screen bg-[#eef2ef] p-3 text-slate-900 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1750px] space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>{t("matter.firmWorkspace","Workspace")}</Link><div className="flex flex-wrap gap-2"><button onClick={()=>setOpenThread(true)} className="rounded-xl border border-[#0b493b] bg-white px-4 py-2.5 text-sm font-bold text-[#0b493b]">{t("workroom.newConversation","New conversation")}</button><button onClick={()=>setOpenWork(true)} className="rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white">{t("workroom.assignWork","Assign work")}</button></div></div>

  <section className="overflow-hidden rounded-[2rem] bg-[#082b22] text-white"><div className="grid xl:grid-cols-[1fr_500px]"><div className="p-6 md:p-8 xl:p-10"><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d8bb79]">TSIDKENU {t("workroom.title","Workroom")}</p><h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-.04em] md:text-5xl">{t("workroom.hero","The firm works here. The Matter remains the legal source of truth.")}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">{bilingual("Conversations and assigned work connect to the same decisions, instructions, milestones and handoffs as each Matter.","Les conversations et les tâches sont liées aux mêmes décisions, instructions, étapes et transmissions que chaque dossier.")}</p></div><div className="grid grid-cols-2 gap-px bg-white/10"><Metric label={bilingual("Matter attention","Points à traiter")} value={governedAttention}/><Metric label={bilingual("Open execution","Exécutions en cours")} value={executions.length}/><Metric label={bilingual("Active work","Travaux actifs")} value={activeWork.length}/><Metric label="Conversations" value={data.threads?.length||0}/></div></div></section>

  {message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{message}</div>}
  <div className="grid gap-4 xl:grid-cols-[250px_1fr]">
   <aside className="h-fit rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">{t("workroom.views","Workroom views")}</p>{[["pulse",bilingual("Pulse","Vue générale")],["matter-flow",bilingual("Matter flow","Suivi des dossiers")],["conversations",bilingual("Conversations","Conversations")],["work",bilingual("Assigned work","Travaux attribués")]].map(([key,label])=><button type="button" aria-pressed={tab===key} key={key} onClick={()=>setTab(key as Tab)} className={"mb-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold "+(tab===key?"bg-[#edf4f0] text-[#0f5b49]":"text-slate-600 hover:bg-slate-50")}><span>{label}</span>{key==="matter-flow"&&governedAttention>0?<span className="rounded-full bg-[#0f5b49] px-2 py-0.5 text-[10px] text-white">{governedAttention}</span>:null}</button>)}</aside>
   <div className="space-y-4">
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full py-3 text-sm outline-none" placeholder={bilingual("Search work, conversations or cases…","Rechercher des tâches, conversations ou dossiers…")}/></label>

    {tab==="pulse"&&<div className="grid gap-4 lg:grid-cols-2">
      <Panel title={bilingual("Matter decisions needing judgment","Décisions de dossier à trancher")} icon={Gavel}>{decisions.slice(0,6).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={bilingual("Decision","Décision")} title={item.title} status={item.status}/>)}{!decisions.length?<Empty text={bilingual("No proposed Matter decisions.","Aucune décision de dossier proposée.")}/>:null}</Panel>
      <Panel title={bilingual("Execution in motion","Exécution en cours")} icon={BriefcaseBusiness}>{executions.slice(0,7).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={humanize(item.execution_mode)} title={item.title} status={item.status}/>)}{!executions.length?<Empty text={bilingual("No open governed execution.","Aucune exécution encadrée en cours.")}/>:null}</Panel>
      <Panel title={bilingual("Latest conversations","Conversations récentes")} icon={MessageSquareText}>{threads.slice(0,7).map(item=><ThreadCard key={item.id} item={item} matterMap={matterMap} messages={data.messages??[]} locale={locale}/>)}</Panel>
      <Panel title={bilingual("Work needing attention","Travaux nécessitant une attention")} icon={Clock3}>{overdue.slice(0,7).map(item=><WorkCard key={item.id} item={item} matterMap={matterMap} locale={locale}/>)}{!overdue.length?<Empty text={bilingual("Nothing overdue.","Aucun travail en retard.")}/>:null}</Panel>
    </div>}

    {tab==="matter-flow"&&<div className="space-y-4">
      <FlowSection title={bilingual("Decisions","Décisions")} description={bilingual("Professional judgment stays on the Matter, not in a competing decision system.","Le jugement professionnel reste dans le dossier, sans système de décision concurrent.")}>{(governed.decisions??[]).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={bilingual("Decision","Décision")} title={item.title} status={item.status}/>)}</FlowSection>
      <FlowSection title={bilingual("Client instructions","Instructions du client")} description={bilingual("Instructions and confirmation state remain tied to the legal record.","Les instructions et leur confirmation restent liées au dossier juridique.")}>{(governed.instructions??[]).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={bilingual("Instruction","Instruction")} title={item.instruction} status={item.confirmation_status}/>)}</FlowSection>
      <FlowSection title={bilingual("Execution & handoffs","Exécution et transmissions")} description={bilingual("Filing, sending, obtaining, payment, follow-up and professional handoffs in one flow.","Dépôts, envois, obtentions, paiements, suivis et transmissions professionnelles dans un même flux.")}>{[...(governed.executions??[]).map(item=>({id:item.id,matter_id:item.matter_id,label:bilingual("Execution","Exécution"),title:item.title,status:item.status})),...(governed.handoffs??[]).map(item=>({id:item.id,matter_id:item.matter_id,label:bilingual("Handoff","Transmission"),title:item.purpose,status:item.status}))].map(item=><MatterFlowCard key={`${item.label}-${item.id}`} matter={matterMap.get(item.matter_id)} label={item.label} title={item.title} status={item.status}/>)}</FlowSection>
      <FlowSection title={bilingual("Upcoming milestones","Prochaines étapes")} description={bilingual("The same adaptive milestones shown inside each Matter.","Les mêmes étapes adaptatives affichées dans chaque dossier.")}>{milestones.map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={item.due_at?formatDate(locale,item.due_at):bilingual("Milestone","Étape")} title={item.title} status={item.status}/>)}</FlowSection>
    </div>}

    {tab==="conversations"&&<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{threads.map(item=><ThreadCard key={item.id} item={item} matterMap={matterMap} messages={data.messages??[]} locale={locale}/>)}</div>}
    {tab==="work"&&<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{work.map(item=><WorkCard key={item.id} item={item} matterMap={matterMap} locale={locale}/>)}</div>}
   </div>
  </div>

  {openThread&&<Modal title={bilingual("Start conversation","Démarrer une conversation")} closeLabel={bilingual("Close","Fermer")} onClose={()=>setOpenThread(false)}><form onSubmit={createThread} className="grid gap-3"><input required aria-label={bilingual("Conversation title","Titre de la conversation")} className={field} value={threadForm.title} onChange={e=>setThreadForm({...threadForm,title:e.target.value})} placeholder={bilingual("Conversation title","Titre de la conversation")}/><textarea aria-label={bilingual("Purpose or context","Objectif ou contexte")} className={field+" min-h-24"} value={threadForm.description} onChange={e=>setThreadForm({...threadForm,description:e.target.value})} placeholder={bilingual("Purpose / context","Objectif / contexte")}/><select aria-label={bilingual("Conversation type","Type de conversation")} className={field} value={threadForm.threadType} onChange={e=>setThreadForm({...threadForm,threadType:e.target.value})}><option value="discussion">Discussion</option><option value="case_room">{bilingual("Matter room","Salle du dossier")}</option><option value="office">{bilingual("Office","Cabinet")}</option><option value="finance">Finance</option><option value="announcement">{bilingual("Announcement","Annonce")}</option></select><MatterSelect value={threadForm.matterId} onChange={value=>setThreadForm({...threadForm,matterId:value})} matters={matters} emptyLabel={bilingual("No Matter link","Aucun dossier lié")}/><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-3 text-sm font-bold text-white">{busy?bilingual("Creating…","Création…"):bilingual("Create conversation","Créer la conversation")}</button></form></Modal>}
  {openWork&&<Modal title={bilingual("Assign work","Attribuer un travail")} closeLabel={bilingual("Close","Fermer")} onClose={()=>setOpenWork(false)}><form onSubmit={createWork} className="grid gap-3"><input required aria-label={bilingual("Work title","Titre du travail")} className={field} value={workForm.title} onChange={e=>setWorkForm({...workForm,title:e.target.value})} placeholder={bilingual("Work title","Titre du travail")}/><textarea aria-label={bilingual("Expected result","Résultat attendu")} className={field+" min-h-24"} value={workForm.description} onChange={e=>setWorkForm({...workForm,description:e.target.value})} placeholder={bilingual("Expected result","Résultat attendu")}/><MatterSelect value={workForm.matterId} onChange={value=>setWorkForm({...workForm,matterId:value})} matters={matters} emptyLabel={bilingual("No Matter link","Aucun dossier lié")}/><select aria-label={bilingual("Responsible person","Responsable")} className={field} value={workForm.assignedTo} onChange={e=>setWorkForm({...workForm,assignedTo:e.target.value})}><option value="">{t("workroom.unassigned","Unassigned")}</option>{(data.lawyers??[]).map(x=><option key={x.id} value={x.id}>{x.full_name} · {x.role||bilingual("member","membre")}</option>)}</select><select aria-label={bilingual("Priority","Priorité")} className={field} value={workForm.priority} onChange={e=>setWorkForm({...workForm,priority:e.target.value})}><option value="low">{bilingual("Low","Faible")}</option><option value="normal">{bilingual("Normal","Normale")}</option><option value="high">{bilingual("High","Élevée")}</option><option value="urgent">{bilingual("Urgent","Urgente")}</option></select><input aria-label={bilingual("Due date and time","Échéance")} className={field} type="datetime-local" value={workForm.dueAt} onChange={e=>setWorkForm({...workForm,dueAt:e.target.value})}/><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-3 text-sm font-bold text-white">{busy?bilingual("Creating…","Création…"):bilingual("Create work","Créer le travail")}</button></form></Modal>}
 </div></main>
}

function matches(query:string,values:(string|null|undefined)[]){if(!query.trim())return true;const needle=query.toLowerCase();return values.filter(Boolean).join(" ").toLowerCase().includes(needle)}
function humanize(value:string){return value.replaceAll("_"," ")}
function Metric({label,value}:{label:string;value:number}){return <div className="bg-white/[.045] p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>}
function Panel({title,icon:Icon,children}:{title:string;icon:typeof ShieldCheck;children:React.ReactNode}){return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#0f5b49]"/><h2 className="font-semibold">{title}</h2></div><div className="mt-3 space-y-2">{children}</div></section>}
function Empty({text}:{text:string}){return <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">{text}</p>}
function MatterSelect({value,onChange,matters,emptyLabel}:{value:string;onChange:(value:string)=>void;matters:Matter[];emptyLabel:string}){return <select aria-label={emptyLabel} className={field} value={value} onChange={e=>onChange(e.target.value)}><option value="">{emptyLabel}</option>{matters.map(x=><option key={x.id} value={x.id}>{x.case_reference||"CASE"} — {x.client_name} — {x.title}</option>)}</select>}
function ThreadCard({item,matterMap,messages,locale}:{item:Thread;matterMap:Map<string,Matter>;messages:Message[];locale:string}){const count=messages.filter(x=>x.thread_id===item.id).length;const matter=item.matter_id?matterMap.get(item.matter_id):undefined;const fr=locale==="fr";return <Link href={"/workroom/thread/"+item.id} className="block rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 hover:border-[#7da797]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#0f5b49]">{humanize(item.thread_type)}</p><p className="mt-1 font-semibold">{item.title}</p></div>{item.is_pinned?<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">{fr?"ÉPINGLÉE":"PINNED"}</span>:null}</div>{item.description?<p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>:null}<p className="mt-3 text-[11px] text-slate-400">{matter?`${matter.client_name} · ${matter.title} · `:""}{count} {fr?(count===1?"message":"messages"):`message${count===1?"":"s"}`}</p></Link>}
function WorkCard({item,matterMap,locale}:{item:Work;matterMap:Map<string,Matter>;locale:string}){const matter=item.matter_id?matterMap.get(item.matter_id):undefined;const priority:Record<string,string>=locale==="fr"?{low:"faible",normal:"normale",high:"élevée",urgent:"urgente"}:{};return <Link href={"/workroom/"+item.id} className="block rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 hover:border-[#7da797]"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{priority[item.priority]||item.priority}</span></div><p className="mt-2 text-xs text-slate-500">{humanize(item.status)}{matter?` · ${matter.client_name} · ${matter.title}`:""}</p></Link>}
function MatterFlowCard({matter,label,title,status}:{matter?:Matter;label:string;title:string;status:string}){const body=<div className="rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 transition hover:border-[#7da797]"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#0f5b49]">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{title}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{status.replaceAll("_"," ")}</span></div>{matter?<p className="mt-2 text-xs text-slate-500">{matter.client_name} · {matter.title}</p>:null}</div>;return matter?<Link href={`/matters/${matter.id}`}>{body}</Link>:body}
function FlowSection({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>}
function Modal({title,closeLabel,onClose,children}:{title:string;closeLabel:string;onClose:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()} className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[1.7rem] bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500">{closeLabel}</button></div>{children}</div></div>}
