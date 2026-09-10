create extension if not exists vector with schema extensions;

alter table public.legal_authorities
  add column if not exists valid_from date,
  add column if not exists valid_until date,
  add column if not exists version_label text,
  add column if not exists provision_path text,
  add column if not exists canonical_uri text,
  add column if not exists supersedes_authority_id uuid references public.legal_authorities(id) on delete set null;

create table if not exists public.legal_source_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.firms(id) on delete cascade,
  source_scope text not null default 'firm' check (source_scope in ('firm','public')),
  publisher text not null,
  jurisdiction text not null,
  document_type text not null,
  title text not null,
  canonical_uri text,
  source_url text,
  language text not null default 'fr',
  version_label text,
  valid_from date,
  valid_until date,
  checksum text not null,
  ingestion_status text not null default 'pending' check (ingestion_status in ('pending','processing','ready','needs_review','failed')),
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_source_scope_firm_ck check ((source_scope='public' and firm_id is null) or (source_scope='firm' and firm_id is not null))
);

create unique index if not exists uq_legal_source_documents_checksum_scope on public.legal_source_documents(coalesce(firm_id,'00000000-0000-0000-0000-000000000000'::uuid), checksum);
create index if not exists idx_legal_source_documents_firm on public.legal_source_documents(firm_id, ingestion_status);
create index if not exists idx_legal_source_documents_jurisdiction on public.legal_source_documents(jurisdiction, document_type);

create table if not exists public.legal_source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.legal_source_documents(id) on delete cascade,
  firm_id uuid references public.firms(id) on delete cascade,
  authority_id uuid references public.legal_authorities(id) on delete set null,
  chunk_index integer not null check (chunk_index >= 0),
  section_path text,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('simple', coalesce(content,''))) stored,
  content_hash text not null,
  embedding extensions.vector(768),
  embedding_model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_document_id, chunk_index),
  unique(source_document_id, content_hash)
);
create index if not exists idx_legal_source_chunks_source on public.legal_source_chunks(source_document_id, chunk_index);
create index if not exists idx_legal_source_chunks_firm on public.legal_source_chunks(firm_id);
create index if not exists idx_legal_source_chunks_tsv on public.legal_source_chunks using gin(content_tsv);

create table if not exists public.ai_provider_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  task_type text not null,
  privacy_mode text not null default 'cloud_allowed' check (privacy_mode in ('local_only','hybrid','cloud_allowed')),
  status text not null check (status in ('started','succeeded','failed','blocked')),
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_minor_units integer,
  currency text default 'USD',
  request_hash text,
  response_hash text,
  source_document_ids uuid[] not null default '{}',
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_ai_provider_runs_firm_created on public.ai_provider_runs(firm_id, created_at desc);
create index if not exists idx_ai_provider_runs_matter on public.ai_provider_runs(matter_id, created_at desc) where matter_id is not null;

create table if not exists public.ai_quality_evaluations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  ai_work_product_id uuid references public.ai_work_products(id) on delete cascade,
  provider_run_id uuid references public.ai_provider_runs(id) on delete cascade,
  citation_support_score numeric(5,2),
  jurisdiction_score numeric(5,2),
  temporal_accuracy_score numeric(5,2),
  hallucination_risk_score numeric(5,2),
  bilingual_quality_score numeric(5,2),
  passed boolean not null default false,
  evaluator text not null,
  findings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_quality_evaluations_run on public.ai_quality_evaluations(provider_run_id);

create table if not exists public.domain_outbox_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','dead_letter')),
  idempotency_key text not null unique,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists idx_domain_outbox_dispatch on public.domain_outbox_events(status, available_at) where status in ('pending','failed');
create index if not exists idx_domain_outbox_matter on public.domain_outbox_events(matter_id, created_at desc) where matter_id is not null;

