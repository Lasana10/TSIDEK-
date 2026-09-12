import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createKnowledgeEntry } from "@/lib/matter-room";
import { ragInboxRelativePath, type RagInboxSource } from "@/lib/rag-inbox";
import { readPrototypeCollection, writePrototypeCollection } from "@/lib/prototype-state.server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type SourceIngestionStatus = "Extracted" | "Needs OCR" | "Unsupported" | "Failed";

export type SourceIngestionRecord = {
  id: string;
  sourceRelativePath: string;
  sourceName: string;
  sourceProvider: "local" | "supabase" | "onedrive";
  extension: string;
  status: SourceIngestionStatus;
  extractedCharacters: number;
  excerpt: string;
  fullTextPath: string | null;
  failureReason: string | null;
  matterId: string | null;
  knowledgeEntryCreated: boolean;
  ingestedAt: string;
  modifiedAt: string;
  sizeBytes: number;
};

type ExtractedPayload = {
  status: SourceIngestionStatus;
  text: string;
  failureReason: string | null;
};

const collectionKey = "rag-source-ingestions";
const extractedTextRelativeDirectory = ".runtime/rag-ingestion-text";

function normalizeExcerpt(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 400);
}

function getExtension(relativePath: string) {
  return path.extname(relativePath).replace(".", "").toLowerCase();
}

async function readTextSource(source: RagInboxSource) {
  if (source.provider === "local") {
    return readFile(path.join(process.cwd(), source.relativePath), "utf8");
  }

  if (source.provider === "supabase") {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required to read the private TSIDKENU vault.");
    const bucket = process.env.TSIDEK_STORAGE_BUCKET || "tsidek-vault";
    const download = await supabase.storage.from(bucket).download(source.relativePath);
    if (download.error) throw new Error(download.error.message);
    return await download.data.text();
  }

  throw new Error("Direct extraction of OneDrive sources is not enabled in this ingestion path.");
}

async function extractSource(source: RagInboxSource): Promise<ExtractedPayload> {
  const extension = getExtension(source.relativePath);

  if (source.provider === "onedrive") {
    return {
      status: "Unsupported",
      text: "",
      failureReason: "OneDrive source extraction requires the configured OneDrive download connector.",
    };
  }

  try {
    if (["txt", "md", "csv", "json", "xml", "html", "htm"].includes(extension)) {
      const text = await readTextSource(source);
      return {
        status: text.trim() ? "Extracted" : "Failed",
        text,
        failureReason: text.trim() ? null : "The file was readable but did not contain extractable text.",
      };
    }

    if (["pdf", "docx", "doc", "pptx", "xlsx", "xls", "jpg", "jpeg", "png", "tif", "tiff"].includes(extension)) {
      return {
        status: "Needs OCR",
        text: "",
        failureReason: "This source needs OCR or binary document parsing before it can join the searchable firm brain.",
      };
    }

    return {
      status: "Unsupported",
      text: "",
      failureReason: `.${extension || "unknown"} files are not yet supported by the deterministic extractor.`,
    };
  } catch (error) {
    return {
      status: "Failed",
      text: "",
      failureReason: error instanceof Error ? error.message : "Unable to read the staged source.",
    };
  }
}

async function persistExtractedText(recordId: string, text: string) {
  const relativePath = `${extractedTextRelativeDirectory}/${recordId}.txt`;
  const absolutePath = path.join(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, text, "utf8");
  return relativePath;
}

export async function listSourceIngestionRecords() {
  const records = await readPrototypeCollection<SourceIngestionRecord[]>(collectionKey, []);
  return records.sort((left, right) => right.ingestedAt.localeCompare(left.ingestedAt));
}

export async function getSourceIngestionRecordByPath(sourceRelativePath: string) {
  const records = await listSourceIngestionRecords();
  return records.find((record) => record.sourceRelativePath === sourceRelativePath) ?? null;
}

export async function ingestSource(input: {
  source: RagInboxSource;
  matterId?: string | null;
  createKnowledgeEntryInMatter?: boolean;
}) {
  const extraction = await extractSource(input.source);
  const ingestedAt = new Date().toISOString();
  const recordId = randomUUID();
  const excerpt = normalizeExcerpt(extraction.text);
  const fullTextPath =
    extraction.status === "Extracted" && extraction.text.trim()
      ? await persistExtractedText(recordId, extraction.text)
      : null;

  let knowledgeEntryCreated = false;
  if (input.matterId && input.createKnowledgeEntryInMatter && extraction.status === "Extracted" && excerpt) {
    await createKnowledgeEntry({
      matterId: input.matterId,
      title: input.source.name,
      entryType: "Book scan",
      tags: ["RAG intake", input.source.extension.toUpperCase()],
      summary: excerpt,
      storagePath: input.source.relativePath,
      sensitivity: "Restricted",
    });
    knowledgeEntryCreated = true;
  }

  const nextRecord: SourceIngestionRecord = {
    id: recordId,
    sourceRelativePath: input.source.relativePath,
    sourceName: input.source.name,
    sourceProvider: input.source.provider,
    extension: input.source.extension,
    status: extraction.status,
    extractedCharacters: extraction.text.length,
    excerpt,
    fullTextPath,
    failureReason: extraction.failureReason,
    matterId: input.matterId ?? null,
    knowledgeEntryCreated,
    ingestedAt,
    modifiedAt: input.source.modifiedAt,
    sizeBytes: input.source.sizeBytes,
  };

  const records = await listSourceIngestionRecords();
  const merged = [nextRecord, ...records.filter((record) => record.sourceRelativePath !== input.source.relativePath)];
  await writePrototypeCollection(collectionKey, merged);
  return nextRecord;
}

export function buildSourceIndexByPath(records: SourceIngestionRecord[]) {
  return new Map(records.map((record) => [record.sourceRelativePath, record]));
}

export function isRagSourceRelativePath(value: string) {
  return value.replace(/\\/g, "/").startsWith(`${ragInboxRelativePath}/`);
}
