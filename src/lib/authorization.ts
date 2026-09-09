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
  | "exportAudit"
  | "manageFirm"
  | "manageEthicalWalls"
  | "manageClientAccess"
  | "approveAIWork";

const rolePermissions: Record<string, PermissionKey[]> = {
  owner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork"],
  partner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork"],
  administrator: ["openMatters","assignWork","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess"],
  lawyer: ["openMatters","assignWork","viewBilling","manageEvidence","editDeadlines","manageClientAccess"],
  paralegal: ["manageEvidence","editDeadlines"],
  intern: ["manageEvidence"],
  finance: ["viewBilling"],
  clerk: ["manageEvidence","editDeadlines"],
  knowledge_manager: ["manageEvidence","approveAIWork"],
  Partner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork"],
  "Senior Associate": ["openMatters","assignWork","manageEvidence","editDeadlines","viewBilling","manageClientAccess"],
  "Junior Associate": ["openMatters","manageEvidence","editDeadlines"],
  Lawyer: ["openMatters","assignWork","manageEvidence","editDeadlines","viewBilling","manageClientAccess"],
  Paralegal: ["manageEvidence","editDeadlines"],
  Intern: ["manageEvidence"],
  "Project Manager": ["assignWork","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm"],
};

const onboardingMessage = "Complete onboarding before using TSIDEK.";

async function loadActorMatterState(input: { matterId: string; actorLawyerId: string }) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const [memberResult, lawyerResult, matterResult, accessOverrideResult, firmMembershipResult] = await Promise.all([
    supabase.from("matter_members").select("lawyer_id,firm_role_id,is_primary").eq("matter_id", input.matterId).eq("lawyer_id", input.actorLawyerId).maybeSingle(),
    supabase.from("lawyers").select("id,firm_id,role").eq("id", input.actorLawyerId).maybeSingle(),
    supabase.from("matters").select("id,firm_id,lead_lawyer_id,confidentiality_level").eq("id", input.matterId).maybeSingle(),
    supabase.from("matter_access_overrides").select("access_type,reason,expires_at").eq("matter_id", input.matterId).eq("lawyer_id", input.actorLawyerId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("firm_memberships").select("firm_id,role_key,status").eq("user_id", input.actorLawyerId).eq("status", "active"),
  ]);

  for (const result of [memberResult, lawyerResult, matterResult, accessOverrideResult, firmMembershipResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const matter = matterResult.data;
  const activeFirmMembership = (firmMembershipResult.data ?? []).find((item) => item.firm_id === matter?.firm_id) ?? null;

  return {
    membership: memberResult.data,
    lawyer: lawyerResult.data,
    matter,
    accessOverride: accessOverrideResult.data as { access_type: "allow" | "deny"; reason: string; expires_at: string | null } | null,
    firmMembership: activeFirmMembership,
  };
}

function permissionsFor(state: { lawyer?: { role?: string | null } | null; firmMembership?: { role_key?: string | null } | null }) {
  const membershipRole = state.firmMembership?.role_key ?? "";
  const legacyRole = state.lawyer?.role ?? "";
  return new Set<PermissionKey>([...(rolePermissions[membershipRole] ?? []), ...(rolePermissions[legacyRole] ?? [])]);
}

export async function assertMatterPermission(input: {
  scope: RequestScope;
  matterId: string;
  permission?: PermissionKey;
  allowAnyMember?: boolean;
}) {
  const { scope, matterId, permission, allowAnyMember } = input;

  if (scope.source === "prototype-demo" && isDemoModeEnabled()) return scope;
  if (!scope.actorLawyerId) throw new Error(onboardingMessage);

  const state = await loadActorMatterState({ matterId, actorLawyerId: scope.actorLawyerId });
  if (!state?.matter || !state.lawyer) throw new Error("Unable to resolve the acting lawyer or matter scope.");
  if (!state.firmMembership && state.lawyer.firm_id !== state.matter.firm_id) throw new Error("Matter access denied for the current firm scope.");
  if (scope.firmId && state.matter.firm_id !== scope.firmId) throw new Error("Matter access denied for the active firm.");

  const explicitDeny = state.accessOverride?.access_type === "deny";
  const explicitAllow = state.accessOverride?.access_type === "allow";
  const isLead = state.matter.lead_lawyer_id === scope.actorLawyerId;
  const isMember = Boolean(state.membership) || isLead || explicitAllow;

  if (explicitDeny) throw new Error("Access denied: this lawyer is screened from the matter by an ethical wall.");
  if (!isMember) throw new Error("The acting lawyer is not assigned to this matter.");

  const level = String(state.matter.confidentiality_level ?? "").toLowerCase();
  const governor = ["owner", "partner", "administrator"].includes(state.firmMembership?.role_key ?? "") || state.lawyer.role === "Partner";
  if ((level === "partner-only" || level === "restricted") && !isLead && !governor && !explicitAllow) {
    throw new Error("Access denied: this restricted matter requires lead, partner/governor, or explicit access.");
  }

  if (allowAnyMember && !permission) return scope;

  const effectivePermissions = permissionsFor(state);
  if (permission && !effectivePermissions.has(permission)) {
    throw new Error(`Permission denied: ${permission} is required for this action.`);
  }

  return scope;
}

export async function assertFirmPermission(input: { scope: RequestScope; permission: PermissionKey }) {
  const { scope, permission } = input;
  if (scope.source === "prototype-demo" && isDemoModeEnabled()) return scope;
  if (!scope.actorLawyerId || !scope.firmId) throw new Error(onboardingMessage);

  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");

  const [lawyerResult, membershipResult] = await Promise.all([
    supabase.from("lawyers").select("id,firm_id,role").eq("id", scope.actorLawyerId).maybeSingle(),
    supabase.from("firm_memberships").select("firm_id,role_key,status").eq("user_id", scope.actorLawyerId).eq("firm_id", scope.firmId).eq("status", "active").maybeSingle(),
  ]);
  if (lawyerResult.error) throw new Error(lawyerResult.error.message);
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!lawyerResult.data) throw new Error("Unable to resolve the acting lawyer.");
  if (!membershipResult.data && lawyerResult.data.firm_id !== scope.firmId) throw new Error("Firm access denied.");

  const effectivePermissions = permissionsFor({ lawyer: lawyerResult.data, firmMembership: membershipResult.data });
  if (!effectivePermissions.has(permission)) throw new Error(`Permission denied: ${permission} is required for this action.`);
  return scope;
}
