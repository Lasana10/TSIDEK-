-- Firm Control: profile -> recommendations -> adopted ways of working.
-- Recommendations never silently change firm policy.

create table if not exists public.firm_operating_profiles (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  practice_model text not null default 'general_practice',
  professional_count_band text not null default '1_4',
  practice_areas text[] not null default '{}',
  office_count integer not null default 1 check (office_count > 0),
  approval_model text not null default 'partner_review',
  billing_models text[] not null default '{}',
  client_types text[] not null default '{}',
  litigation_mix text not null default 'mixed',
  support_staff_model text not null default 'mixed',
  confidentiality_mode text not null default 'standard',
  profile_notes text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firm_operating_recommendations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  title text not null,
  description text,
  rationale text,
  source_kind text not null default 'profile' check (source_kind in ('profile','observed','manual')),
  suggested_configuration jsonb not null default '{}'::jsonb,
  status text not null default 'suggested' check (status in ('suggested','applied','modified','dismissed')),
  first_suggested_at timestamptz not null default now(),
  last_suggested_at timestamptz not null default now(),
  acted_at timestamptz,
  acted_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, recommendation_key)
);

create table if not exists public.firm_operating_rules (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  rule_key text not null,
  category text not null,
  title text not null,
  description text,
  configuration jsonb not null default '{}'::jsonb,
  source_recommendation_id uuid references public.firm_operating_recommendations(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  version integer not null default 1,
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, rule_key)
);

alter table public.firm_operating_profiles enable row level security;
alter table public.firm_operating_recommendations enable row level security;
alter table public.firm_operating_rules enable row level security;

revoke all on public.firm_operating_profiles, public.firm_operating_recommendations, public.firm_operating_rules from anon, authenticated;
grant select, insert, update, delete on public.firm_operating_profiles, public.firm_operating_recommendations, public.firm_operating_rules to authenticated;
grant select, insert, update, delete on public.firm_operating_profiles, public.firm_operating_recommendations, public.firm_operating_rules to service_role;

drop policy if exists "operating profile read member" on public.firm_operating_profiles;
create policy "operating profile read member"
on public.firm_operating_profiles for select to authenticated
using (tsidek_private.is_active_member(firm_id));

drop policy if exists "operating profile write governor" on public.firm_operating_profiles;
create policy "operating profile write governor"
on public.firm_operating_profiles for all to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "operating recommendations read member" on public.firm_operating_recommendations;
create policy "operating recommendations read member"
on public.firm_operating_recommendations for select to authenticated
using (tsidek_private.is_active_member(firm_id));

drop policy if exists "operating recommendations write governor" on public.firm_operating_recommendations;
create policy "operating recommendations write governor"
on public.firm_operating_recommendations for all to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "operating rules read member" on public.firm_operating_rules;
create policy "operating rules read member"
on public.firm_operating_rules for select to authenticated
using (tsidek_private.is_active_member(firm_id));

drop policy if exists "operating rules write governor" on public.firm_operating_rules;
create policy "operating rules write governor"
on public.firm_operating_rules for all to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));

create index if not exists idx_operating_recommendations_firm_status
  on public.firm_operating_recommendations(firm_id, status, category);
create index if not exists idx_operating_rules_firm_status
  on public.firm_operating_rules(firm_id, status, category);

insert into public.firm_operating_profiles (firm_id, created_by, updated_by)
select f.id, null, null
from public.firms f
on conflict (firm_id) do nothing;
