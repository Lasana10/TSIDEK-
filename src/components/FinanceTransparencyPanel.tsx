"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Banknote, FileText, ReceiptText, RefreshCw, WalletCards } from "lucide-react";

type Payload={success:boolean;error?:string;totals?:{invoiced:number;paid:number;outstanding:number;recoverableExpenses:number};invoices?:any[];payments?:any[];receipts?:any[];expenses?:any[];reconciliations?:any[];statements?:any[]};
const money=(n:number)=>new Intl.NumberFormat("fr-CM").format(Math.round(n||0))+" XAF";
export default function FinanceTransparencyPanel({matterId}:{matterId:string}){
 const [data,setData]=useState<Payload|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const [invoice,setInvoice]=useState({amount:"",description:"Legal fees",dueDate:""});
 const [payment,setPayment]=useState({amount:"",invoiceId:"",provider:"CASH",providerReference:""});
 const [expense,setExpense]=useState({amount:"",category:"Other",payee:"",note:""});
 const [proofs,setProofs]=useState<Array<{id:string;title:string;created_at:string}>>([]);
 const [proof,setProof]=useState<File|null>(null);
 const [uploading,setUploading]=useState(false);
 const [attestation,setAttestation]=useState("");
 const [evidenceId,setEvidenceId]=useState("");
 const [paymentRequestId,setPaymentRequestId]=useState(()=>crypto.randomUUID());
 const [invoiceRequestId,setInvoiceRequestId]=useState(()=>crypto.randomUUID());
 const refreshProofs=useCallback(async()=>{
  const r=await fetch(`/api/matters/${matterId}/finance/proof`,{cache:"no-store",credentials:"include"});
  const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Unable to list payment proof");
  setProofs(d.documents??[]);
 },[matterId]);
 async function uploadProof(){
  if(!proof){setMsg("Select a payment proof document first.");return;}
  setUploading(true);setMsg("");
  try{
   const form=new FormData();form.append("file",proof);
   const r=await fetch(`/api/matters/${matterId}/finance/proof`,{method:"POST",credentials:"include",body:form});
   const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Unable to store proof");
   await refreshProofs();setEvidenceId(d.document.id);setProof(null);
   setMsg("Payment proof stored privately. Verify its authenticity before confirming any payment.");
  }catch(e){setMsg(e instanceof Error?e.message:"Upload failed");}finally{setUploading(false);}
 }
 const load=useCallback(async()=>{const r=await fetch(`/api/matters/${matterId}/finance`,{cache:"no-store"});const d=await r.json();setData(d);if(!d.success)setMsg(d.error||"Unable to load finance");},[matterId]);
 useEffect(()=>{void load();void refreshProofs().catch(e=>setMsg(e instanceof Error?e.message:"Evidence listing unavailable"));},[load,refreshProofs]);
 async function act(action:string,payload:Record<string,unknown>={}){setBusy(true);setMsg("");try{const r=await fetch(`/api/matters/${matterId}/finance`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Finance action failed");setData(d);if(action==="recordPayment"){setPaymentRequestId(crypto.randomUUID());setEvidenceId("");setAttestation("");setPayment({...payment,amount:"",providerReference:""});}if(action==="createInvoice"){setInvoiceRequestId(crypto.randomUUID());setInvoice({...invoice,amount:""});}setMsg("Saved with required controls.");}catch(e){setMsg(e instanceof Error?e.message:"Finance action failed")}finally{setBusy(false)}}
 const t=data?.totals||{invoiced:0,paid:0,outstanding:0,recoverableExpenses:0};
 const latestRecon=useMemo(()=>data?.reconciliations?.[0], [data]);
 return <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[#0f5b49]"><WalletCards className="h-5 w-5"/><span className="text-[10px] font-black uppercase tracking-[.2em]">Finance & client transparency</span></div><h2 className="mt-2 text-2xl font-semibold text-slate-950">One financial truth for the firm and client</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Invoices, confirmed payments, numbered receipts, disbursements and reconciliation are connected to the matter. Client-facing statements can be generated from the same ledger.</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
  {msg&&<div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{msg}</div>}
  <div className="mt-5 grid gap-3 md:grid-cols-4">{[["Invoiced",t.invoiced],["Paid",t.paid],["Outstanding",t.outstanding],["Recoverable expenses",t.recoverableExpenses]].map(([l,v])=><div key={String(l)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">{l}</p><p className="mt-2 text-lg font-semibold text-slate-950">{money(Number(v))}</p></div>)}</div>
  <div className="mt-5 grid gap-4 xl:grid-cols-3">
   <Box icon={<FileText className="h-4 w-4"/>} title="Issue invoice"><input placeholder="Amount XAF" value={invoice.amount} onChange={e=>setInvoice({...invoice,amount:e.target.value})} className="i"/><input placeholder="Description" value={invoice.description} onChange={e=>setInvoice({...invoice,description:e.target.value})} className="i"/><input type="date" value={invoice.dueDate} onChange={e=>setInvoice({...invoice,dueDate:e.target.value})} className="i"/><button disabled={busy} onClick={()=>void act("createInvoice",{amountXaf:Number(invoice.amount),description:invoice.description,dueDate:invoice.dueDate||null,idempotencyKey:invoiceRequestId})} className="b">Create invoice</button></Box>
   <Box icon={<Banknote className="h-4 w-4"/>} title="Record evidenced payment">
    <p className="text-xs leading-5 text-amber-800">Manual confirmation is a human attestation, not evidence of automatic bank or mobile-money settlement. Upload actual supporting proof before recording.</p>
    <label className="block text-xs font-semibold text-slate-700">Payment proof (PDF, PNG or JPEG, max 8 MB)
    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e=>setProof(e.target.files?.[0]??null)} className="i"/></label>
    <button onClick={()=>void uploadProof()} disabled={busy||uploading||!proof} className="b">{uploading?"Uploading evidence…":"Store proof securely"}</button>
    <label className="block text-xs font-semibold">Evidence document
     <select className="i" value={evidenceId} onChange={e=>setEvidenceId(e.target.value)}><option value="">Select stored payment proof</option>{proofs.map(x=><option key={x.id} value={x.id}>{x.title} · {x.created_at.slice(0,10)}</option>)}</select>
    </label>
    {evidenceId?<a href={`/api/matters/${matterId}/finance/proof/${evidenceId}`} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border px-3 py-2 text-xs font-semibold text-emerald-900">Open selected original proof for review</a>:null}
    <label className="block text-xs font-semibold">Reviewer attestation
     <textarea className="i" rows={2} value={attestation} onChange={e=>setAttestation(e.target.value)} placeholder="Describe how you checked the proof and receipt of funds (minimum 12 characters)"/>
    </label><input placeholder="Amount XAF" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} className="i"/><select value={payment.invoiceId} onChange={e=>setPayment({...payment,invoiceId:e.target.value})} className="i"><option value="">No specific invoice</option>{(data?.invoices||[]).filter(x=>x.status!=="Paid").map(x=><option key={x.id} value={x.id}>{x.invoice_number||"Invoice"} · {money(Number(x.amount_xaf))}</option>)}</select><select value={payment.provider} onChange={e=>setPayment({...payment,provider:e.target.value})} className="i"><option>CASH</option><option>MTN</option><option>ORANGE</option><option>BANK</option><option>WAVE</option></select><input placeholder="Provider reference" value={payment.providerReference} onChange={e=>setPayment({...payment,providerReference:e.target.value})} className="i"/><button disabled={busy||!evidenceId||attestation.trim().length<12||!Number(payment.amount)||payment.provider!=="CASH"&&!payment.providerReference.trim()} onClick={()=>void act("recordPayment",{amountXaf:Number(payment.amount),invoiceId:payment.invoiceId||null,provider:payment.provider,providerReference:payment.providerReference||null,evidenceDocumentId:evidenceId,attestation,idempotencyKey:paymentRequestId})} className="b">Record attested payment + receipt</button></Box>
   <Box icon={<ReceiptText className="h-4 w-4"/>} title="Record expense / disbursement"><input placeholder="Amount XAF" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})} className="i"/><input placeholder="Category" value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})} className="i"/><input placeholder="Payee" value={expense.payee} onChange={e=>setExpense({...expense,payee:e.target.value})} className="i"/><input placeholder="Note" value={expense.note} onChange={e=>setExpense({...expense,note:e.target.value})} className="i"/><button disabled={busy} onClick={()=>void act("recordExpense",{amountXaf:Number(expense.amount),category:expense.category,payee:expense.payee,note:expense.note})} className="b">Record paid expense</button></Box>
  </div>
  <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void act("generateStatement")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold">Generate client statement</button><button disabled={busy} onClick={()=>void act("reconcile")} className="rounded-xl bg-[#083126] px-4 py-2.5 text-xs font-bold text-white">Run reconciliation</button><span className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">Latest reconciliation: {latestRecon?.status||"none"} · {Number(latestRecon?.source_summary?.unverified_confirmed_payments||0)>0?"Legacy payments lack linked proof":"Evidence-gated checks"}</span></div>
  <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-100 p-4"><h3 className="font-semibold text-slate-950">Recent invoices</h3><div className="mt-3 space-y-2">{(data?.invoices||[]).slice(0,6).map(x=><p key={x.id} className="text-sm text-slate-600">{x.invoice_number||"Invoice"} · {money(Number(x.amount_xaf))} · {x.status||"Draft"}</p>)}{!(data?.invoices||[]).length&&<p className="text-sm text-slate-400">No invoices yet.</p>}</div></div><div className="rounded-2xl border border-slate-100 p-4"><h3 className="font-semibold text-slate-950">Receipts</h3><div className="mt-3 space-y-2">{(data?.receipts||[]).slice(0,6).map(x=><p key={x.id} className="text-sm text-slate-600">{x.receipt_number} · {money(Number(x.amount_xaf))} · {x.metadata?.external_settlement_verified===false?"Staff-attested; not provider-verified":"Recorded receipt"}</p>)}{!(data?.receipts||[]).length&&<p className="text-sm text-slate-400">No receipts yet.</p>}</div></div></div>
 </section>;
}
function Box({icon,title,children}:{icon:React.ReactNode;title:string;children:React.ReactNode}){return <div className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icon}{title}</div><div className="mt-3 space-y-2">{children}</div></div>}
