import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { getAuthenticatedUser, isSupabaseAuthConfigured } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const scope = await resolveRequestScope(request);
  const identity = await getAuthenticatedUser();

  return NextResponse.json({
    authenticated: scope.authenticated,
    authConfigured: isSupabaseAuthConfigured(),
    needsOnboarding: Boolean(identity?.user && !identity.lawyer),
    actorName: scope.actorName,
    actorRole: scope.actorRole,
    firmId: scope.firmId,
    userEmail: scope.userEmail ?? null,
  });
}
