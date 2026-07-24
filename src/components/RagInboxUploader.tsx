"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "lucide-react";

export default function RagInboxUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("target", "rag");
      formData.set("file", file);

      const response = await fetch("/api/file-vault", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        oneDriveMirror?: { webUrl?: string | null } | null;
        oneDriveError?: string | null;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to upload the RAG source.");
      }

      setMessage(
        payload.oneDriveMirror
          ? "Source uploaded locally and mirrored to OneDrive."
          : payload.oneDriveError
            ? `Source uploaded locally. OneDrive mirror pending: ${payload.oneDriveError}`
            : "Source uploaded into the local RAG intake shelf."
      );
      setFile(null);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to upload the RAG source.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Upload prepared source</p>
      <input
        type="file"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-sm text-slate-600"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {file
            ? `${file.name} will be staged in the local intake shelf for later OCR, chunking, and citation grounding.`
            : "Choose a PDF, DOCX, TXT, or scan export to stage it for ingestion."}
        </p>
        <button
          onClick={() => void upload()}
          disabled={busy || !file}
          className="inline-flex items-center gap-2 rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Uploading..." : "Upload source"}
        </button>
      </div>
      {message ? (
        <p className="mt-3 rounded-[0.9rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-[0.9rem] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
