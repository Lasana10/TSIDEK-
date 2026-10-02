"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileCheck2, FileUp, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";

type UploadedItem = { id: string; review_status?: string };
type ReviewItem = {
  id: string;
  original_name: string;
  proposed_title?: string | null;
  proposed_document_type?: string | null;
  proposed_document_date?: string | null;
  classification_confidence?: number | null;
  review_status: string;
  duplicate_of_document_id?: string | null;
};

type Draft = { title: string; documentType: string };

export default function CaseDigitisationPage() {
  const params = useParams<{ matterId: string }>();
  const matterId = params.matterId;
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  async function loadBatch(id: string) {
    const response = await fetch(`/api/digitisation?batchId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json() as { success?: boolean; error?: string; items?: ReviewItem[] };
    if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load captured files.");
    const items = payload.items ?? [];
    setReviewItems(items);
    setDrafts(Object.fromEntries(items.map((item) => [item.id, {
      title: item.proposed_title || item.original_name,
      documentType: item.proposed_document_type || "Digitised document",
    }])));
  }

  async function upload() {
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("title", `Case capture ${new Date().toISOString().slice(0, 10)}`);
      form.append("sourceType", "phone_scan");
      form.append("matterId", matterId);
      const response = await fetch("/api/digitisation", { method: "POST", body: form });
      const payload = await response.json() as { success?: boolean; error?: string; batch?: { id: string }; items?: UploadedItem[] };
      if (!response.ok || !payload.success || !payload.batch) throw new Error(payload.error || "Unable to import case material.");

      const items = payload.items ?? [];
      const candidates = items.filter((item) => item.review_status !== "duplicate");
      const analysis = await Promise.allSettled(candidates.map(async (item) => {
        const result = await fetch(`/api/digitisation/${item.id}/analyze`, { method: "POST" });
        const body = await result.json() as { success?: boolean; error?: string };
        if (!result.ok || !body.success) throw new Error(body.error || "Analysis unavailable");
      }));
      const analyzed = analysis.filter((entry) => entry.status === "fulfilled").length;

      setBatchId(payload.batch.id);
      setFiles([]);
      await loadBatch(payload.batch.id);
      setMessage(`${items.length} file(s) preserved. ${analyzed} received an intelligence proposal. Confirm or correct them below before they enter the controlled case record.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import case material.");
    } finally {
      setBusy(false);
    }
  }

  async function review(item: ReviewItem, reviewStatus: "accepted" | "corrected" | "rejected" | "duplicate") {
    if (!batchId) return;
    setBusy(true);
    setMessage("");
    try {
      const draft = drafts[item.id] ?? { title: item.proposed_title || item.original_name, documentType: item.proposed_document_type || "Digitised document" };
      const response = await fetch("/api/digitisation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, reviewStatus, matterId, title: draft.title, documentType: draft.documentType, documentDate: item.proposed_document_date || null }),
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to record review decision.");
      await loadBatch(batchId);
      setMessage(reviewStatus === "accepted" || reviewStatus === "corrected" ? "Confirmed into the controlled case record." : "Review decision recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record review decision.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f3f5f2] px-4 py-6 text-slate-900 md:px-7 md:py-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/matters/${matterId}?tab=documents`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm"><ArrowLeft className="h-4 w-4"/>Back to case</Link>
        <Link href="/digitisation" className="text-xs font-bold text-[#0b493b]">Open full digitisation desk</Link>
      </div>

      <section className="overflow-hidden rounded-[2rem] bg-[#082b22] p-7 text-white shadow-xl md:p-9">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-white/60"><ScanLine className="h-4 w-4 text-[#dfc47f]"/>Case capture</div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-.03em] md:text-4xl">Scan, understand and confirm paper in one case flow.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Preserve the original first. TSIDKENU can then propose classification and extraction, but a lawyer still confirms or corrects the record before it becomes controlled case material.</p>
      </section>

      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">{message}</div> : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-[#0b493b]/35 hover:bg-[#f4f8f6]">
            <FileUp className="h-9 w-9 text-[#0b493b]"/>
            <span className="mt-3 text-base font-semibold">Choose photos, PDFs, Word files or scans</span>
            <span className="mt-1 max-w-lg text-xs leading-5 text-slate-500">Multiple pages/files can be captured together. They are tied to this case immediately but still require review.</span>
            <input multiple type="file" accept="image/*,.pdf,.doc,.docx" capture="environment" className="hidden" onChange={(event)=>setFiles(Array.from(event.target.files ?? []))}/>
          </label>
          {files.length ? <div className="mt-4 rounded-2xl bg-[#edf4f0] p-4 text-sm text-[#0b493b]"><strong>{files.length} file(s)</strong> selected · {Math.round(files.reduce((sum,file)=>sum+file.size,0)/1024)} KB</div> : null}
          <button type="button" onClick={upload} disabled={!files.length || busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b493b] px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Preserving & analysing…" : "Import into case review queue"}</button>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><ShieldCheck className="h-5 w-5 text-[#0b493b]"/><p className="mt-3 text-sm font-semibold">Controlled by default</p><p className="mt-2 text-xs leading-5 text-slate-500">AI can propose classification and extraction, but it cannot make a scan authoritative without human confirmation.</p></div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><CheckCircle2 className="h-5 w-5 text-[#0b493b]"/><p className="mt-3 text-sm font-semibold">One continuous flow</p><p className="mt-2 text-xs leading-5 text-slate-500">Capture → preserve → analyse → confirm/correct → controlled case record. You no longer need to leave this case just to finish review.</p></div>
        </aside>
      </section>

      {reviewItems.length ? <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#0b493b]">Human review</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Confirm what enters the case record</h2><p className="mt-2 text-sm text-slate-500">Correct TSIDKENU’s proposal where needed. Duplicate flags stay separate from authoritative material.</p></div><Link href={`/matters/${matterId}?tab=documents`} className="text-xs font-bold text-[#0b493b]">Open case documents →</Link></div>
        <div className="mt-5 space-y-3">{reviewItems.map((item)=>{
          const duplicate=item.review_status==="duplicate"||Boolean(item.duplicate_of_document_id);
          const draft=drafts[item.id]??{title:item.proposed_title||item.original_name,documentType:item.proposed_document_type||"Digitised document"};
          const done=["accepted","corrected","rejected"].includes(item.review_status);
          return <article key={item.id} className="rounded-[1.4rem] border border-slate-200 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.original_name}</p><p className="mt-1 text-xs text-slate-500">{item.classification_confidence!=null?`${Math.round(item.classification_confidence*100)}% extraction confidence · `:""}{item.proposed_document_date||"Date not identified"}</p></div><span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[.12em] ${duplicate?"bg-amber-100 text-amber-900":done?"bg-emerald-100 text-emerald-800":"bg-slate-100 text-slate-600"}`}>{duplicate?"Duplicate flagged":item.review_status}</span></div>
            {!duplicate&&!done?<><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={draft.title} onChange={(event)=>setDrafts((current)=>({...current,[item.id]:{...draft,title:event.target.value}}))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0b493b]/40" placeholder="Document title"/><input value={draft.documentType} onChange={(event)=>setDrafts((current)=>({...current,[item.id]:{...draft,documentType:event.target.value}}))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0b493b]/40" placeholder="Document type"/></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy||!draft.title.trim()||!draft.documentType.trim()} onClick={()=>review(item,item.proposed_title===draft.title&&item.proposed_document_type===draft.documentType?"accepted":"corrected")} className="inline-flex items-center gap-2 rounded-xl bg-[#0b493b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><FileCheck2 className="h-4 w-4"/>Confirm into case</button><button disabled={busy} onClick={()=>review(item,"rejected")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"><XCircle className="h-4 w-4"/>Reject</button></div></>:null}
          </article>})}</div>
      </section>:null}
    </div>
  </main>;
}
