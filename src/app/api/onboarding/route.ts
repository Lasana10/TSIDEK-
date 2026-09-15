import { NextResponse } from "next/server";
import { completeUserOnboarding, getAuthenticatedUser } from "@/lib/supabase-auth";
import { firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

function isFirmRole(value: string): value is FirmRole {
  return (firmRoleOptions as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const firmName = String(body.firmName ?? "").trim();
    const country = String(body.country ?? "").trim();
    const roleValue = String(body.role ?? "").trim();

    // Existing profiles still pass through completeUserOnboarding so any missing
    // membership or active-firm context is repaired in the same server request.
    if (!identity.lawyer && (!fullName || !firmName || !isFirmRole(roleValue))) {
      return NextResponse.json(
        { success: false, error: "Full name, firm name, and a valid role are required." },
        { status: 400 },
      );
    }

    const effectiveRole = isFirmRole(roleValue)
      ? roleValue
      : ((identity.lawyer?.role && isFirmRole(identity.lawyer.role)) ? identity.lawyer.role : "Junior Associate");

    await completeUserOnboarding({
      userId: identity.user.id,
      email: identity.user.email ?? null,
      fullName: fullName || identity.lawyer?.full_name || identity.user.email?.split("@")[0] || "Firm member",
      firmName: firmName || "Firm",
      country,
      role: effectiveRole,
    });

    const resolved = await getAuthenticatedUser();
    const membership = resolved?.membership as { firm_id?: string | null; role_key?: string | null; title?: string | null } | null;
    const firmId = membership?.firm_id ?? resolved?.lawyer?.firm_id ?? null;
    const actorRole = membership?.role_key ?? membership?.title ?? resolved?.lawyer?.role ?? null;
    const workspaceReady = Boolean(
      resolved?.user &&
      resolved?.lawyer &&
      firmId &&
      resolved.activeFirmId &&
      actorRole &&
      resolved.memberships.length > 0,
    );

    return NextResponse.json({
      success: true,
      workspaceReady,
      alreadyOnboarded: Boolean(identity.lawyer),
      firmId,
      activeFirmId: resolved?.activeFirmId ?? null,
      actorRole,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to complete onboarding." },
      { status: 500 },
    );
  }
}
