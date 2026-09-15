export function getSupabaseBrowserUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function getSupabaseUrl() {
  // NEXT_PUBLIC_SUPABASE_URL is the canonical project identity for the app.
  // Server/service clients must use the same project as browser authentication;
  // otherwise an authenticated user can be looked up in a different database.
  return getSupabaseBrowserUrl() ?? process.env.SUPABASE_URL ?? null;
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    null
  );
}

export function getSupabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
}

export function isSupabaseBrowserConfigReady() {
  return Boolean(getSupabaseBrowserUrl() && getSupabasePublishableKey());
}
