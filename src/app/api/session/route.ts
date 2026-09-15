import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSupabaseAuthConfigured } from "@/lib/supabase-auth";

export async function GET() {
  try {
    const identity = await getAuthenticatedUser();

    if (!identity?.user) {
      return NextResponse.json({
        authenticated: false,
        authConfigured: isSupabaseAuthConfigured(),
        contextStatus: "unauthenticated",
        needsOnboarding: false,
        actorName: null,
        actorRole: null,
        firmId: null,
        activeFirmId: null,
        memberships: [],
        userEmail: null,
      }, { status: 401 });
    }

    if (!identity.lawyer) {
      return NextResponse.json({
        authenticated: true,
        authConfigured: isSupabaseAuthConfigured(),
        contextStatus: "onboarding",
        needsOnboarding: true,
        actorName: identity.user.user_metadata?.full_name ?? identity.user.email ?? "Authenticated user",
        actorRole: null,
        firmId: null,
        activeFirmId: null,
        memberships: identity.memberships ?? [],
        userEmail: identity.user.email ?? null,
      });
    }

    const membership = identity.membership as { firm_id?: string | null; role_key?: string | null; title?: string | null } | null;
    const firmId = membership?.firm_id ?? identity.lawyer.firm_id ?? null;
    const actorRole = membership?.role_key ?? membership?.title ?? identity.lawyer.role ?? null;
    const contextReady = Boolean(firmId && identity.activeFirmId && actorRole && identity.memberships.length > 0);

    return NextResponse.json({
      authenticated: true,
      authConfigured: isSupabaseAuthConfigured(),
      contextStatus: contextReady ? "ready" : "unauthorized",
      needsOnboarding: false,
      actorName: identity.lawyer.full_name,
      actorRole,
      firmId,
      activeFirmId: identity.activeFirmId,
      memberships: identity.memberships,
      userEmail: identity.user.email ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: true,
      authConfigured: isSupabaseAuthConfigured(),
      contextStatus: "error",
      needsOnboarding: false,
      actorName: null,
      actorRole: null,
      firmId: null,
      activeFirmId: null,
      memberships: [],
      userEmail: null,
      error: error instanceof Error ? error.message : "Unable to resolve session context.",
    }, { status: 500 });
  }
}
