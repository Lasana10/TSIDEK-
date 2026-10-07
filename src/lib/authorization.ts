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
  | "approveAIWork"
  | "archiveMatters"
  | "requestMatterRemoval"
  | "approveMatterRemoval";

export type ProductModuleKey =
  | "identity_security" | "matters" | "documents" | "tasks_audit" | "firm_studio"
  | "intake" | "finance" | "workflows" | "interactions" | "law_bank" | "people"
  | "client_portal" | "digitisation" | "institutional_ai" | "integrations"
  | "advanced_reporting" | "multi_office" | "private_runtime";

const professionalRolePermissions: Record<string, PermissionKey[]> = {
  owner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval"],
  managing_partner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval"],
  partner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval"],
  administrator: ["openMatters","assignWork","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","archiveMatters"],
  lawyer: ["openMatters","assignWork","viewBilling","manageEvidence","editDeadlines","manageClientAccess"],
  senior_associate: ["openMatters","assignWork","manageEvidence","editDeadlines","viewBilling","manageClientAccess"],
  junior_associate: ["openMatters","manageEvidence","editDeadlines"],
  paralegal: ["manageEvidence","editDeadlines"],
  intern: ["manageEvidence"],
  finance: ["viewBilling"],
  clerk: ["manageEvidence","editDeadlines"],
  knowledge_manager: ["manageEvidence","approveAIWork"],
  Partner: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval"],
  "Managing Partner": ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval"],
  "Senior Associate": ["openMatters","assignWork","manageEvidence","editDeadlines","viewBilling","manageClientAccess"],
  "Junior Associate": ["openMatters","manageEvidence","editDeadlines"],
  Lawyer: ["openMatters","assignWork","manageEvidence","editDeadlines","viewBilling","manageClientAccess"],
  Paralegal: ["manageEvidence","editDeadlines"],
  Intern: ["manageEvidence"],
  "Project Manager": ["assignWork","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm"],
};

const governancePermissions: Record<string, PermissionKey[]> = {
  founder: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval","approveMatterRemoval"],
  firm_head: ["openMatters","assignWork","approveFilings","viewBilling","manageEvidence","editDeadlines","inviteCollaborators","exportAudit","manageFirm","manageEthicalWalls","manageClientAccess","approveAIWork","archiveMatters","requestMatterRemoval","approveMatterRemoval"],
  managing_partner: ["manageFirm","inviteCollaborators","exportAudit","manageEthicalWalls","archiveMatters","requestMatterRemoval"],
  administrator: ["manageFirm","inviteCollaborators","exportAudit","archiveMatters"],
  member: [],
};

const onboardingMessage = "Complete onboarding before using TSIDEK.";

type FirmMembership = { role_key?: string | null; governance_role_key?: string | null };

async function loadActorMatterState(input: { matterId: string; actorLawyerId: string }) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const [memberResult, lawyerResult, matterResult, accessOverrideResult, firmMembershipResult] = await Promise.all([
    supabase.from("matter_members").select("lawyer_id,firm_role_id,is_primary").eq("matter_id", input.matterId).eq("lawyer_id", input.actorLawyerId).maybeSingle(),
    supabase.from("lawyers").select("id,firm_id,role").eq("id", input.actorLawyerId).maybeSingle(),
    supabase.from("matters").select("id,firm_id,lead_lawyer_id,confidentiality_level").eq("id", input.matterId).maybeSingle(),
    supabase.from("matter_access_overrides").select("access_type,reason,expires_at").eq("matter_id", input.matterId).eq("lawyer_id", input.actorLawyerId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("firm_memberships").select("firm_id,role_key,governance_role_key,status").eq("user_id", input.actorLawyerId).eq("status", "active"),
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

function permissionsFor(state: { lawyer?: { role?: string | null } | null; firmMembership?: FirmMembership | null }) {
  const membershipRole = state.firmMembership?.role_key ?? "";
  const governanceRole = state.firmMembership?.governance_role_key ?? "member";
  const legacyRole = state.lawyer?.role ?? "";
  return new Set<PermissionKey>([
    ...(professionalRolePermissions[membershipRole] ?? []),
    ...(professionalRolePermissions[legacyRole] ?? []),
    ...(governancePermissions[governanceRole] ?? []),
  ]);
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
  const governor = ["founder", "firm_head", "managing_partner", "administrator"].includes(state.firmMembership?.governance_role_key ?? "") || ["owner", "managing_partner", "partner", "administrator"].includes(state.firmMembership?.role_key ?? "") || ["Partner", "Managing Partner"].includes(state.lawyer.role ?? "");
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
    supabase.from("firm_memberships").select("firm_id,role_key,governance_role_key,status").eq("user_id", scope.actorLawyerId).eq("firm_id", scope.firmId).eq("status", "active").maybeSingle(),
  ]);
  if (lawyerResult.error) throw new Error(lawyerResult.error.message);
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!lawyerResult.data) throw new Error("Unable to resolve the acting lawyer.");
  if (!membershipResult.data && lawyerResult.data.firm_id !== scope.firmId) throw new Error("Firm access denied.");

  const effectivePermissions = permissionsFor({ lawyer: lawyerResult.data, firmMembership: membershipResult.data });
  if (!effectivePermissions.has(permission)) throw new Error(`Permission denied: ${permission} is required for this action.`);
  return scope;
}

