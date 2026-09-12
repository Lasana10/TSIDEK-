import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getOneDriveRagStatus, listOneDriveRagSources } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type RagInboxFile = {
  provider: "local";
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
};

export type RagInboxSupabaseFile = {
  provider: "supabase";
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
};

export type RagInboxOneDriveFile = {
  provider: "onedrive";
  id: string;
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  webUrl: string | null;
};

export type RagInboxSource = RagInboxFile | RagInboxSupabaseFile | RagInboxOneDriveFile;
export const ragInboxRelativePath = "rag-sources/ready-made-documents";

export function getRagInboxAbsolutePath() {
  return path.join(process.cwd(), ragInboxRelativePath);
}

export async function listRagInboxFiles(): Promise<RagInboxFile[]> {
  const inboxPath = getRagInboxAbsolutePath();
  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.filter((entry) => entry.isFile() && !entry.name.startsWith(".") && entry.name !== "README.md").map(async (entry) => {
        const absolutePath = path.join(inboxPath, entry.name);
        const fileStat = await stat(absolutePath);
        return { provider: "local" as const, name: entry.name, relativePath: `${ragInboxRelativePath}/${entry.name}`, extension: path.extname(entry.name).replace(".", "").toLowerCase() || "unknown", sizeBytes: fileStat.size, modifiedAt: fileStat.mtime.toISOString() };
      }),
    );
    return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch {
    return [];
  }
}

export async function listSupabaseRagInboxFiles(): Promise<RagInboxSupabaseFile[]> {
  const provider = String(process.env.TSIDEK_STORAGE_PROVIDER || "").toLowerCase();
  if (provider === "local" || (!provider && process.env.NODE_ENV !== "production")) return [];
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];
  const bucket = process.env.TSIDEK_STORAGE_BUCKET || "tsidek-vault";
  const result = await supabase.storage.from(bucket).list(ragInboxRelativePath, { limit: 200, sortBy: { column: "updated_at", order: "desc" } });
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).filter((item) => item.name && item.id).map((item) => ({
    provider: "supabase" as const,
    name: item.name,
    relativePath: `${ragInboxRelativePath}/${item.name}`,
    extension: path.extname(item.name).replace(".", "").toLowerCase() || "unknown",
    sizeBytes: Number(item.metadata?.size ?? 0),
    modifiedAt: item.updated_at || item.created_at || new Date(0).toISOString(),
  }));
}

export async function listUnifiedRagInboxSources() {
  const [localFiles, supabaseFiles] = await Promise.all([listRagInboxFiles(), listSupabaseRagInboxFiles()]);
  const oneDriveStatus = getOneDriveRagStatus();
  let oneDriveFiles: RagInboxOneDriveFile[] = [];
  let oneDriveError: string | null = null;
  if (oneDriveStatus.configured) {
    try {
      const sources = await listOneDriveRagSources();
      oneDriveFiles = sources.map((source) => ({ provider: "onedrive" as const, id: source.id, name: source.name, relativePath: source.relativePath, extension: path.extname(source.name).replace(".", "").toLowerCase() || "unknown", sizeBytes: source.sizeBytes, modifiedAt: source.modifiedAt, webUrl: source.webUrl }));
    } catch (error) {
      oneDriveError = error instanceof Error ? error.message : "Unable to read OneDrive RAG folder.";
    }
  }
  const allSources: RagInboxSource[] = [...oneDriveFiles, ...supabaseFiles, ...localFiles].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return { sources: allSources, localFiles, supabaseFiles, oneDriveFiles, oneDriveStatus, oneDriveError };
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kilobytes = sizeBytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
