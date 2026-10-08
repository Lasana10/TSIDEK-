"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, CirclePlus, Clock3, Gavel, MessageSquareText, Search, ShieldCheck } from "lucide-react";
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

 const matters=governed.matters??data.matters??[];
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

  <section className="overflow-hidden rounded-[2rem] bg-[#082b22] text-white"><div className="grid xl:grid-cols-[1fr_500px]"><div className="p-6 md:p-8 xl:p-10"><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d8bb79]">TSIDKENU {t("workroom.title","Workroom")}</p><h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-.04em] md:text-5xl">{t("workroom.hero","The firm works here. The Matter remains the legal source of truth.")}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Conversations and assigned work now sit beside the same decisions, client instructions, execution actions, milestones and handoffs used inside each Matter.</p></div><div className="grid grid-cols-2 gap-px bg-white/10"><Metric label="Matter attention" value={governedAttention}/><Metric label="Open execution" value={executions.length}/><Metric label="Active work" value={activeWork.length}/><Metric label="Conversations" value={data.threads?.length||0}/></div></div></section>

  {message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{message}</div>}
  <div className="grid gap-4 xl:grid-cols-[250px_1fr]">
   <aside className="h-fit rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">{t("workroom.views","Workroom views")}</p>{[["pulse","Pulse"],["matter-flow","Matter flow"],["conversations","Conversations"],["work","Assigned work"]].map(([key,label])=><button key={key} onClick={()=>setTab(key as Tab)} className={"mb-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold "+(tab===key?"bg-[#edf4f0] text-[#0f5b49]":"text-slate-600 hover:bg-slate-50")}><span>{label}</span>{key==="matter-flow"&&governedAttention>0?<span className="rounded-full bg-[#0f5b49] px-2 py-0.5 text-[10px] text-white">{governedAttention}</span>:null}</button>)}</aside>
   <div className="space-y-4">
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full py-3 text-sm outline-none" placeholder={t("common.search","Search")+" work, conversations or cases…"}/></label>

    {tab==="pulse"&&<div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Matter decisions needing judgment" icon={Gavel}>{decisions.slice(0,6).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label="Decision" title={item.title} status={item.status}/>)}{!decisions.length?<Empty text="No proposed Matter decisions."/>:null}</Panel>
      <Panel title="Execution in motion" icon={BriefcaseBusiness}>{executions.slice(0,7).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={item.execution_mode.replaceAll("_"," ")} title={item.title} status={item.status}/>)}{!executions.length?<Empty text="No open governed execution."/>:null}</Panel>
      <Panel title="Latest conversations" icon={MessageSquareText}>{threads.slice(0,7).map(item=><ThreadCard key={item.id} item={item} matterMap={matterMap} messages={data.messages??[]}/>)}</Panel>
      <Panel title="Work needing attention" icon={Clock3}>{overdue.slice(0,7).map(item=><WorkCard key={item.id} item={item} matterMap={matterMap}/>)}{!overdue.length?<Empty text="Nothing overdue."/>:null}</Panel>
    </div>}

    {tab==="matter-flow"&&<div className="space-y-4">
      <FlowSection title="Decisions" description="Professional judgment recorded on the Matter—not a separate Workroom decision system.">{(governed.decisions??[]).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label="Decision" title={item.title} status={item.status}/>)}</FlowSection>
      <FlowSection title="Client instructions" description="Instructions and confirmation state remain tied to the legal record.">{(governed.instructions??[]).map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label="Instruction" title={item.instruction} status={item.confirmation_status}/>)}</FlowSection>
      <FlowSection title="Execution & handoffs" description="What is being filed, sent, obtained, paid, followed up or handed to another professional.">{[...(governed.executions??[]).map(item=>({id:item.id,matter_id:item.matter_id,label:"Execution",title:item.title,status:item.status})),...(governed.handoffs??[]).map(item=>({id:item.id,matter_id:item.matter_id,label:"Handoff",title:item.purpose,status:item.status}))].map(item=><MatterFlowCard key={`${item.label}-${item.id}`} matter={matterMap.get(item.matter_id)} label={item.label} title={item.title} status={item.status}/>)}</FlowSection>
      <FlowSection title="Upcoming milestones" description="The same adaptive plan milestones lawyers see inside each Matter.">{milestones.map(item=><MatterFlowCard key={item.id} matter={matterMap.get(item.matter_id)} label={item.due_at?formatDate(locale,item.due_at):"Milestone"} title={item.title} status={item.status}/>)}</FlowSection>
    </div>}

    {tab==="conversations"&&<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{threads.map(item=><ThreadCard key={item.id} item={item} matterMap={matterMap} messages={data.messages??[]}/>)}</div>}
    {tab==="work"&&<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{work.map(item=><WorkCard key={item.id} item={item} matterMap={matterMap}/>)}</div>}
   </div>
  </div>

  {openThread&&<Modal title="Start conversation" onClose={()=>setOpenThread(false)}><form onSubmit={createThread} className="grid gap-3"><input required className={field} value={threadForm.title} onChange={e=>setThreadForm({...threadForm,title:e.target.value})} placeholder="Conversation title"/><textarea className={field+" min-h-24"} value={threadForm.description} onChange={e=>setThreadForm({...threadForm,description:e.target.value})} placeholder="Purpose / context"/><select className={field} value={threadForm.threadType} onChange={e=>setThreadForm({...threadForm,threadType:e.target.value})}><option value="discussion">Discussion</option><option value="case_room">Case room</option><option value="office">Office</option><option value="finance">Finance</option><option value="announcement">Announcement</option></select><MatterSelect value={threadForm.matterId} onChange={value=>setThreadForm({...threadForm,matterId:value})} matters={matters}/><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-3 text-sm font-bold text-white">Create conversation</button></form></Modal>}
  {openWork&&<Modal title="Assign work" onClose={()=>setOpenWork(false)}><form onSubmit={createWork} className="grid gap-3"><input required className={field} value={workForm.title} onChange={e=>setWorkForm({...workForm,title:e.target.value})} placeholder="Work title"/><textarea className={field+" min-h-24"} value={workForm.description} onChange={e=>setWorkForm({...workForm,description:e.target.value})} placeholder="Expected result"/><MatterSelect value={workForm.matterId} onChange={value=>setWorkForm({...workForm,matterId:value})} matters={matters}/><select className={field} value={workForm.assignedTo} onChange={e=>setWorkForm({...workForm,assignedTo:e.target.value})}><option value="">{t("workroom.unassigned","Unassigned")}</option>{(data.lawyers??[]).map(x=><option key={x.id} value={x.id}>{x.full_name} · {x.role||"member"}</option>)}</select><select className={field} value={workForm.priority} onChange={e=>setWorkForm({...workForm,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><input className={field} type="datetime-local" value={workForm.dueAt} onChange={e=>setWorkForm({...workForm,dueAt:e.target.value})}/><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-3 text-sm font-bold text-white">Create work</button></form></Modal>}
 </div></main>
}

function matches(query:string,values:(string|null|undefined)[]){if(!query.trim())return true;const needle=query.toLowerCase();return values.filter(Boolean).join(" ").toLowerCase().includes(needle)}
function Metric({label,value}:{label:string;value:number}){return <div className="bg-white/[.045] p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>}
function Panel({title,icon:Icon,children}:{title:string;icon:typeof ShieldCheck;children:React.ReactNode}){return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#0f5b49]"/><h2 className="font-semibold">{title}</h2></div><div className="mt-3 space-y-2">{children}</div></section>}
function Empty({text}:{text:string}){return <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">{text}</p>}
function MatterSelect({value,onChange,matters}:{value:string;onChange:(value:string)=>void;matters:Matter[]}){return <select className={field} value={value} onChange={e=>onChange(e.target.value)}><option value="">No case link</option>{matters.map(x=><option key={x.id} value={x.id}>{x.case_reference||"CASE"} — {x.client_name} — {x.title}</option>)}</select>}
function ThreadCard({item,matterMap,messages}:{item:Thread;matterMap:Map<string,Matter>;messages:Message[]}){const count=messages.filter(x=>x.thread_id===item.id).length;const matter=item.matter_id?matterMap.get(item.matter_id):undefined;return <Link href={"/workroom/thread/"+item.id} className="block rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 hover:border-[#7da797]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#0f5b49]">{item.thread_type.replaceAll("_"," ")}</p><p className="mt-1 font-semibold">{item.title}</p></div>{item.is_pinned?<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">PINNED</span>:null}</div>{item.description?<p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>:null}<p className="mt-3 text-[11px] text-slate-400">{matter?`${matter.client_name} · ${matter.title} · `:""}{count} message{count===1?"":"s"}</p></Link>}
function WorkCard({item,matterMap}:{item:Work;matterMap:Map<string,Matter>}){const matter=item.matter_id?matterMap.get(item.matter_id):undefined;return <Link href={"/workroom/"+item.id} className="block rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 hover:border-[#7da797]"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{item.priority}</span></div><p className="mt-2 text-xs text-slate-500">{item.status.replaceAll("_"," ")}{matter?` · ${matter.client_name} · ${matter.title}`:""}</p></Link>}
function MatterFlowCard({matter,label,title,status}:{matter?:Matter;label:string;title:string;status:string}){const body=<div className="rounded-xl border border-slate-100 bg-[#fbfcfb] p-4 transition hover:border-[#7da797]"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#0f5b49]">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{title}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{status.replaceAll("_"," ")}</span></div>{matter?<p className="mt-2 text-xs text-slate-500">{matter.client_name} · {matter.title}</p>:null}</div>;return matter?<Link href={`/matters/${matter.id}`}>{body}</Link>:body}
function FlowSection({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}><div onClick={e=>e.stopPropagation()} className="w-full max-w-2xl rounded-[1.7rem] bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">{title}</h2><button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500">Close</button></div>{children}</div></div>}
