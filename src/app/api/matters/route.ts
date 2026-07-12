import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { createMatterWorkspaceServer, listMatterWorkspacesServer } from "@/lib/matters.server";
import { resolveRequestScope } from "@/lib/request-scope";

function statusForError(error: unknown) {
  if (error instanceof Error && error.message.includes("Complete onboarding")) {
    return 403;
  }

  return 500;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const matters = await listMatterWorkspacesServer(scope);
    return NextResponse.json({ matters, scope });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load matters." },
      { status: statusForError(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    const body = await request.json();

    if (body.action !== "createMatter") {
      return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }

    const matterPayload = {
      title: String(body.title ?? "").trim(),
      clientName: String(body.clientName ?? "").trim(),
      matterType: String(body.matterType ?? "General matter").trim(),
      jurisdiction: String(body.jurisdiction ?? "OHADA").trim(),
      riskLevel: String(body.riskLevel ?? "Medium").trim(),
      status: String(body.status ?? "Onboarding").trim(),
      synopsis: String(body.synopsis ?? "").trim(),
      primaryTrack: String(body.primaryTrack ?? "Matter onboarding and first working draft").trim(),
      riskToMonitor: String(body.riskToMonitor ?? "To be determined").trim(),
      aiUsageRule: String(body.aiUsageRule ?? "AI suggestions require human review").trim(),
      nextDraft: String(body.nextDraft ?? "Initial working draft").trim(),
    };

    if (!matterPayload.title || !matterPayload.clientName) {
      return NextResponse.json(
        { success: false, error: "Matter title and client name are required." },
        { status: 400 }
      );
    }

    const matter = await createMatterWorkspaceServer(matterPayload, scope);
    if (!matter) {
      return NextResponse.json(
        { success: false, error: "Unable to create matter" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, matterId: matter.id, matter, scope });
  } catch (error) {
    console.error("[API Matters Route] Error creating matter:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to create matter." },
      { status: statusForError(error) }
    );
  }
}
