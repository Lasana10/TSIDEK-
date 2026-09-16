import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { persistUploadedFile } from "@/lib/file-vault";
import { ingestLegalTextSource, listLegalSources } from "@/lib/legal-ingestion.server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function registerBinarySource(input: {
  scope: Awaited<ReturnType<typeof resolveRequestScope>>;
  title: string;
  publisher: string;
  jurisdiction: string;
  documentType: string;
  language: string;
  sourceUrl?: string | null;
  canonicalUri?: string | null;
  versionLabel?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  checksum: string;
  provenance: Record<string, unknown>;
}) {
  await assertFirmPermission({ scope: input.scope, permission: "manageEvidence" });
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const existing = await supabase.from("legal_source_documents").select("id,title,ingestion_status").eq("firm_id", input.scope.firmId).eq("checksum", input.checksum).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { source: existing.data, duplicate: true, chunks: 0 };
  const inserted = await supabase.from("legal_source_documents").insert({
    firm_id: input.scope.firmId,
    source_scope: "firm",
    publisher: input.publisher || "Firm-controlled source",
    jurisdiction: input.jurisdiction || "Unknown",
    document_type: input.documentType || "legal_material",
    title: input.title,
    canonical_uri: input.canonicalUri || null,
    source_url: input.sourceUrl || null,
    language: input.language || "fr",
    version_label: input.versionLabel || null,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    checksum: input.checksum,
    ingestion_status: "pending_extraction",
    provenance: input.provenance,
    created_by: input.scope.actorLawyerId,
  }).select("id,title,ingestion_status").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "Unable to register legal source.");
  return { source: inserted.data, duplicate: false, chunks: 0 };
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const sources = await listLegalSources(scope);
    return NextResponse.json({ success: true, sources });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to list legal sources." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) return NextResponse.json({ success: false, error: "Choose a legal source file." }, { status: 400 });
      const title = String(form.get("title") || file.name).trim();
      if (!title) return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
      const publisher = String(form.get("publisher") || "Firm-controlled source").trim();
      const jurisdiction = String(form.get("jurisdiction") || "Unknown").trim();
      const documentType = String(form.get("documentType") || "legal_material").trim();
      const language = String(form.get("language") || "fr").trim();
      const buffer = Buffer.from(await file.arrayBuffer());
      const textual = file.type.startsWith("text/") || ["application/json","application/xml","application/xhtml+xml"].includes(file.type);
      if (textual) {
        const raw = buffer.toString("utf8");
        const text = file.type.includes("html") || file.type.includes("xml") ? stripHtml(raw) : raw;
        const result = await ingestLegalTextSource({ scope, publisher, jurisdiction, documentType, title, text, language, provenance: { intake: "local_file", fileName: file.name, mimeType: file.type, sizeBytes: file.size } });
        return NextResponse.json({ success: true, ...result, mode: "indexed" }, { status: result.duplicate ? 200 : 201 });
      }
      const stored = await persistUploadedFile({ file, relativeDirectory: "storage/law-bank/source-documents" });
      const result = await registerBinarySource({ scope, title, publisher, jurisdiction, documentType, language, checksum: sha256(buffer), provenance: { intake: "local_file", fileName: file.name, mimeType: file.type, sizeBytes: file.size, storagePath: stored.relativePath, storageProvider: stored.provider } });
      return NextResponse.json({ success: true, ...result, mode: "pending_extraction", upload: stored }, { status: result.duplicate ? 200 : 201 });
    }

    const body = await request.json();
    const mode = String(body.mode || "text");
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    const publisher = String(body.publisher ?? "Firm-controlled source");
    const jurisdiction = String(body.jurisdiction ?? "Unknown");
    const documentType = String(body.documentType ?? "legal_material");
    const language = body.language ? String(body.language) : "fr";

    if (mode === "url") {
      const sourceUrl = String(body.sourceUrl ?? "").trim();
      if (!/^https?:\/\//i.test(sourceUrl)) return NextResponse.json({ success: false, error: "A valid http(s) source URL is required." }, { status: 400 });
      const response = await fetch(sourceUrl, { redirect: "follow", headers: { "User-Agent": "TSIDKENU-LawBank/1.0" } });
      if (!response.ok) throw new Error(`Source retrieval failed with HTTP ${response.status}.`);
      const mime = response.headers.get("content-type") || "application/octet-stream";
      const bytes = Buffer.from(await response.arrayBuffer());
      if (mime.includes("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("html")) {
        const raw = bytes.toString("utf8");
        const text = mime.includes("html") || mime.includes("xml") ? stripHtml(raw) : raw;
        const result = await ingestLegalTextSource({ scope, publisher, jurisdiction, documentType, title, text, sourceUrl, canonicalUri: body.canonicalUri ? String(body.canonicalUri) : sourceUrl, language, versionLabel: body.versionLabel ? String(body.versionLabel) : null, validFrom: body.validFrom ? String(body.validFrom) : null, validUntil: body.validUntil ? String(body.validUntil) : null, provenance: { intake: "official_url", fetchedAt: new Date().toISOString(), mimeType: mime, finalUrl: response.url } });
        return NextResponse.json({ success: true, ...result, mode: "indexed" }, { status: result.duplicate ? 200 : 201 });
      }
      const result = await registerBinarySource({ scope, title, publisher, jurisdiction, documentType, language, sourceUrl, canonicalUri: body.canonicalUri ? String(body.canonicalUri) : sourceUrl, versionLabel: body.versionLabel ? String(body.versionLabel) : null, validFrom: body.validFrom ? String(body.validFrom) : null, validUntil: body.validUntil ? String(body.validUntil) : null, checksum: sha256(bytes), provenance: { intake: "official_url", fetchedAt: new Date().toISOString(), mimeType: mime, finalUrl: response.url, sizeBytes: bytes.length } });
      return NextResponse.json({ success: true, ...result, mode: "pending_extraction" }, { status: result.duplicate ? 200 : 201 });
    }

    const result = await ingestLegalTextSource({
      scope,
      publisher,
      jurisdiction,
      documentType,
      title,
      text: String(body.text ?? ""),
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      canonicalUri: body.canonicalUri ? String(body.canonicalUri) : null,
      language,
      versionLabel: body.versionLabel ? String(body.versionLabel) : null,
      validFrom: body.validFrom ? String(body.validFrom) : null,
      validUntil: body.validUntil ? String(body.validUntil) : null,
      provenance: typeof body.provenance === "object" && body.provenance ? body.provenance : { intake: "manual_text" },
    });
    return NextResponse.json({ success: true, ...result, mode: "indexed" }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest legal source.";
    const status = /auth|permission|firm/i.test(message) ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