export async function assertFirmModule(input: { scope: RequestScope; module: ProductModuleKey }) {
  const { scope, module } = input;
  if (scope.source === "prototype-demo" && isDemoModeEnabled()) return scope;
  if (!scope.actorLawyerId || !scope.firmId) throw new Error(onboardingMessage);
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");

  const [subscriptionResult, overrideResult, moduleResult] = await Promise.all([
    supabase.from("firm_subscriptions").select("plan_key,status").eq("firm_id", scope.firmId).maybeSingle(),
    supabase.from("firm_module_overrides").select("enabled,expires_at").eq("firm_id", scope.firmId).eq("module_key", module).maybeSingle(),
    supabase.from("product_modules").select("name,core_security").eq("module_key", module).maybeSingle(),
  ]);
  for (const result of [subscriptionResult, overrideResult, moduleResult]) if (result.error) throw new Error(result.error.message);
  const override = overrideResult.data;
  const overrideActive = override && (!override.expires_at || new Date(override.expires_at).getTime() > Date.now());
  if (overrideActive) {
    if (override.enabled) return scope;
    throw new Error(`${moduleResult.data?.name || module} is not enabled for this firm.`);
  }
  if (moduleResult.data?.core_security) return scope;
  const subscription = subscriptionResult.data;
  if (!subscription || !["trial", "active"].includes(subscription.status)) throw new Error("The firm's TSIDK subscription is not active.");
  const included = await supabase.from("plan_modules").select("module_key")
    .eq("plan_key", subscription.plan_key).eq("module_key", module).maybeSingle();
  if (included.error) throw new Error(included.error.message);
  if (!included.data) throw new Error(`${moduleResult.data?.name || module} is not included in this firm's TSIDK edition.`);
  return scope;
}


export async function resolveFirmModules(scope: RequestScope) {
  if (!scope.firmId) return new Set<ProductModuleKey>();
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");

  const [subscriptionResult, overridesResult, modulesResult] = await Promise.all([
    supabase.from("firm_subscriptions").select("plan_key,status").eq("firm_id", scope.firmId).maybeSingle(),
    supabase.from("firm_module_overrides").select("module_key,enabled,expires_at").eq("firm_id", scope.firmId),
    supabase.from("product_modules").select("module_key,core_security").eq("active", true),
  ]);
  for (const result of [subscriptionResult, overridesResult, modulesResult]) if (result.error) throw new Error(result.error.message);

  const enabled = new Set<ProductModuleKey>();
  for (const productModule of modulesResult.data ?? []) if (productModule.core_security) enabled.add(productModule.module_key as ProductModuleKey);

  const subscription = subscriptionResult.data;
  if (subscription && ["trial","active"].includes(subscription.status)) {
    const planModules = await supabase.from("plan_modules").select("module_key").eq("plan_key", subscription.plan_key);
    if (planModules.error) throw new Error(planModules.error.message);
    for (const row of planModules.data ?? []) enabled.add(row.module_key as ProductModuleKey);
  }

  const now = Date.now();
  for (const override of overridesResult.data ?? []) {
    const active = !override.expires_at || new Date(override.expires_at).getTime() > now;
    if (!active) continue;
    const key = override.module_key as ProductModuleKey;
    if (override.enabled) enabled.add(key); else enabled.delete(key);
  }
  return enabled;
}
