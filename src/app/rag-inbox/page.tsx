import Link from "next/link";
import { ArrowLeft, Cloud, Database, FileText, FolderOpen, ShieldCheck } from "lucide-react";
import RagIngestionWorkbench from "@/components/RagIngestionWorkbench";
import RagInboxUploader from "@/components/RagInboxUploader";
import {
  formatFileSize,
  getRagInboxAbsolutePath,
  listUnifiedRagInboxSources,
} from "@/lib/rag-inbox";
import { listSourceIngestionRecords } from "@/lib/source-ingestion";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function RagInboxPage() {
  const { sources, localFiles, oneDriveFiles, oneDriveStatus, oneDriveError } = await listUnifiedRagInboxSources();
  const ingestionRecords = await listSourceIngestionRecords();
  const absolutePath = getRagInboxAbsolutePath();

  return (
    <main className="min-h-screen bg-paper-white px-4 py-6 text-slate-700 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,_#083126_0%,_#0f4938_72%,_#c5a059_165%)] p-6 text-white shadow-[0_22px_54px_rgba(0,54,41,0.18)]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to cockpit
          </Link>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/50">Private RAG intake shelf</p>
              <h1 className="mt-2 text-4xl heading-serif text-white">Ready-made legal sources for the firm brain</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
                This page lists prepared sources from the local inbox and, when configured, the office OneDrive RAG
                library. It remains an intake shelf: the next worker will OCR, chunk, embed, cite, and attach sources to matters.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-gold-accent" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Current state</p>
                  <p className="text-sm font-semibold">Staging only, not vectorized yet</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-heritage-green" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unified source shelf</p>
                  <h2 className="text-lg font-semibold text-heritage-green">Local and OneDrive-ready legal sources</h2>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                {sources.length} staged
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1rem] border border-slate-200 bg-[#f8fbf9] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Local inbox</p>
                <p className="mt-2 font-mono text-xs text-slate-600">{absolutePath}</p>
              </div>
              <div className="rounded-[1rem] border border-slate-200 bg-[#f8fbf9] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">OneDrive library</p>
                <p className="mt-2 text-xs text-slate-600">
                  {oneDriveStatus.configured
                    ? `${oneDriveStatus.folderPath} on drive ${oneDriveStatus.driveId}`
                    : `Not connected. Missing: ${oneDriveStatus.missing.join(", ")}`}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {sources.length ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {sources.slice(0, 2).map((file) => (
                      <div key={file.relativePath} className="rounded-[1rem] border border-slate-200 bg-[#fcfcfb] p-4">
                        <div className="flex items-start gap-3">
                          {file.provider === "onedrive" ? (
                            <Cloud className="mt-0.5 h-5 w-5 text-heritage-green" />
                          ) : (
                            <FileText className="mt-0.5 h-5 w-5 text-heritage-green" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{file.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {file.provider === "onedrive" ? "OneDrive" : "Local"} - {file.extension.toUpperCase()} -{" "}
                              {formatFileSize(file.sizeBytes)} - modified {formatDate(file.modifiedAt)}
                            </p>
                            {file.provider === "onedrive" && file.webUrl ? (
                              <a href={file.webUrl} className="mt-2 inline-flex text-xs font-semibold text-heritage-green">
                                Open in OneDrive
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-[#f8fbf9] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ingestion workbench</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Extract readable text now, or explicitly mark the source as OCR-needed before it joins search and retrieval.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        {ingestionRecords.length} processed
                      </span>
                    </div>
                    <div className="mt-4">
                      <RagIngestionWorkbench sources={sources} initialRecords={ingestionRecords} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-slate-300 bg-[#fcfcfb] p-6 text-sm leading-7 text-slate-600">
                  No prepared documents are staged yet. Put PDFs, DOCX files, TXT notes, or scan exports in the local
                  inbox or the configured OneDrive folder.
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-[1.25rem] border border-slate-200 bg-[#f8fbf9] p-5">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-heritage-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next pipeline</p>
                <h2 className="text-lg font-semibold text-heritage-green">How this becomes RAG</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Source counts</p>
                <p className="mt-2 text-sm text-slate-600">
                  {localFiles.length} local files, {oneDriveFiles.length} OneDrive files.
                </p>
              </div>
              {oneDriveError ? (
                <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  {oneDriveError}
                </div>
              ) : null}
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>1. Put prepared legal sources in local or OneDrive intake.</p>
                <p>Upload directly here when the source is already digital and ready for staging.</p>
                <p>2. Register important sources inside a matter intelligence panel as knowledge entries.</p>
                <p>3. Add OCR and text extraction for scans, PDFs, DOCX, and TXT files.</p>
                <p>4. Chunk extracted text with source anchors and citations.</p>
                <p>5. Store embeddings in Supabase pgvector with firm and matter permissions.</p>
              </div>
              <RagInboxUploader />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
