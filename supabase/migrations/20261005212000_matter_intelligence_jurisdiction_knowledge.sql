create table if not exists public.matter_legal_claims (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  claim_type text not null check (claim_type in ('fact','issue','law','authority','evidence','analysis','option','recommendation')),
  statement text not null,
  source_kind text not null default 'matter_record',
  source_reference text,
  jurisdiction text,
  confidence numeric(4,3),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','corroborated','verified','disputed','superseded')),
  verified_by uuid references public.lawyers(id) on delete set null,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jurisdiction_packs (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_key text not null,
  country_code text,
  system_label text not null,
  version text not null default '1',
  status text not null default 'draft' check (status in ('draft','reviewed','active','retired')),
  coverage jsonb not null default '{}'::jsonb,
  source_register jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.lawyers(id) on delete set null,
  reviewed_at timestamptz,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(jurisdiction_key,version)
);

create table if not exists public.matter_communication_ingest (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','sms','call','meeting','portal','internal','other')),
  direction text not null default 'inbound' check (direction in ('inbound','outbound','internal')),
  external_id text,
  sender text,
  recipients jsonb not null default '[]'::jsonb,
  subject text,
  body_text text,
  occurred_at timestamptz not null default now(),
  instruction_candidate boolean not null default false,
  evidence_candidate boolean not null default false,
  processing_status text not null default 'recorded' check (processing_status in ('recorded','review_required','promoted','ignored')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.firm_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  source_matter_id uuid references public.matters(id) on delete set null,
  source_outcome_id uuid references public.matter_outcomes(id) on delete set null,
  knowledge_type text not null default 'practice_lesson',
  title text not null,
  summary text not null,
  practice_area text,
  jurisdiction text,
  confidentiality text not null default 'internal' check (confidentiality in ('internal','restricted','anonymised')),
  status text not null default 'draft' check (status in ('draft','reviewed','approved','retired')),
  approved_by uuid references public.lawyers(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matter_legal_claims_matter on public.matter_legal_claims(matter_id,claim_type,verification_status);
create index if not exists idx_matter_communication_ingest_matter on public.matter_communication_ingest(matter_id,occurred_at desc);
create index if not exists idx_firm_knowledge_entries_firm on public.firm_knowledge_entries(firm_id,status,practice_area,jurisdiction);
create index if not exists idx_jurisdiction_packs_key on public.jurisdiction_packs(jurisdiction_key,status);

alter table public.matter_legal_claims enable row level security;
alter table public.matter_communication_ingest enable row level security;
alter table public.firm_knowledge_entries enable row level security;
alter table public.jurisdiction_packs enable row level security;

revoke all on public.matter_legal_claims, public.matter_communication_ingest, public.firm_knowledge_entries, public.jurisdiction_packs from anon;
grant select,insert,update,delete on public.matter_legal_claims, public.matter_communication_ingest, public.firm_knowledge_entries to authenticated;
grant select on public.jurisdiction_packs to authenticated;

drop policy if exists matter_legal_claims_access on public.matter_legal_claims;
create policy matter_legal_claims_access on public.matter_legal_claims for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_communication_ingest_access on public.matter_communication_ingest;
create policy matter_communication_ingest_access on public.matter_communication_ingest for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists firm_knowledge_entries_access on public.firm_knowledge_entries;
create policy firm_knowledge_entries_access on public.firm_knowledge_entries for all to authenticated
using (firm_id=tsidek_private.current_firm_id())
with check (firm_id=tsidek_private.current_firm_id());

drop policy if exists jurisdiction_packs_read on public.jurisdiction_packs;
create policy jurisdiction_packs_read on public.jurisdiction_packs for select to authenticated using (status='active');