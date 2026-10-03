import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertFirmPermission } from "@/lib/authorization";
import { createMatterWorkspaceServer, listMatterWorkspacesServer } from "@/lib/matters.server";
import { inferMatterOperatingModel } from "@/lib/matter-operating-model";
import { resolveRequestScope } from "@/lib/request-scope";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const matters = await listMatterWorkspacesServer(scope);
    return NextResponse.json({ matters, scope });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load matters." }, { status: statusForApiError(error) });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const body = await request.json();
    if (body.action !== "createMatter") return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });

    const title = String(body.title ?? "").trim();
    const clientName = String(body.clientName ?? "").trim();
    const matterType = String(body.matterType ?? "General matter").trim();
    const jurisdiction = String(body.jurisdiction ?? "Cameroon").trim();
    const synopsis = String(body.synopsis ?? "").trim();
    const clientObjective = String(body.clientObjective ?? "").trim();
    if (!title || !clientName) return NextResponse.json({ success: false, error: "Matter title and client name are required." }, { status: 400 });

    const operatingModel = inferMatterOperatingModel({ title, matterType, jurisdiction, synopsis, objective: clientObjective });
    const matterPayload = {
      title, clientName, matterType, jurisdiction,
      riskLevel: String(body.riskLevel ?? "Medium").trim(),
      status: String(body.status ?? "Onboarding").trim(), synopsis,
      primaryTrack: operatingModel.planLabel,
      riskToMonitor: String(body.riskToMonitor ?? "To be determined").trim(),
      aiUsageRule: String(body.aiUsageRule ?? "AI suggestions require human review").trim(),
      nextDraft: operatingModel.workstreams[0] ?? "Confirm matter scope",
      operatingModel,
    };

    const matter = await createMatterWorkspaceServer(matterPayload, scope);
    if (!matter) return NextResponse.json({ success: false, error: "Unable to create matter" }, { status: 500 });
    return NextResponse.json({ success: true, matterId: matter.id, matter, operatingModel, scope });
  } catch (error) {
    console.error("[API Matters Route] Error creating matter:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create matter." }, { status: statusForApiError(error) });
  }
}
