import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { assertFirmPermission } from "@/lib/authorization";
import type { RequestScope } from "@/lib/request-scope";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function chunkText(text: string, target = 3200, overlap = 300) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + target);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n", end),
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("; ", end)
      );
      if (boundary > cursor + Math.floor(target * 0.55)) end = boundary + 1;
    }
    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    cursor = Math.max(cursor + 1, end - overlap);
  }
  return chunks;
}

export async function ingestLegalTextSource(input: {
  scope: RequestScope;
  publisher: string;
  jurisdiction: string;
  documentType: string;
  title: string;
  text: string;
  sourceUrl?: string | null;
  canonicalUri?: string | null;
  language?: string | null;
  versionLabel?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  provenance?: Record<string, unknown>;
}) {
  await assertFirmPermission({ scope: input.scope, permission: "manageEvidence" });
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  const text = input.text.trim();
  if (text.length < 20) throw new Error("Legal source text is too short to ingest.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");

  const checksum = sha256(text);
  const existing = await supabase
    .from("legal_source_documents")
    .select("id,title,ingestion_status")
    .eq("firm_id", input.scope.firmId)
    .eq("checksum", checksum)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { source: existing.data, duplicate: true, chunks: 0 };

  const inserted = await supabase.from("legal_source_documents").insert({
    firm_id: input.scope.firmId,
    source_scope: "firm",
    publisher: input.publisher.trim() || "Firm-controlled source",
    jurisdiction: input.jurisdiction.trim() || "Unknown",
    document_type: input.documentType.trim() || "legal_material",
    title: input.title.trim(),
    canonical_uri: input.canonicalUri ?? null,
    source_url: input.sourceUrl ?? null,
    language: input.language?.trim() || "fr",
    version_label: input.versionLabel ?? null,
    valid_from: input.validFrom ?? null,
    valid_until: input.validUntil ?? null,
    checksum,
    ingestion_status: "processing",
    provenance: input.provenance ?? {},
    created_by: input.scope.actorLawyerId,
  }).select("id,title,ingestion_status").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Unable to register legal source.");

  try {
    const chunks = chunkText(text);
    const rows = chunks.map((content, chunkIndex) => ({
      source_document_id: inserted.data.id,
      firm_id: input.scope.firmId,
      chunk_index: chunkIndex,
      section_path: `chunk:${chunkIndex + 1}`,
      content,
      content_hash: sha256(content),
      metadata: { characterLength: content.length },
    }));
    const chunkInsert = await supabase.from("legal_source_chunks").insert(rows);
    if (chunkInsert.error) throw new Error(chunkInsert.error.message);
    const ready = await supabase.from("legal_source_documents").update({ ingestion_status: "ready", updated_at: new Date().toISOString() }).eq("id", inserted.data.id).select("id,title,ingestion_status").single();
    if (ready.error) throw new Error(ready.error.message);
    return { source: ready.data, duplicate: false, chunks: rows.length };
  } catch (error) {
    await supabase.from("legal_source_documents").update({ ingestion_status: "failed", updated_at: new Date().toISOString() }).eq("id", inserted.data.id);
    throw error;
  }
}

export async function listLegalSources(scope: RequestScope) {
  if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const { data, error } = await supabase
    .from("legal_source_documents")
    .select("id,source_scope,publisher,jurisdiction,document_type,title,source_url,canonical_uri,language,version_label,valid_from,valid_until,checksum,ingestion_status,created_at")
    .or(`source_scope.eq.public,firm_id.eq.${scope.firmId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}
