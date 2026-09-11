create table if not exists public.matter_time_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  lawyer_id uuid not null references public.lawyers(id),
  activity_type text not null default 'legal_work',
  description text not null,
  started_at timestamptz,
  ended_at timestamptz,
  minutes integer not null check (minutes >= 0),
  hourly_rate_xaf numeric(14,2),
  billable boolean not null default true,
  billing_status text not null default 'unbilled' check (billing_status in ('unbilled','invoiced','written_off','non_billable')),
  invoice_id uuid references public.invoices(id) on delete set null,
  approved_by uuid references public.lawyers(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_docket_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  event_type text not null check (event_type in ('filing','hearing','service','meeting','order','judgment','appeal','deadline','other')),
  title text not null,
  description text,
  court_or_authority text,
  venue text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text not null default 'scheduled' check (status in ('draft','scheduled','completed','adjourned','cancelled','missed')),
  filing_reference text,
  outcome text,
  next_action text,
  responsible_lawyer_id uuid references public.lawyers(id),
  created_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_review_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  action text not null check (action in ('submitted_for_review','reviewed','changes_requested','approved','rejected','signed','filed','served','superseded')),
  notes text,
  actor_lawyer_id uuid references public.lawyers(id),
  version_label text,
  checksum text,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_reconciliation_reviews (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  period_start date,
  period_end date,
  expected_xaf bigint not null default 0,
  received_xaf bigint not null default 0,
  variance_xaf bigint generated always as (received_xaf - expected_xaf) stored,
  status text not null default 'open' check (status in ('open','matched','variance','approved','reopened')),
  notes text,
  source_summary jsonb not null default '{}'::jsonb,
  prepared_by uuid references public.lawyers(id),
  reviewed_by uuid references public.lawyers(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matter_time_entries enable row level security;
alter table public.matter_docket_events enable row level security;
alter table public.document_review_events enable row level security;
alter table public.finance_reconciliation_reviews enable row level security;

revoke all on public.matter_time_entries, public.matter_docket_events, public.document_review_events, public.finance_reconciliation_reviews from anon;
grant select, insert, update on public.matter_time_entries, public.matter_docket_events, public.finance_reconciliation_reviews to authenticated;
grant select, insert on public.document_review_events to authenticated;

create policy "time_select_matter" on public.matter_time_entries for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "time_insert_matter" on public.matter_time_entries for insert to authenticated with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "time_update_matter" on public.matter_time_entries for update to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id)) with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

create policy "docket_select_matter" on public.matter_docket_events for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "docket_insert_matter" on public.matter_docket_events for insert to authenticated with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "docket_update_matter" on public.matter_docket_events for update to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id)) with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

create policy "review_select_matter" on public.document_review_events for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "review_insert_matter" on public.document_review_events for insert to authenticated with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

create policy "recon_select_firm" on public.finance_reconciliation_reviews for select to authenticated using (firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy "recon_insert_governor" on public.finance_reconciliation_reviews for insert to authenticated with check (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id) and (matter_id is null or public.can_access_matter(matter_id)));
create policy "recon_update_governor" on public.finance_reconciliation_reviews for update to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id) and (matter_id is null or public.can_access_matter(matter_id))) with check (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id) and (matter_id is null or public.can_access_matter(matter_id)));

create index if not exists idx_time_entries_matter_created on public.matter_time_entries(matter_id, created_at desc);
create index if not exists idx_time_entries_lawyer_status on public.matter_time_entries(lawyer_id,billing_status,created_at desc);
create index if not exists idx_docket_matter_schedule on public.matter_docket_events(matter_id,scheduled_at);
create index if not exists idx_document_review_doc_created on public.document_review_events(document_id,created_at desc);
create index if not exists idx_reconciliation_firm_status on public.finance_reconciliation_reviews(firm_id,status,created_at desc);
