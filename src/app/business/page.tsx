"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CirclePlus, FileCheck2, Landmark, Receipt, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

type Expense={id:string;matter_id?:string|null;category:string;supplier_name?:string|null;description:string;amount_xaf:number;payment_method?:string|null;reference?:string|null;expense_date:string;recoverable:boolean;tax_relevant:boolean;status:string;receipt_file_name?:string|null};
type Matter={id:string;title:string;client_name:string};
type Payload={success:boolean;error?:string;metrics?:Record<string,number>;expenses?:Expense[];matters?:Matter[]};
const field="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none";
const money=(n:number)=>new Intl.NumberFormat("fr-CM",{maximumFractionDigits:0}).format(Number(n||0))+" XAF";

export default function BusinessPage(){
 const[data,setData]=useState<Payload>({success:true,expenses:[],matters:[]});
 const[loading,setLoading]=useState(true);
 const[open,setOpen]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const[form,setForm]=useState({category:"office",supplierName:"",description:"",amountXaf:"",paymentMethod:"",reference:"",expenseDate:new Date().toISOString().slice(0,10),matterId:"",recoverable:false,taxRelevant:true});

 async function load(){
   setLoading(true);
   try{
     const response=await fetch("/api/business",{cache:"no-store",credentials:"include"});
     const payload=await response.json();
     if(!response.ok||!payload.success) throw new Error(payload.error||"Unable to load business.");
     setData(payload);
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to load business.");}
   finally{setLoading(false);}
 }
 useEffect(()=>{void load()},[]);
 const metrics=data.metrics||{};
 const matterMap=useMemo(()=>new Map((data.matters??[]).map(item=>[item.id,item])),[data.matters]);

 async function create(event:FormEvent){
   event.preventDefault();setBusy(true);setMessage("");
   try{
     const response=await fetch("/api/business",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amountXaf:Number(form.amountXaf),matterId:form.matterId||null})});
     const payload=await response.json();
     if(!response.ok||!payload.success) throw new Error(payload.error||"Unable to record expense.");
     setOpen(false);
     await load();
     setMessage("Expense recorded in firm business and finance ledger.");
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to record expense.");}
   finally{setBusy(false);}
 }

 return <main className="min-h-screen bg-[#eef2ef] p-3 text-slate-900 sm:p-5 lg:p-7"><div className="mx-auto max-w-[1800px] space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>Workspace</Link>
   <div className="flex flex-wrap gap-2"><Link href="/business/receipts" className="inline-flex items-center gap-2 rounded-xl border border-[#0b493b] bg-white px-4 py-2.5 text-sm font-bold text-[#0b493b]"><FileCheck2 className="h-4 w-4"/>Receipt desk</Link><button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-sm font-bold text-white"><CirclePlus className="h-4 w-4"/>Record expense</button></div>
  </div>
  <section className="overflow-hidden rounded-[2rem] bg-[#082b22] text-white">
   <div className="grid xl:grid-cols-[1fr_440px]">
    <div className="p-6 md:p-8 xl:p-10">
     <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d8bb79]">Firm business & office</p>
     <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Know what came in, what went out, and why.</h1>
     <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">Client billing stays distinct from office spending, taxes, registrations, subscriptions and recoverable case disbursements.</p>
    </div>
    <div className="grid grid-cols-2 gap-px bg-white/10">
     <Hero label="Office expenses" value={money(metrics.officeExpenses||0)}/>
     <Hero label="Case expenses" value={money(metrics.caseExpenses||0)}/>
     <Hero label="Outstanding" value={money(metrics.outstanding||0)}/>
     <Hero label="Cash in" value={money(metrics.cashIn||0)}/>
    </div>
   </div>
  </section>
  {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Card icon={TrendingUp} label="Billed" value={money(metrics.billed||0)}/>
   <Card icon={WalletCards} label="Cash received" value={money(metrics.cashIn||0)}/>
   <Card icon={TrendingDown} label="Cash spent" value={money(metrics.cashOut||0)}/>
   <Card icon={Receipt} label="Expense records" value={String(data.expenses?.length||0)}/>
  </section>
  {loading?<div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500">Loading firm business…</div>:
  <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
   <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Expense & receipt register</h2><Landmark className="h-5 w-5 text-[#0f5b49]"/></div>
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
    <thead className="text-[10px] uppercase tracking-[.14em] text-slate-400"><tr><th className="pb-3">Date</th><th className="pb-3">Description</th><th className="pb-3">Category</th><th className="pb-3">Case / Office</th><th className="pb-3">Amount</th><th className="pb-3">Tax</th><th className="pb-3">Receipt</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{(data.expenses??[]).map(item=><tr key={item.id}>
     <td className="py-3">{new Date(item.expense_date).toLocaleDateString()}</td>
     <td className="py-3"><p className="font-semibold">{item.description}</p><p className="text-xs text-slate-400">{item.supplier_name||item.reference||"—"}</p></td>
     <td className="py-3 capitalize text-slate-500">{item.category.replaceAll("_"," ")}</td>
     <td className="py-3 text-slate-500">{item.matter_id?(matterMap.get(item.matter_id)?.title||"Case"):"Office / firm"}</td>
     <td className="py-3 font-bold">{money(item.amount_xaf)}</td>
     <td className="py-3">{item.tax_relevant?"Relevant":"No"}</td>
     <td className="py-3">{item.receipt_file_name||"Not attached"}</td>
    </tr>)}</tbody>
   </table>{!(data.expenses??[]).length&&<p className="py-8 text-sm text-slate-500">No expenses recorded yet.</p>}</div>
  </section>}
 </div>
 {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" onClick={()=>!busy&&setOpen(false)}>
  <form onSubmit={create} onClick={e=>e.stopPropagation()} className="w-full max-w-3xl rounded-[1.8rem] bg-white p-5 shadow-2xl">
   <div className="flex items-center gap-3"><Banknote className="h-5 w-5 text-[#0f5b49]"/><h2 className="text-2xl font-semibold">Record firm expense</h2></div>
   <div className="mt-5 grid gap-3 md:grid-cols-2">
    <select className={field} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="office">Office</option><option value="rent">Rent</option><option value="utilities">Utilities</option><option value="transport">Transport</option><option value="registration">Registration</option><option value="tax">Tax</option><option value="subscription">Subscription</option><option value="equipment">Equipment</option><option value="case_disbursement">Case disbursement</option></select>
    <input required className={field} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description"/>
    <input className={field} value={form.supplierName} onChange={e=>setForm({...form,supplierName:e.target.value})} placeholder="Supplier / payee"/>
    <input required inputMode="numeric" className={field} value={form.amountXaf} onChange={e=>setForm({...form,amountXaf:e.target.value})} placeholder="Amount XAF"/>
    <input className={field} type="date" value={form.expenseDate} onChange={e=>setForm({...form,expenseDate:e.target.value})}/>
    <input className={field} value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})} placeholder="Cash / bank / MoMo / Wave"/>
    <input className={field} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Receipt / transaction reference"/>
    <select className={field} value={form.matterId} onChange={e=>setForm({...form,matterId:e.target.value})}><option value="">Office / firm expense</option>{(data.matters??[]).map(item=><option key={item.id} value={item.id}>{item.client_name} — {item.title}</option>)}</select>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.taxRelevant} onChange={e=>setForm({...form,taxRelevant:e.target.checked})}/>Tax / compliance relevant</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={form.recoverable} onChange={e=>setForm({...form,recoverable:e.target.checked})}/>Recoverable from client</label>
   </div>
   <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={busy} className="rounded-xl bg-[#082b22] px-4 py-2.5 text-sm font-bold text-white">{busy?"Saving…":"Record expense"}</button></div>
  </form>
 </div>}
 </main>
}

function Hero({label,value}:{label:string;value:string}){return <div className="bg-white/[.045] p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/40">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>}
function Card({icon:Icon,label,value}:{icon:typeof Receipt;label:string;value:string}){return <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="w-fit rounded-xl bg-[#edf4f0] p-2.5 text-[#0f5b49]"><Icon className="h-4 w-4"/></div><p className="mt-4 text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">{label}</p></div>}
