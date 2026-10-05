"use client";
import { useState } from "react";

type Kind="decision"|"instruction"|"evidence"|"handoff";
const configs:{kind:Kind;title:string;placeholder:string}[]=[
 {kind:"decision",title:"Record decision",placeholder:"Decision or recommended course"},
 {kind:"instruction",title:"Record client instruction",placeholder:"Instruction received from the client"},
 {kind:"evidence",title:"Register evidence",placeholder:"Evidence or proposition to verify"},
 {kind:"handoff",title:"Prepare handoff",placeholder:"Purpose and scope of the professional handoff"},
];
export default function AdaptiveMatterActions({matterId}:{matterId:string}){
 const[open,setOpen]=useState<Kind|null>(null);const[text,setText]=useState("");const[busy,setBusy]=useState(false);const[notice,setNotice]=useState<string|null>(null);
 async function submit(kind:Kind){if(!text.trim())return;setBusy(true);setNotice(null);
  const payload=kind==="decision"?{action:"record_decision",title:text.trim().slice(0,100),decision:text.trim()}:
   kind==="instruction"?{action:"record_instruction",instruction:text.trim(),channel:"recorded"}:
   kind==="evidence"?{action:"record_evidence",title:text.trim().slice(0,100),sourceKind:"matter_record",assertion:text.trim()}:
   {action:"create_handoff",purpose:text.trim(),scopeNote:text.trim()};
  try{const res=await fetch(`/api/matters/${matterId}/adaptive`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok||!data.success)throw new Error(data.error||"Unable to save.");setText("");setOpen(null);setNotice("Recorded in the governed matter record.");window.location.reload();}
  catch(error){setNotice(error instanceof Error?error.message:"Unable to save.");}finally{setBusy(false);}
 }
 return <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
  <div className="flex flex-wrap gap-2">{configs.map(c=><button key={c.kind} onClick={()=>{setOpen(c.kind);setText("");setNotice(null)}} className="rounded-xl border border-[#0b493b]/20 bg-[#f4f8f6] px-3 py-2 text-xs font-bold text-[#0b493b]">{c.title}</button>)}</div>
  {open?<div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">{configs.find(c=>c.kind===open)?.title}</p><textarea value={text} onChange={e=>setText(e.target.value)} placeholder={configs.find(c=>c.kind===open)?.placeholder} className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0b493b]"/><div className="mt-3 flex gap-2"><button disabled={busy||!text.trim()} onClick={()=>submit(open)} className="rounded-xl bg-[#0b493b] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?"Saving…":"Save to matter record"}</button><button onClick={()=>setOpen(null)} className="px-3 py-2 text-xs font-bold text-slate-500">Cancel</button></div></div>:null}
  {notice?<p className="mt-3 text-xs font-semibold text-slate-600">{notice}</p>:null}
 </div>
}