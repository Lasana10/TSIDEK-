import { NextResponse } from "next/server";
import { statusForApiError } from "@/lib/api-errors";
import { assertMatterPermission } from "@/lib/authorization";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import {
  getMatterLifecycle,
  transitionMatterLifecycle,
} from "@/lib/matter-lifecycle.server";
import { isMatterLifecycleState } from "@/lib/matter-lifecycle";

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
      lifecycle: await getMatterLifecycle(matterId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load matter lifecycle.",
      },
      { status: statusForApiError(error) }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);

    // Reuse an already-enforced TSIDEK permission until the dedicated
    // manageLifecycle permission is introduced across the role UI.
    await assertMatterPermission({
      scope,
      matterId,
      permission: "assignWork",
    });

    const body = (await request.json()) as {
      targetState?: unknown;
      reason?: unknown;
      metadata?: unknown;
    };

    if (!isMatterLifecycleState(body.targetState)) {
      return NextResponse.json(
        { success: false, error: "A valid targetState is required." },
        { status: 400 }
      );
    }

    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;

    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {};

    const lifecycle = await transitionMatterLifecycle({
      matterId,
      targetState: body.targetState,
      scope,
      reason,
      metadata,
    });

    return NextResponse.json({ success: true, lifecycle });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to transition matter lifecycle.",
      },
      { status: statusForApiError(error) }
    );
  }
}
