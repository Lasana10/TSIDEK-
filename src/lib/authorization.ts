import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";

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

  const [memberResult, lawyerResult, matterResult] = await Promise.all([
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
      .select("id,firm_id,lead_lawyer_id")
      .eq("id", input.matterId)
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

  return {
    membership: memberResult.data,
    lawyer: lawyerResult.data,
    matter: matterResult.data,
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

  if (scope.source === "prototype-demo") {
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

  const isLeadLawyer = membership.matter.lead_lawyer_id === scope.actorLawyerId;
  const isMatterMember = Boolean(membership.membership) || isLeadLawyer;

  if (!isMatterMember) {
    throw new Error("The acting lawyer is not assigned to this matter.");
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

  if (scope.source === "prototype-demo") {
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
