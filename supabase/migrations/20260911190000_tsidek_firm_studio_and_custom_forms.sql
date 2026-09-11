create table if not exists public.firm_brand_profiles (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  display_name text not null,
  legal_name text,
  short_name text,
  motto text,
  logo_url text,
  logo_mark_url text,
  favicon_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#7C3AED',
  accent_color text not null default '#F59E0B',
  background_color text not null default '#F8FAFC',
  surface_color text not null default '#FFFFFF',
  text_color text not null default '#0F172A',
  font_heading text not null default 'Inter',
  font_body text not null default 'Inter',
  document_header_html text,
  document_footer_html text,
  letterhead_asset_url text,
  email_signature_html text,
  default_language text not null default 'en' check (default_language in ('en','fr','bilingual')),
  locale text not null default 'en-CM',
  timezone text not null default 'Africa/Douala',
  date_format text not null default 'dd/MM/yyyy',
  currency text not null default 'XAF',
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firm_form_definitions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  form_key text not null,
  name text not null,
  description text,
  module text not null default 'general',
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  schema jsonb not null default '{"fields":[]}'::jsonb,
  ui_schema jsonb not null default '{}'::jsonb,
  workflow jsonb not null default '{}'::jsonb,
  access_roles text[] not null default '{}',
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, form_key, version)
);

create table if not exists public.firm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  form_definition_id uuid not null references public.firm_form_definitions(id) on delete restrict,
  matter_id uuid references public.matters(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  submitted_by uuid references public.lawyers(id),
  status text not null default 'submitted' check (status in ('draft','submitted','under_review','approved','rejected')),
  data jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references public.lawyers(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.firm_brand_profiles enable row level security;
alter table public.firm_form_definitions enable row level security;
alter table public.firm_form_submissions enable row level security;

revoke all on public.firm_brand_profiles, public.firm_form_definitions, public.firm_form_submissions from anon;
grant select, insert, update, delete on public.firm_brand_profiles, public.firm_form_definitions, public.firm_form_submissions to authenticated;

create policy "brand_read_member" on public.firm_brand_profiles for select to authenticated using (tsidek_private.is_active_member(firm_id));
create policy "brand_write_governor" on public.firm_brand_profiles for all to authenticated using (tsidek_private.is_firm_governor(firm_id)) with check (tsidek_private.is_firm_governor(firm_id));
create policy "forms_read_member" on public.firm_form_definitions for select to authenticated using (tsidek_private.is_active_member(firm_id));
create policy "forms_write_governor" on public.firm_form_definitions for all to authenticated using (tsidek_private.is_firm_governor(firm_id)) with check (tsidek_private.is_firm_governor(firm_id));
create policy "submissions_read_member" on public.firm_form_submissions for select to authenticated using (tsidek_private.is_active_member(firm_id) and (matter_id is null or public.can_access_matter(matter_id)));
create policy "submissions_insert_member" on public.firm_form_submissions for insert to authenticated with check (tsidek_private.is_active_member(firm_id) and firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy "submissions_update_member" on public.firm_form_submissions for update to authenticated using (tsidek_private.is_active_member(firm_id) and (matter_id is null or public.can_access_matter(matter_id))) with check (tsidek_private.is_active_member(firm_id) and firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

create index if not exists idx_firm_form_definitions_firm_module on public.firm_form_definitions(firm_id,module,status);
create index if not exists idx_firm_form_submissions_firm_matter on public.firm_form_submissions(firm_id,matter_id,created_at desc);
create index if not exists idx_firm_form_submissions_prospect on public.firm_form_submissions(prospect_id) where prospect_id is not null;

insert into public.firm_brand_profiles (firm_id, display_name, legal_name, short_name)
select id, name, name, name from public.firms
on conflict (firm_id) do nothing;
