import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { isDemoModeEnabled } from "@/lib/runtime-mode";

export type PermissionKey =
  | "openMatters"
  | "assignWork"
  | "approveFilings"
  | "viewBilling"
  | "manageEvidence"
  | "editDeadlines"
  | "inviteCollaborators"
  | "exportAudit";

const defaultPermissionsByRole: Record<string, PermissionKey[]> = {
  Partner: [
    "openMatters",
    "assignWork",
    "approveFilings",
    "viewBilling",
    "manageEvidence",
    "editDeadlines",
    "inviteCollaborators",
    "exportAudit",
  ],
  "Senior Associate": ["openMatters", "assignWork", "manageEvidence", "editDeadlines", "viewBilling"],
  "Junior Associate": ["openMatters", "manageEvidence", "editDeadlines"],
  Lawyer: ["openMatters", "assignWork", "manageEvidence", "editDeadlines", "viewBilling"],
  Paralegal: ["openMatters", "manageEvidence", "editDeadlines"],
  Intern: ["manageEvidence"],
  "Project Manager": ["assignWork", "manageEvidence", "editDeadlines", "inviteCollaborators", "exportAudit"],
};

const onboardingMessage = "Complete onboarding before using TSIDEK.";

function uniquePermissions(values: PermissionKey[]) {
  return Array.from(new Set(values));
}

async function loadActorMembership(input: { matterId: string; actorLawyerId: string }) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const [memberResult, lawyerResult, matterResult, accessOverrideResult] = await Promise.all([
    supabase
      .from("matter_members")
      .select("lawyer_id,firm_role_id,is_primary")
      .eq("matter_id", input.matterId)
      .eq("lawyer_id", input.actorLawyerId)
      .maybeSingle(),
    supabase
      .from("lawyers")
      .select("id,firm_id,role")
      .eq("id", input.actorLawyerId)
      .maybeSingle(),
    supabase
      .from("matters")
      .select("id,firm_id,lead_lawyer_id,security_classification,ethical_wall_enabled")
      .eq("id", input.matterId)
      .maybeSingle(),
    supabase
      .from("matter_access_overrides")
      .select("access_status,reason")
      .eq("matter_id", input.matterId)
      .eq("lawyer_id", input.actorLawyerId)
      .maybeSingle(),
  ]);

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  if (lawyerResult.error) {
    throw new Error(lawyerResult.error.message);
  }

  if (matterResult.error) {
    throw new Error(matterResult.error.message);
  }

  if (accessOverrideResult.error) {
    throw new Error(accessOverrideResult.error.message);
  }

  return {
    membership: memberResult.data,
    lawyer: lawyerResult.data,
    matter: matterResult.data,
    accessOverride: accessOverrideResult.data as
      | {
          access_status: "allowed" | "screened";
          reason: string | null;
        }
      | null,
  };
}

async function loadFirmRolePermissions(firmRoleId: string) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return [];
  }

  const permissionResult = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", firmRoleId);

  if (permissionResult.error) {
    throw new Error(permissionResult.error.message);
  }

  return ((permissionResult.data ?? []) as Array<{ permission_key: string }>)
    .map((item) => item.permission_key)
    .filter((item): item is PermissionKey => Boolean(item));
}

export async function assertMatterPermission(input: {
  scope: RequestScope;
  matterId: string;
  permission?: PermissionKey;
  allowAnyMember?: boolean;
}) {
  const { scope, matterId, permission, allowAnyMember } = input;

  if (scope.source === "prototype-demo" && isDemoModeEnabled()) {
    return scope;
  }

  if (!scope.actorLawyerId) {
    throw new Error(onboardingMessage);
  }

  const membership = await loadActorMembership({
    matterId,
    actorLawyerId: scope.actorLawyerId,
  });

  if (!membership?.matter || !membership.lawyer) {
    throw new Error("Unable to resolve the acting lawyer or matter scope.");
  }

  if (scope.firmId && membership.matter.firm_id !== scope.firmId) {
    throw new Error("Matter access denied for the current firm scope.");
  }

  const overrideAllowed = membership.accessOverride?.access_status === "allowed";
  const overrideScreened = membership.accessOverride?.access_status === "screened";
  const isLeadLawyer = membership.matter.lead_lawyer_id === scope.actorLawyerId;
  const isPartner = membership.lawyer.role === "Partner";
  const isMatterMember = Boolean(membership.membership) || isLeadLawyer || overrideAllowed;

  if (overrideScreened) {
    throw new Error("Access denied: this lawyer is screened from the matter by an ethical wall.");
  }

  if (!isMatterMember) {
    throw new Error("The acting lawyer is not assigned to this matter.");
  }

  if (
    membership.matter.security_classification === "Partner-only" &&
    !isLeadLawyer &&
    !isPartner &&
    !overrideAllowed
  ) {
    throw new Error("Access denied: this matter is restricted to partners, the lead lawyer, or explicitly approved access.");
  }

  if (allowAnyMember && !permission) {
    return scope;
  }

  const roleBasedDefaults = defaultPermissionsByRole[membership.lawyer.role ?? ""] ?? [];
  const customPermissions =
    membership.membership?.firm_role_id ? await loadFirmRolePermissions(membership.membership.firm_role_id) : [];
  const effectivePermissions = uniquePermissions([...roleBasedDefaults, ...customPermissions]);

  if (permission && !effectivePermissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission} is required for this action.`);
  }

  return scope;
}

export async function assertFirmPermission(input: {
  scope: RequestScope;
  permission: PermissionKey;
}) {
  const { scope, permission } = input;

  if (scope.source === "prototype-demo" && isDemoModeEnabled()) {
    return scope;
  }

  if (!scope.actorLawyerId) {
    throw new Error(onboardingMessage);
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return scope;
  }

  const lawyerResult = await supabase
    .from("lawyers")
    .select("id,firm_id,role")
    .eq("id", scope.actorLawyerId)
    .maybeSingle();

  if (lawyerResult.error) {
    throw new Error(lawyerResult.error.message);
  }

  if (!lawyerResult.data) {
    throw new Error("Unable to resolve the acting lawyer.");
  }

  const defaultPermissions = defaultPermissionsByRole[lawyerResult.data.role ?? ""] ?? [];

  if (!defaultPermissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission} is required for this action.`);
  }

  return scope;
}
