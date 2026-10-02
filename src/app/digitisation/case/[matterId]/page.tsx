"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileUp, ScanLine, ShieldCheck } from "lucide-react";
import { useState } from "react";

type UploadedItem = { id: string; review_status?: string };

export default function CaseDigitisationPage() {
  const params = useParams<{ matterId: string }>();
  const matterId = params.matterId;
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);

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
      setMessage(`${items.length} file(s) preserved in this case review queue. ${analyzed} received an intelligence proposal; every item still requires human confirmation.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import case material.");
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
        <h1 className="mt-5 text-3xl font-semibold tracking-[-.03em] md:text-4xl">Scan or import paper directly into this case.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Use a phone photo, scanned PDF, office scan or existing file. The original is preserved, TSIDKENU can propose a classification when a permitted provider is available, and human review remains mandatory.</p>
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
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><CheckCircle2 className="h-5 w-5 text-[#0b493b]"/><p className="mt-3 text-sm font-semibold">What happens next</p><p className="mt-2 text-xs leading-5 text-slate-500">TSIDKENU preserves originals, fingerprints duplicates, attempts permitted document intelligence, and keeps uncertain or unsupported files in human review.</p>{batchId ? <Link href="/digitisation" className="mt-4 inline-flex text-xs font-bold text-[#0b493b]">Review imported batch →</Link> : null}</div>
        </aside>
      </section>
    </div>
  </main>;
}
