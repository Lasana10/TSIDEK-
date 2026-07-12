import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-config";

export function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
