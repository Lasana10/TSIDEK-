import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { persistUploadedFile } from "@/lib/file-vault";

async function refreshBatch(supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>, batchId: string) {
  const items = await supabase.from("digitisation_items").select("review_status").eq("batch_id", batchId);
  if (items.error) throw new Error(items.error.message);
  const rows = items.data ?? [];
  const total = rows.length;
  const accepted = rows.filter((row) => row.review_status === "accepted" || row.review_status === "corrected").length;
  const reviewRequired = rows.filter((row) => row.review_status === "pending").length;
  const classified = total - reviewRequired;
  const status = total > 0 && reviewRequired === 0 ? "completed" : "review_required";
  const result = await supabase.from("digitisation_batches").update({
    total_files: total,
    classified_files: classified,
    review_required_files: reviewRequired,
    approved_files: accepted,
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", batchId).select("*").single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission: "manageEvidence" });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const url = new URL(request.url);
    const batchId = url.searchParams.get("batchId")?.trim() || "";

    const batches = await supabase.from("digitisation_batches")
      .select("id,title,source_type,source_location,matter_id,status,total_files,classified_files,review_required_files,approved_files,created_at,updated_at")
      .eq("firm_id", scope.firmId).order("created_at", { ascending: false }).limit(30);
    if (batches.error) throw new Error(batches.error.message);

    let items: unknown[] = [];
    if (batchId) {
      const batch = (batches.data ?? []).find((row) => row.id === batchId);
      if (!batch) return NextResponse.json({ success: false, error: "Digitisation batch not found." }, { status: 404 });
      if (batch.matter_id) await assertMatterPermission({ scope, matterId: batch.matter_id, permission: "manageEvidence" });
      const result = await supabase.from("digitisation_items")
        .select("id,batch_id,matter_id,party_id,original_name,storage_ref,checksum_sha256,mime_type,file_size_bytes,proposed_document_type,proposed_document_date,proposed_title,classification_confidence,duplicate_of_document_id,review_status,reviewed_at,metadata,created_at")
        .eq("firm_id", scope.firmId).eq("batch_id", batchId).order("created_at");
      if (result.error) throw new Error(result.error.message);
      items = result.data ?? [];
    }

    const matters = await supabase.from("matters").select("id,title,client_name,status").eq("firm_id", scope.firmId).order("updated_at", { ascending: false }).limit(100);
    if (matters.error) throw new Error(matters.error.message);
    return NextResponse.json({ success: true, batches: batches.data ?? [], items, matters: matters.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load digitisation desk." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission: "manageEvidence" });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return NextResponse.json({ success: false, error: "Select at least one file." }, { status: 400 });

    let batchId = String(formData.get("batchId") ?? "").trim();
    const matterId = String(formData.get("matterId") ?? "").trim() || null;
    if (matterId) await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });

    if (!batchId) {
      const title = String(formData.get("title") ?? "Archive import").trim() || "Archive import";
      const sourceType = ["scanner","folder_import","phone_scan","storage_connector","manual_upload","legacy_archive"].includes(String(formData.get("sourceType"))) ? String(formData.get("sourceType")) : "manual_upload";
      const created = await supabase.from("digitisation_batches").insert({
        firm_id: scope.firmId,
        title,
        source_type: sourceType,
        source_location: String(formData.get("sourceLocation") ?? "").trim() || null,
        matter_id: matterId,
        status: "ingesting",
        created_by: scope.actorLawyerId,
      }).select("*").single();
      if (created.error) throw new Error(created.error.message);
      batchId = created.data.id;
    } else {
      const batch = await supabase.from("digitisation_batches").select("id,matter_id").eq("id", batchId).eq("firm_id", scope.firmId).single();
      if (batch.error) throw new Error(batch.error.message);
      if (batch.data.matter_id) await assertMatterPermission({ scope, matterId: batch.data.matter_id, permission: "manageEvidence" });
    }

    const uploaded = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const [existingDocument, existingItem] = await Promise.all([
        supabase.from("documents").select("id,matter_id,title").eq("checksum", checksum).limit(1).maybeSingle(),
        supabase.from("digitisation_items").select("id,batch_id,original_name").eq("firm_id", scope.firmId).eq("checksum_sha256", checksum).limit(1).maybeSingle(),
      ]);
      if (existingDocument.error) throw new Error(existingDocument.error.message);
      if (existingItem.error) throw new Error(existingItem.error.message);

      const stored = await persistUploadedFile({
        file,
        relativeDirectory: `storage/digitisation/${scope.firmId}/${batchId}`,
      });
      const duplicate = Boolean(existingDocument.data || existingItem.data);
      const inserted = await supabase.from("digitisation_items").insert({
        firm_id: scope.firmId,
        batch_id: batchId,
        matter_id: matterId,
        original_name: file.name,
        storage_ref: stored.relativePath,
        checksum_sha256: checksum,
        mime_type: stored.mimeType,
        file_size_bytes: stored.sizeBytes,
        proposed_title: file.name.replace(/\.[^.]+$/, ""),
        proposed_document_type: "Unclassified",
        duplicate_of_document_id: existingDocument.data?.id ?? null,
        review_status: duplicate ? "duplicate" : "pending",
        metadata: existingItem.data ? { duplicate_digitisation_item_id: existingItem.data.id } : {},
      }).select("*").single();
      if (inserted.error) throw new Error(inserted.error.message);
      uploaded.push(inserted.data);
    }

    const batch = await refreshBatch(supabase, batchId);
    return NextResponse.json({ success: true, batch, items: uploaded }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to ingest archive files." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission: "manageEvidence" });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const itemId = String(body.itemId ?? "").trim();
    if (!itemId) return NextResponse.json({ success: false, error: "Digitisation item is required." }, { status: 400 });

    const current = await supabase.from("digitisation_items").select("*").eq("id", itemId).eq("firm_id", scope.firmId).single();
    if (current.error) throw new Error(current.error.message);
    const targetMatterId = body.matterId ? String(body.matterId) : current.data.matter_id;
    if (targetMatterId) await assertMatterPermission({ scope, matterId: targetMatterId, permission: "manageEvidence" });
    const status = ["accepted","corrected","rejected","duplicate"].includes(String(body.reviewStatus)) ? String(body.reviewStatus) : "accepted";

    let documentId = current.data.metadata?.document_id ?? null;
    if ((status === "accepted" || status === "corrected") && targetMatterId && !documentId) {
      const document = await supabase.from("documents").insert({
        matter_id: targetMatterId,
        uploaded_by: scope.actorLawyerId,
        title: String(body.title ?? current.data.proposed_title ?? current.data.original_name).trim(),
        document_type: String(body.documentType ?? current.data.proposed_document_type ?? "Digitised document").trim(),
        storage_path: current.data.storage_ref,
        ai_summary: "Imported through the governed TSIDKENU Digitisation Desk; content extraction and legal classification require separate confirmation.",
        status: "Draft",
        review_status: "Working",
        access_level: "Matter team",
        sharing_policy: "Internal only",
        version_label: "v1",
        source_kind: "Digitised archive",
        checksum: current.data.checksum_sha256,
        original_location: current.data.storage_ref,
      }).select("id").single();
      if (document.error) throw new Error(document.error.message);
      documentId = document.data.id;
    }

    const metadata = { ...(current.data.metadata ?? {}), ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}), document_id: documentId };
    const updated = await supabase.from("digitisation_items").update({
      matter_id: targetMatterId || null,
      party_id: body.partyId ? String(body.partyId) : current.data.party_id,
      proposed_title: body.title ? String(body.title).trim() : current.data.proposed_title,
      proposed_document_type: body.documentType ? String(body.documentType).trim() : current.data.proposed_document_type,
      proposed_document_date: body.documentDate || current.data.proposed_document_date,
      review_status: status,
      reviewed_by: scope.actorLawyerId,
      reviewed_at: new Date().toISOString(),
      metadata,
    }).eq("id", itemId).select("*").single();
    if (updated.error) throw new Error(updated.error.message);
    const batch = await refreshBatch(supabase, current.data.batch_id);
    return NextResponse.json({ success: true, item: updated.data, batch, documentId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to review digitisation item." }, { status: 403 });
  }
}
