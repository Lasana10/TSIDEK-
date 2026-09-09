import { getAuthenticatedUser, isSupabaseAuthConfigured } from "@/lib/supabase-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isDemoModeEnabled, isTrustedHeaderScopeEnabled } from "@/lib/runtime-mode";

export type RequestScope = {
  source: "auth-user" | "headers" | "supabase-demo" | "prototype-demo";
  firmId: string | null;
  actorLawyerId: string | null;
  actorName: string;
  actorRole: string;
  userEmail?: string | null;
  authenticated: boolean;
};

function trimHeader(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function resolveRequestScope(request?: Request): Promise<RequestScope> {
  const authIdentity = await getAuthenticatedUser();

  if (authIdentity?.lawyer) {
    const membership = authIdentity.membership as { role_key?: string | null } | null;
    return {
      source: "auth-user",
      firmId: authIdentity.activeFirmId ?? authIdentity.lawyer.firm_id ?? null,
      actorLawyerId: authIdentity.lawyer.id ?? null,
      actorName: authIdentity.lawyer.full_name ?? authIdentity.user.email ?? "TSIDEK User",
      actorRole: membership?.role_key ?? authIdentity.lawyer.role ?? "lawyer",
      userEmail: authIdentity.user.email ?? null,
      authenticated: true,
    };
  }

  if (authIdentity?.user) {
    const fallbackName =
      typeof authIdentity.user.user_metadata?.full_name === "string"
        ? authIdentity.user.user_metadata.full_name
        : typeof authIdentity.user.user_metadata?.name === "string"
          ? authIdentity.user.user_metadata.name
          : authIdentity.user.email ?? "TSIDEK User";

    return {
      source: "auth-user",
      firmId: authIdentity.activeFirmId ?? null,
      actorLawyerId: null,
      actorName: fallbackName,
      actorRole: "Onboarding required",
      userEmail: authIdentity.user.email ?? null,
      authenticated: true,
    };
  }

  const headerFirmId = trimHeader(request?.headers.get("x-tsidek-firm-id") ?? null);
  const headerActorLawyerId = trimHeader(request?.headers.get("x-tsidek-actor-id") ?? null);
  const headerActorName = trimHeader(request?.headers.get("x-tsidek-actor-name") ?? null);
  const headerActorRole = trimHeader(request?.headers.get("x-tsidek-actor-role") ?? null);
  const hasHeaderScope = Boolean(headerFirmId || headerActorLawyerId);

  if (hasHeaderScope && !isTrustedHeaderScopeEnabled()) {
    throw new Error("Header-scoped identity is disabled. Sign in with Supabase Auth.");
  }

  if (hasHeaderScope) {
    return {
      source: "headers",
      firmId: headerFirmId,
      actorLawyerId: headerActorLawyerId,
      actorName: headerActorName ?? "TSIDEK Header Actor",
      actorRole: headerActorRole ?? "Matter team",
      userEmail: null,
      authenticated: false,
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase || !isSupabaseAuthConfigured()) {
    if (!isDemoModeEnabled()) throw new Error("Supabase Auth is not configured. Set the Supabase environment variables before using TSIDEK.");
    return {
      source: "prototype-demo",
      firmId: null,
      actorLawyerId: null,
      actorName: "TSIDEK Prototype Operator",
      actorRole: "Demo operator",
      userEmail: null,
      authenticated: false,
    };
  }

  if (!isDemoModeEnabled()) throw new Error("Authentication required.");

  const [firmResult, lawyerResult] = await Promise.all([
    supabase.from("firms").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("lawyers").select("id,full_name,role,firm_id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (lawyerResult.error) throw new Error(lawyerResult.error.message);
  if (firmResult.error) throw new Error(firmResult.error.message);

  return {
    source: "supabase-demo",
    firmId: lawyerResult.data?.firm_id ?? firmResult.data?.id ?? null,
    actorLawyerId: lawyerResult.data?.id ?? null,
    actorName: lawyerResult.data?.full_name ?? "TSIDEK Demo Operator",
    actorRole: lawyerResult.data?.role ?? "Demo operator",
    userEmail: null,
    authenticated: false,
  };
}

export async function assertMatterScopeAccess(request: Request, matterId: string) {
  const scope = await resolveRequestScope(request);
  const supabase = createServerSupabaseClient();
  if (!supabase || !scope.firmId || !scope.actorLawyerId) return scope;

  const [matterResult, memberResult, overrideResult] = await Promise.all([
    supabase.from("matters").select("id,firm_id,lead_lawyer_id").eq("id", matterId).maybeSingle(),
    supabase.from("matter_members").select("id").eq("matter_id", matterId).eq("lawyer_id", scope.actorLawyerId).maybeSingle(),
    supabase.from("matter_access_overrides").select("access_type,expires_at").eq("matter_id", matterId).eq("lawyer_id", scope.actorLawyerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (matterResult.error) throw new Error(matterResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);
  if (overrideResult.error) throw new Error(overrideResult.error.message);
  if (!matterResult.data) throw new Error("Matter not found.");
  if (matterResult.data.firm_id !== scope.firmId) throw new Error("Matter access denied for the active firm.");

  const overrideActive = !overrideResult.data?.expires_at || new Date(overrideResult.data.expires_at).getTime() > Date.now();
  if (overrideActive && overrideResult.data?.access_type === "deny") throw new Error("Access denied by ethical wall.");
  const allowed = matterResult.data.lead_lawyer_id === scope.actorLawyerId || Boolean(memberResult.data) || (overrideActive && overrideResult.data?.access_type === "allow");
  if (!allowed) throw new Error("The acting lawyer is not assigned to this matter.");

  return scope;
}
