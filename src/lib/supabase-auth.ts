import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseBrowserConfigReady } from "@/lib/supabase-config";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { defaultFirmCountry, firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

export function isSupabaseAuthConfigured() {
  return isSupabaseBrowserConfigReady();
}

export async function createServerAuthClient() {
  if (!isSupabaseAuthConfigured()) return null;
  const cookieStore = await cookies();
  const url = getSupabaseUrl();
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

export async function getLawyerProfileByUserId(userId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const existing = await supabase
    .from("lawyers")
    .select("id,firm_id,full_name,role")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  return existing.data ?? null;
}

export async function getFirmContextByUserId(userId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return { membership: null, memberships: [] as Array<Record<string, unknown>>, activeFirmId: null };

  const [membershipsResult, contextResult] = await Promise.all([
    supabase
      .from("firm_memberships")
      .select("id,firm_id,user_id,role_key,title,status,is_primary,created_at,firms(id,name,country)")
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

  return {
    membership,
    memberships,
    activeFirmId: membership?.firm_id ?? null,
  };
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
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const role = firmRoleOptions.includes(input.role) ? input.role : "Junior Associate";
  const fullName = input.fullName.trim();
  const firmName = input.firmName.trim();
  const country = input.country?.trim() || defaultFirmCountry;
  if (!fullName) throw new Error("Full name is required.");
  if (!firmName) throw new Error("Firm name is required.");

  const existingProfile = await getLawyerProfileByUserId(input.userId);
  if (existingProfile) {
    const existingContext = await getFirmContextByUserId(input.userId);
    if (!existingContext.membership) {
      const roleKey = role === "Partner" ? "partner" : role === "Paralegal" ? "paralegal" : role === "Intern" ? "intern" : role === "Project Manager" ? "administrator" : "lawyer";
      const membershipInsert = await supabase.from("firm_memberships").insert({
        firm_id: existingProfile.firm_id,
        user_id: input.userId,
        role_key: roleKey,
        title: existingProfile.role ?? role,
        status: "active",
        is_primary: true,
      });
      if (membershipInsert.error) throw new Error(membershipInsert.error.message);
      await setActiveFirmForUser(input.userId, existingProfile.firm_id);
    }
    return existingProfile;
  }

  const firmResult = await supabase.from("firms").insert({ name: firmName, country }).select("id").single();
  if (firmResult.error || !firmResult.data) throw new Error(firmResult.error?.message ?? "Unable to create the firm profile.");

  const created = await supabase.from("lawyers").insert({
    id: input.userId,
    firm_id: firmResult.data.id,
    full_name: fullName,
    role,
  }).select("id,firm_id,full_name,role").single();
  if (created.error || !created.data) throw new Error(created.error?.message ?? "Unable to create the lawyer profile.");

  const membershipResult = await supabase.from("firm_memberships").insert({
    firm_id: firmResult.data.id,
    user_id: input.userId,
    role_key: "owner",
    title: role,
    status: "active",
    is_primary: true,
  });
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  await setActiveFirmForUser(input.userId, firmResult.data.id);

  return created.data;
}

export async function getAuthenticatedUser() {
  const supabase = await createServerAuthClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) return null;

  const lawyer = await getLawyerProfileByUserId(user.id);
  const firmContext = await getFirmContextByUserId(user.id);

  return {
    user,
    lawyer,
    membership: firmContext.membership,
    memberships: firmContext.memberships,
    activeFirmId: firmContext.activeFirmId,
  };
}
