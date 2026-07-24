"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RagInboxSource } from "@/lib/rag-inbox";
import type { SourceIngestionRecord } from "@/lib/source-ingestion";

export default function RagIngestionWorkbench({
  sources,
  initialRecords,
}: {
  sources: RagInboxSource[];
  initialRecords: SourceIngestionRecord[];
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordByPath = useMemo(
    () => new Map(records.map((record) => [record.sourceRelativePath, record])),
    [records]
  );

  async function ingest(relativePath: string) {
    setBusyPath(relativePath);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/rag-ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRelativePath: relativePath }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        record?: SourceIngestionRecord;
        records?: SourceIngestionRecord[];
      };

      if (!response.ok || !payload.success || !payload.records) {
        throw new Error(payload.error ?? "Unable to ingest the staged source.");
      }

      setRecords(payload.records);
      setMessage(
        payload.record?.status === "Extracted"
          ? "Text extracted and staged for later chunking."
          : payload.record?.status === "Needs OCR"
            ? "The source is registered and explicitly marked for OCR."
            : "The source was processed with a non-extractable status."
      );
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to ingest the staged source.");
    } finally {
      setBusyPath(null);
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {error}
        </div>
      ) : null}

      {sources.map((source) => {
        const record = recordByPath.get(source.relativePath);
        const statusTone =
          record?.status === "Extracted"
            ? "bg-emerald-50 text-emerald-700"
            : record?.status === "Needs OCR"
              ? "bg-amber-50 text-amber-700"
              : record?.status === "Unsupported" || record?.status === "Failed"
                ? "bg-rose-50 text-rose-700"
                : "bg-slate-100 text-slate-600";

        return (
          <div key={source.relativePath} className="rounded-[1rem] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{source.name}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone}`}>
                    {record?.status ?? "Not ingested"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{source.relativePath}</p>
                {record?.excerpt ? (
                  <p className="text-sm leading-6 text-slate-600">{record.excerpt}</p>
                ) : record?.failureReason ? (
                  <p className="text-sm leading-6 text-slate-600">{record.failureReason}</p>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    No extraction record yet. Ingest this source to create searchable staged text or an explicit OCR flag.
                  </p>
                )}
              </div>

              <div className="flex min-w-[180px] flex-col items-end gap-2">
                <button
                  onClick={() => void ingest(source.relativePath)}
                  disabled={busyPath === source.relativePath || source.provider !== "local"}
                  className="rounded-full bg-heritage-green px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyPath === source.relativePath ? "Ingesting..." : source.provider === "local" ? "Ingest source" : "Local ingest only"}
                </button>
                {record ? (
                  <p className="text-right text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {record.extractedCharacters} chars • {new Date(record.ingestedAt).toLocaleString("en-GB")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
