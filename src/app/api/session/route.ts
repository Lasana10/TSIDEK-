import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { getAuthenticatedUser, isSupabaseAuthConfigured } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    const identity = await getAuthenticatedUser();

    return NextResponse.json({
      authenticated: scope.authenticated,
      authConfigured: isSupabaseAuthConfigured(),
      needsOnboarding: Boolean(identity?.user && !identity.lawyer),
      actorName: scope.actorName,
      actorRole: scope.actorRole,
      firmId: scope.firmId,
      activeFirmId: identity?.activeFirmId ?? scope.firmId,
      memberships: identity?.memberships ?? [],
      userEmail: scope.userEmail ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      authConfigured: isSupabaseAuthConfigured(),
      needsOnboarding: false,
      actorName: null,
      actorRole: null,
      firmId: null,
      activeFirmId: null,
      memberships: [],
      userEmail: null,
      error: error instanceof Error ? error.message : "Unable to resolve session.",
    });
  }
}
