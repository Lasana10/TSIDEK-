import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ragInboxRelativePath } from "@/lib/rag-inbox";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const localVaultRootRelativePath = "storage";
export const defaultVaultBucket = process.env.TSIDEK_STORAGE_BUCKET || "tsidek-vault";

function sanitizeSegment(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "file";
}

function buildUniqueFileName(originalName: string) {
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeSegment(baseName)}-${timestamp}${sanitizeSegment(extension) || extension}`;
}

function storageProvider() {
  const configured = String(process.env.TSIDEK_STORAGE_PROVIDER || "").trim().toLowerCase();
  if (configured === "local" || configured === "supabase") return configured;
  return process.env.NODE_ENV === "production" ? "supabase" : "local";
}

export function getMatterDocumentRelativeDirectory(matterId: string) {
  return `${localVaultRootRelativePath}/matters/${matterId}/documents`;
}

export async function persistUploadedFile(input: {
  file: File;
  relativeDirectory: string;
  fileName?: string;
}) {
  const relativeDirectory = input.relativeDirectory.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const storedFileName = buildUniqueFileName(input.fileName ?? input.file.name);
  const relativePath = `${relativeDirectory}/${storedFileName}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const mimeType = input.file.type || "application/octet-stream";
  const provider = storageProvider();

  if (provider === "supabase") {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      throw new Error("Durable TSIDKENU vault requires the server-side Supabase service credential.");
    }
    const upload = await supabase.storage.from(defaultVaultBucket).upload(relativePath, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });
    if (upload.error) throw new Error(upload.error.message);
    return {
      provider: "supabase" as const,
      bucket: defaultVaultBucket,
      fileName: storedFileName,
      originalName: input.file.name,
      relativePath,
      absolutePath: null,
      sizeBytes: buffer.byteLength,
      mimeType,
    };
  }

  const absoluteDirectory = path.join(process.cwd(), relativeDirectory);
  await mkdir(absoluteDirectory, { recursive: true });
  const absolutePath = path.join(absoluteDirectory, storedFileName);
  await writeFile(absolutePath, buffer);
  return {
    provider: "local" as const,
    bucket: null,
    fileName: storedFileName,
    originalName: input.file.name,
    relativePath,
    absolutePath,
    sizeBytes: buffer.byteLength,
    mimeType,
  };
}

export async function createVaultSignedReadUrl(relativePath: string, expiresInSeconds = 300) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required for private vault access.");
  const result = await supabase.storage.from(defaultVaultBucket).createSignedUrl(relativePath, expiresInSeconds);
  if (result.error) throw new Error(result.error.message);
  return result.data.signedUrl;
}

export function getRagInboxUploadDirectory() {
  return ragInboxRelativePath;
}
