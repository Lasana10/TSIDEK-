import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ragInboxRelativePath } from "@/lib/rag-inbox";

export const localVaultRootRelativePath = "storage";

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

export function getMatterDocumentRelativeDirectory(matterId: string) {
  return `${localVaultRootRelativePath}/matters/${matterId}/documents`;
}

export async function persistUploadedFile(input: {
  file: File;
  relativeDirectory: string;
  fileName?: string;
}) {
  const relativeDirectory = input.relativeDirectory.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const absoluteDirectory = path.join(process.cwd(), relativeDirectory);
  await mkdir(absoluteDirectory, { recursive: true });

  const storedFileName = buildUniqueFileName(input.fileName ?? input.file.name);
  const absolutePath = path.join(absoluteDirectory, storedFileName);
  const relativePath = `${relativeDirectory}/${storedFileName}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return {
    fileName: storedFileName,
    originalName: input.file.name,
    relativePath,
    absolutePath,
    sizeBytes: buffer.byteLength,
    mimeType: input.file.type || "application/octet-stream",
  };
}

export function getRagInboxUploadDirectory() {
  return ragInboxRelativePath;
}
