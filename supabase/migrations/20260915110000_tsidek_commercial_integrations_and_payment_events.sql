create table if not exists public.firm_integration_connections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  provider text not null check (provider in ('nextcloud','onedrive','meta_whatsapp','firebase','resend','openrouter','pawapay','local_ai','transcription')),
  display_name text,
  status text not null default 'configured' check (status in ('configured','verified','degraded','disabled','blocked')),
  credential_mode text not null default 'platform_env' check (credential_mode in ('platform_env','firm_secret_ref','oauth','local_private')),
  credential_ref text,
  configuration jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  last_error text,
  created_by uuid references public.lawyers(id) on delete set null,
  updated_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, provider)
);

alter table public.firm_integration_connections enable row level security;
revoke all on table public.firm_integration_connections from anon;
grant select,insert,update,delete on table public.firm_integration_connections to authenticated;

create policy firm_integration_connections_read on public.firm_integration_connections
for select to authenticated using (firm_id=public.current_firm_id());
create policy firm_integration_connections_write on public.firm_integration_connections
for all to authenticated using (firm_id=public.current_firm_id()) with check (firm_id=public.current_firm_id());

create index if not exists firm_integration_connections_firm_status_idx
on public.firm_integration_connections(firm_id,status,provider);

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_key text not null,
  provider_reference text,
  firm_id uuid references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  payment_id uuid references public.matter_payments(id) on delete set null,
  event_status text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_key)
);

alter table public.payment_provider_events enable row level security;
revoke all on table public.payment_provider_events from anon, authenticated;
create index if not exists payment_provider_events_payment_idx on public.payment_provider_events(payment_id,created_at desc);
create index if not exists payment_provider_events_reference_idx on public.payment_provider_events(provider,provider_reference);

alter table public.matter_payments add column if not exists provider_status text;
alter table public.matter_payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table public.matter_payments add column if not exists requested_at timestamptz;
