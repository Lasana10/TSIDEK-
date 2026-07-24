import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { listUnifiedRagInboxSources } from "@/lib/rag-inbox";
import {
  ingestSource,
  isRagSourceRelativePath,
  listSourceIngestionRecords,
} from "@/lib/source-ingestion";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const records = await listSourceIngestionRecords();
    return NextResponse.json({ success: true, records });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load ingestion records." },
      { status: statusForApiError(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const body = (await request.json()) as {
      sourceRelativePath?: string;
      matterId?: string | null;
      createKnowledgeEntryInMatter?: boolean;
    };

    const sourceRelativePath = String(body.sourceRelativePath ?? "").trim();
    if (!sourceRelativePath || !isRagSourceRelativePath(sourceRelativePath)) {
      return NextResponse.json({ success: false, error: "A valid staged RAG source path is required." }, { status: 400 });
    }

    const { sources } = await listUnifiedRagInboxSources();
    const source = sources.find((item) => item.relativePath === sourceRelativePath);
    if (!source) {
      return NextResponse.json({ success: false, error: "The staged source could not be found." }, { status: 404 });
    }

    const record = await ingestSource({
      source,
      matterId: body.matterId ?? null,
      createKnowledgeEntryInMatter: Boolean(body.createKnowledgeEntryInMatter),
    });

    const records = await listSourceIngestionRecords();
    return NextResponse.json({ success: true, record, records });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to ingest staged source." },
      { status: statusForApiError(error) }
    );
  }
}