create table if not exists public.firm_runtime_profiles (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  storage_mode text not null default 'supabase' check (storage_mode in ('supabase','onedrive','nextcloud','local')),
  ai_privacy_mode text not null default 'hybrid' check (ai_privacy_mode in ('local_only','hybrid','cloud_allowed')),
  primary_cloud_provider text not null default 'gemini' check (primary_cloud_provider in ('gemini','openrouter','none')),
  local_ai_base_url text,
  nextcloud_base_url text,
  external_storage_enabled boolean not null default false,
  legal_research_public_corpus_enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.firm_runtime_profiles(firm_id)
select id from public.firms
on conflict (firm_id) do nothing;

alter table public.legal_source_documents enable row level security;
alter table public.legal_source_chunks enable row level security;
alter table public.ai_provider_runs enable row level security;
alter table public.ai_quality_evaluations enable row level security;
alter table public.domain_outbox_events enable row level security;
alter table public.firm_runtime_profiles enable row level security;

revoke all on public.legal_source_documents, public.legal_source_chunks, public.ai_provider_runs, public.ai_quality_evaluations, public.domain_outbox_events, public.firm_runtime_profiles from anon, authenticated;
grant select,insert,update on public.legal_source_documents to authenticated;
grant select,insert,update,delete on public.legal_source_chunks to authenticated;
grant select,insert,update on public.ai_provider_runs to authenticated;
grant select,insert on public.ai_quality_evaluations to authenticated;
grant select on public.domain_outbox_events to authenticated;
grant select,update on public.firm_runtime_profiles to authenticated;

create policy "read scoped legal source documents" on public.legal_source_documents for select to authenticated using (source_scope='public' or firm_id=tsidek_private.current_firm_id());
create policy "governors create firm legal sources" on public.legal_source_documents for insert to authenticated with check (source_scope='firm' and firm_id=tsidek_private.current_firm_id() and created_by=(select auth.uid()) and tsidek_private.is_firm_governor(firm_id));
create policy "governors update firm legal sources" on public.legal_source_documents for update to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id)) with check (firm_id=tsidek_private.current_firm_id() and source_scope='firm');
create policy "read scoped legal chunks" on public.legal_source_chunks for select to authenticated using (exists(select 1 from public.legal_source_documents d where d.id=source_document_id and (d.source_scope='public' or d.firm_id=tsidek_private.current_firm_id())));
create policy "governors create firm legal chunks" on public.legal_source_chunks for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id));
create policy "governors update firm legal chunks" on public.legal_source_chunks for update to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id)) with check (firm_id=tsidek_private.current_firm_id());
create policy "governors delete firm legal chunks" on public.legal_source_chunks for delete to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id));
create policy "authorized users read provider runs" on public.ai_provider_runs for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users create provider runs" on public.ai_provider_runs for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and actor_id=(select auth.uid()) and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users complete provider runs" on public.ai_provider_runs for update to authenticated using (firm_id=tsidek_private.current_firm_id() and actor_id=(select auth.uid())) with check (firm_id=tsidek_private.current_firm_id());
create policy "authorized users read ai quality" on public.ai_quality_evaluations for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users create ai quality" on public.ai_quality_evaluations for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users read matter outbox" on public.domain_outbox_events for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "firm members read runtime profile" on public.firm_runtime_profiles for select to authenticated using (firm_id=tsidek_private.current_firm_id());
create policy "governors update runtime profile" on public.firm_runtime_profiles for update to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id)) with check (firm_id=tsidek_private.current_firm_id());

create or replace function public.search_legal_source_chunks(search_query text, requested_firm_id uuid, match_count integer default 12)
returns table(chunk_id uuid, source_document_id uuid, authority_id uuid, title text, jurisdiction text, section_path text, content text, source_url text, canonical_uri text, rank real)
language sql security definer set search_path=''
as $$
  select c.id, c.source_document_id, c.authority_id, d.title, d.jurisdiction, c.section_path, c.content, d.source_url, d.canonical_uri,
         ts_rank_cd(c.content_tsv, websearch_to_tsquery('simple', search_query))::real as rank
  from public.legal_source_chunks c
  join public.legal_source_documents d on d.id=c.source_document_id
  where requested_firm_id=tsidek_private.current_firm_id()
    and (d.source_scope='public' or d.firm_id=requested_firm_id)
    and c.content_tsv @@ websearch_to_tsquery('simple', search_query)
  order by rank desc, c.chunk_index asc
  limit greatest(1, least(match_count, 50));
$$;
revoke all on function public.search_legal_source_chunks(text,uuid,integer) from public,anon;
grant execute on function public.search_legal_source_chunks(text,uuid,integer) to authenticated;

comment on table public.legal_source_documents is 'Source-preserving legal corpus registry for official/public and firm-controlled materials.';
comment on table public.domain_outbox_events is 'Durable transactional outbox for external communications, AI, storage and workflow side effects.';