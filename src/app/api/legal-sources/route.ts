import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { ingestLegalTextSource, listLegalSources } from "@/lib/legal-ingestion.server";

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
    const body = await request.json();
    const result = await ingestLegalTextSource({
      scope,
      publisher: String(body.publisher ?? "Firm-controlled source"),
      jurisdiction: String(body.jurisdiction ?? "Unknown"),
      documentType: String(body.documentType ?? "legal_material"),
      title: String(body.title ?? "").trim(),
      text: String(body.text ?? ""),
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      canonicalUri: body.canonicalUri ? String(body.canonicalUri) : null,
      language: body.language ? String(body.language) : null,
      versionLabel: body.versionLabel ? String(body.versionLabel) : null,
      validFrom: body.validFrom ? String(body.validFrom) : null,
      validUntil: body.validUntil ? String(body.validUntil) : null,
      provenance: typeof body.provenance === "object" && body.provenance ? body.provenance : {},
    });
    return NextResponse.json({ success: true, ...result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest legal source.";
    const status = /auth|permission|firm/i.test(message) ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
