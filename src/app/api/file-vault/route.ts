import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import {
  getMatterDocumentRelativeDirectory,
  getRagInboxUploadDirectory,
  persistUploadedFile,
} from "@/lib/file-vault";
import {
  createDigitalCaseFile,
  createKnowledgeEntry,
  createMatterDocument,
  getMatterRoomById,
} from "@/lib/matter-room";
import { uploadFileToOneDrivePath } from "@/lib/onedrive";
import { assertMatterScopeAccess, resolveRequestScope } from "@/lib/request-scope";
import { listUnifiedRagInboxSources } from "@/lib/rag-inbox";

export const dynamic = "force-dynamic";

function filterRoomDocumentsForScope(scope: Awaited<ReturnType<typeof resolveRequestScope>>, room: Awaited<ReturnType<typeof getMatterRoomById>>) {
  if (!room) {
    return room;
  }

  const isPartner = scope.actorRole === "Partner";
  const isLeadLawyer = scope.actorName.trim().toLowerCase() === room.matter.leadLawyer.trim().toLowerCase();

  if (isPartner || isLeadLawyer) {
    return room;
  }

  return {
    ...room,
    documents: room.documents.filter((document) => document.accessLevel !== "Lead+Partner"),
  };
}

function parseBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && (value === "true" || value === "1");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get("target") ?? "rag";

    if (target === "rag") {
      const scope = await resolveRequestScope(request);
      await assertFirmPermission({ scope, permission: "openMatters" });
      const result = await listUnifiedRagInboxSources();
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: "Unsupported vault target." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load file vault." },
      { status: statusForApiError(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const target = String(formData.get("target") ?? "rag");
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ success: false, error: "A file is required." }, { status: 400 });
    }

    if (target === "rag") {
      const scope = await resolveRequestScope(request);
      await assertFirmPermission({ scope, permission: "openMatters" });

      const stored = await persistUploadedFile({
        file,
        relativeDirectory: getRagInboxUploadDirectory(),
      });

      let oneDriveMirror:
        | {
            id: string | null;
            webUrl: string | null;
            name: string;
            relativePath: string;
          }
        | null = null;
      let oneDriveError: string | null = null;

      try {
        oneDriveMirror = await uploadFileToOneDrivePath({
          fileName: stored.fileName,
          content: await file.arrayBuffer(),
          mimeType: file.type,
        });
      } catch (error) {
        oneDriveError = error instanceof Error ? error.message : "Unable to mirror to OneDrive.";
      }

      const result = await listUnifiedRagInboxSources();
      return NextResponse.json({
        success: true,
        ...result,
        upload: {
          provider: "local",
          fileName: stored.fileName,
          relativePath: stored.relativePath,
          sizeBytes: stored.sizeBytes,
          mimeType: stored.mimeType,
        },
        oneDriveMirror,
        oneDriveError: oneDriveError ?? result.oneDriveError,
      });
    }

    if (target === "matter-document") {
      const matterId = String(formData.get("matterId") ?? "").trim();
      if (!matterId) {
        return NextResponse.json({ success: false, error: "Matter ID is required." }, { status: 400 });
      }

      const scope = await assertMatterScopeAccess(request, matterId);
      await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });

      const stored = await persistUploadedFile({
        file,
        relativeDirectory: getMatterDocumentRelativeDirectory(matterId),
      });

      await createMatterDocument({
        matterId,
        title: String(formData.get("title") ?? file.name).trim() || file.name,
        documentType: String(formData.get("documentType") ?? "Uploaded evidence").trim() || "Uploaded evidence",
        documentStatus:
          (String(formData.get("documentStatus") ?? "Draft") as "Draft" | "Final" | "Filed" | "Archived"),
        reviewStatus:
          (String(formData.get("reviewStatus") ?? "Working") as
            | "Working"
            | "Internal review"
            | "Approved"
            | "Needs revision"),
        accessLevel:
          (String(formData.get("accessLevel") ?? "Matter team") as "Matter team" | "Lead+Partner"),
        sharingPolicy:
          (String(formData.get("sharingPolicy") ?? "Internal only") as
            | "Internal only"
            | "Client-share ready"
            | "Blocked"),
        versionLabel: String(formData.get("versionLabel") ?? "v1").trim() || "v1",
        storagePath: stored.relativePath,
        aiSummary:
          String(formData.get("aiSummary") ?? "").trim() ||
          `${file.name} was uploaded into the matter vault on July 23, 2026.`,
        requiresComplianceAudit: parseBoolean(formData.get("requiresComplianceAudit")),
        reviewNote: String(formData.get("reviewNote") ?? "").trim() || null,
      });

      await createDigitalCaseFile({
        matterId,
        fileLabel: String(formData.get("title") ?? file.name).trim() || file.name,
        fileCategory: String(formData.get("documentType") ?? "Uploaded evidence").trim() || "Uploaded evidence",
        storagePath: stored.relativePath,
        storageProvider: "TSIDEK Vault",
        referenceCode: null,
        versionLabel: String(formData.get("versionLabel") ?? "v1").trim() || "v1",
        status: String(formData.get("documentStatus") ?? "Draft") === "Archived" ? "Archived" : "Active",
      });

      if (parseBoolean(formData.get("registerKnowledge"))) {
        await createKnowledgeEntry({
          matterId,
          title: String(formData.get("knowledgeTitle") ?? file.name).trim() || file.name,
          entryType: "Book scan",
          tags: ["Upload", String(formData.get("documentType") ?? "Uploaded evidence").trim() || "Document"],
          summary:
            String(formData.get("knowledgeSummary") ?? "").trim() ||
            `${file.name} was uploaded to the matter vault and staged for later OCR / RAG processing.`,
          storagePath: stored.relativePath,
          sensitivity: "Restricted",
        });
      }

      const room = filterRoomDocumentsForScope(scope, await getMatterRoomById(matterId));

      return NextResponse.json({
        success: true,
        upload: {
          provider: "local",
          fileName: stored.fileName,
          relativePath: stored.relativePath,
          sizeBytes: stored.sizeBytes,
          mimeType: stored.mimeType,
        },
        room,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported vault target." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to process file upload." },
      { status: statusForApiError(error) }
    );
  }
}
