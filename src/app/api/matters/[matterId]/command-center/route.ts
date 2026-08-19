import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertMatterPermission } from "@/lib/authorization";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { getMatterCommandCenter } from "@/lib/matter-command-center.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });

    return NextResponse.json({
      success: true,
      commandCenter: await getMatterCommandCenter({ matterId, scope }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load matter command center.",
      },
      { status: statusForApiError(error) }
    );
  }
}
