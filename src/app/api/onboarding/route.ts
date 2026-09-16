import { NextResponse } from "next/server";
import {
  completeUserOnboarding,
  getAuthenticatedUser,
} from "@/lib/supabase-auth";
import { firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function jsonNoStore(body: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: NO_STORE_HEADERS });
}

function isFirmRole(value: string): value is FirmRole {
  return (firmRoleOptions as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return jsonNoStore({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const firmName = String(body.firmName ?? "").trim();
    const country = String(body.country ?? "").trim();
    const roleValue = String(body.role ?? "").trim();

    if (!identity.lawyer && (!fullName || !firmName || !isFirmRole(roleValue))) {
      return jsonNoStore(
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

    // Do not re-run cookie/session authentication in the same activation request.
    // The user is already authenticated above; readiness is determined from the
    // persisted records that completeUserOnboarding just created or repaired.
    const refreshedIdentity = await getAuthenticatedUser();
    const lawyer = refreshedIdentity?.lawyer ?? null;
    const firmContext = {
      membership: refreshedIdentity?.membership ?? null,
      memberships: refreshedIdentity?.memberships ?? [],
      activeFirmId: refreshedIdentity?.activeFirmId ?? null,
    };

    const membership = firmContext.membership as {
      firm_id?: string | null;
      role_key?: string | null;
      title?: string | null;
      status?: string | null;
    } | null;
    const firmId = membership?.firm_id ?? lawyer?.firm_id ?? null;
    const actorRole = membership?.role_key ?? membership?.title ?? lawyer?.role ?? null;
    const workspaceReady = Boolean(
      lawyer &&
      membership &&
      membership.status === "active" &&
      firmId &&
      firmContext.activeFirmId === firmId &&
      actorRole &&
      firmContext.memberships.length > 0,
    );

    return jsonNoStore({
      success: true,
      workspaceReady,
      alreadyOnboarded: Boolean(identity.lawyer),
      firmId,
      activeFirmId: firmContext.activeFirmId,
      actorRole,
    });
  } catch (error) {
    return jsonNoStore(
      { success: false, error: error instanceof Error ? error.message : "Unable to complete onboarding." },
      { status: 500 },
    );
  }
}
