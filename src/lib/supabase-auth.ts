import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserUrl, getSupabasePublishableKey, isSupabaseBrowserConfigReady } from "@/lib/supabase-config";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { defaultFirmCountry, firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

export function isSupabaseAuthConfigured() {
  return isSupabaseBrowserConfigReady();
}

export async function createServerAuthClient() {
  if (!isSupabaseAuthConfigured()) return null;
  const cookieStore = await cookies();
  const url = getSupabaseBrowserUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components may read sessions without mutating cookies.
        }
      },
    },
  });
}

export async function getLawyerProfileByUserId(userId: string, authenticatedClient?: SupabaseClient) {
  const supabase = authenticatedClient ?? createServerSupabaseClient();
  if (!supabase) return null;

  const existing = await supabase
    .from("lawyers")
    .select("id,firm_id,full_name,role")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  return existing.data ?? null;
}

export async function getFirmContextByUserId(userId: string, authenticatedClient?: SupabaseClient) {
  const supabase = authenticatedClient ?? createServerSupabaseClient();
  if (!supabase) return { membership: null, memberships: [] as Array<Record<string, unknown>>, activeFirmId: null };

  const [membershipsResult, contextResult] = await Promise.all([
    supabase
      .from("firm_memberships")
      .select("id,firm_id,user_id,role_key,title,status,is_primary,created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("user_firm_context").select("active_firm_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (membershipsResult.error) throw new Error(membershipsResult.error.message);
  if (contextResult.error) throw new Error(contextResult.error.message);

  const memberships = membershipsResult.data ?? [];
  const requestedActive = contextResult.data?.active_firm_id ?? null;
  const membership = memberships.find((item) => item.firm_id === requestedActive) ?? memberships[0] ?? null;
  const activeFirmId = membership?.firm_id ?? null;

  if (activeFirmId && requestedActive !== activeFirmId) {
    const repaired = await supabase
      .from("user_firm_context")
      .upsert({ user_id: userId, active_firm_id: activeFirmId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (repaired.error) throw new Error(repaired.error.message);
  }

  return { membership, memberships, activeFirmId };
}

export async function setActiveFirmForUser(userId: string, firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server client is unavailable.");

  const membership = await supabase
    .from("firm_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("firm_id", firmId)
    .eq("status", "active")
    .maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  if (!membership.data) throw new Error("You are not an active member of that firm.");

  const updated = await supabase
    .from("user_firm_context")
    .upsert({ user_id: userId, active_firm_id: firmId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (updated.error) throw new Error(updated.error.message);
}

export async function completeUserOnboarding(input: {
  userId: string;
  email?: string | null;
  fullName: string;
  firmName: string;
  country?: string | null;
  role: FirmRole;
}) {
  const supabase = await createServerAuthClient();
  if (!supabase) throw new Error("Supabase authentication is unavailable.");

  const role = firmRoleOptions.includes(input.role) ? input.role : "Junior Associate";
  const fullName = input.fullName.trim();
  const firmName = input.firmName.trim();
  const country = input.country?.trim() || defaultFirmCountry;
  if (!fullName) throw new Error("Full name is required.");
  if (!firmName) throw new Error("Firm name is required.");

  const result = await supabase.rpc("bootstrap_firm_workspace", {
    p_full_name: fullName,
    p_firm_name: firmName,
    p_country: country,
    p_role: role,
  });
  if (result.error) throw new Error(result.error.message);
  return getLawyerProfileByUserId(input.userId, supabase);
}

export async function getAuthenticatedUser() {
  const supabase = await createServerAuthClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) return null;

  const [lawyer, firmContext] = await Promise.all([
    getLawyerProfileByUserId(user.id, supabase),
    getFirmContextByUserId(user.id, supabase),
  ]);

  return {
    user,
    lawyer,
    membership: firmContext.membership,
    memberships: firmContext.memberships,
    activeFirmId: firmContext.activeFirmId,
  };
}
