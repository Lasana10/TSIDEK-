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

    if (identity.lawyer) {
      return NextResponse.json({ success: true, lawyer: identity.lawyer, alreadyOnboarded: true });
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const firmName = String(body.firmName ?? "").trim();
    const country = String(body.country ?? "").trim();
    const roleValue = String(body.role ?? "").trim();

    if (!fullName || !firmName || !isFirmRole(roleValue)) {
      return NextResponse.json(
        { success: false, error: "Full name, firm name, and a valid role are required." },
        { status: 400 }
      );
    }

    const lawyer = await completeUserOnboarding({
      userId: identity.user.id,
      email: identity.user.email ?? null,
      fullName,
      firmName,
      country,
      role: roleValue,
    });

    return NextResponse.json({ success: true, lawyer });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to complete onboarding." },
      { status: 500 }
    );
  }
}
