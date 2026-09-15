create table if not exists public.firm_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  created_by uuid references public.lawyers(id) on delete set null,
  updated_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, provider)
);

alter table public.firm_integration_secrets enable row level security;
revoke all on table public.firm_integration_secrets from anon, authenticated;
create index if not exists firm_integration_secrets_firm_provider_idx
  on public.firm_integration_secrets(firm_id, provider);

create table if not exists public.firm_storage_profiles (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  provider text not null default 'secure_vault' check (provider in ('secure_vault','nextcloud','onedrive','local_private')),
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'configured' check (status in ('configured','verified','degraded','disabled','blocked')),
  last_verified_at timestamptz,
  last_error text,
  created_by uuid references public.lawyers(id) on delete set null,
  updated_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.firm_storage_profiles enable row level security;
revoke all on table public.firm_storage_profiles from anon;
grant select,insert,update,delete on table public.firm_storage_profiles to authenticated;
create policy firm_storage_profiles_read on public.firm_storage_profiles
for select to authenticated using (firm_id=public.current_firm_id());
create policy firm_storage_profiles_write on public.firm_storage_profiles
for all to authenticated using (firm_id=public.current_firm_id()) with check (firm_id=public.current_firm_id());
