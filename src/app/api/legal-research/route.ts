import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { searchLegalSources } from "@/lib/legal-research.server";

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query : "";
    const matterId = typeof body?.matterId === "string" && body.matterId ? body.matterId : null;
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 12;
    const asOfDate = typeof body?.asOfDate === "string" ? body.asOfDate : null;
    if (asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return NextResponse.json({success:false,error:"Invalid research effective date."},{status:400});

    const asOfDate=typeof body?.asOfDate === "string" ? body.asOfDate : null;
    const result = await searchLegalSources({ scope, query, matterId, limit, asOfDate });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Legal research failed.";
    const status = /auth|access|permission|onboarding/i.test(message) ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
