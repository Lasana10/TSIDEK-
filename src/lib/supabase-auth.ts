import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseBrowserConfigReady } from "@/lib/supabase-config";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { defaultFirmCountry, firmRoleOptions, type FirmRole } from "@/lib/firm-identity";

export function isSupabaseAuthConfigured() {
  return isSupabaseBrowserConfigReady();
}

export async function createServerAuthClient() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return null;
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components can read the session without mutating cookies.
        }
      },
    },
  });
}

export async function getLawyerProfileByUserId(userId: string) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const existing = await supabase
    .from("lawyers")
    .select("id,firm_id,full_name,role")
    .eq("id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  return existing.data ?? null;
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

  if (!supabase) {
    return null;
  }

  const role = firmRoleOptions.includes(input.role) ? input.role : "Junior Associate";
  const fullName = input.fullName.trim();
  const firmName = input.firmName.trim();
  const country = input.country?.trim() || defaultFirmCountry;

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!firmName) {
    throw new Error("Firm name is required.");
  }

  const existingProfile = await getLawyerProfileByUserId(input.userId);

  if (existingProfile) {
    return existingProfile;
  }

  const firmResult = await supabase
    .from("firms")
    .insert({
      name: firmName,
      country,
    })
    .select("id")
    .single();

  if (firmResult.error || !firmResult.data) {
    throw new Error(firmResult.error?.message ?? "Unable to create the firm profile.");
  }

  const created = await supabase
    .from("lawyers")
    .insert({
      id: input.userId,
      firm_id: firmResult.data.id,
      full_name: fullName,
      role,
    })
    .select("id,firm_id,full_name,role")
    .single();

  if (created.error || !created.data) {
    throw new Error(created.error?.message ?? "Unable to create the lawyer profile.");
  }

  return created.data;
}

export async function getAuthenticatedUser() {
  const supabase = await createServerAuthClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    return null;
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const lawyer = await getLawyerProfileByUserId(user.id);

  return {
    user,
    lawyer,
  };
}
