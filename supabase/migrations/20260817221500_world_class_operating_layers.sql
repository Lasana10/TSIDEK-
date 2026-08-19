create extension if not exists pgcrypto;

create table if not exists public.finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  entry_type text not null,
  source_table text,
  source_id text,
  amount_xaf bigint not null check (amount_xaf > 0),
  direction text not null check (direction in ('DEBIT','CREDIT')),
  account_bucket text not null default 'OPERATING'
    check (account_bucket in ('OPERATING','CLIENT_FUNDS','DISBURSEMENT','REVENUE','RECEIVABLE')),
  status text not null default 'POSTED'
    check (status in ('PENDING','POSTED','REVERSED')),
  description text,
  provider_reference text,
  created_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_entry_id uuid references public.finance_ledger_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists finance_ledger_matter_idx on public.finance_ledger_entries(matter_id,created_at);

create table if not exists public.legal_authorities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  jurisdiction text not null,
  authority_type text not null,
  title text not null,
  citation text,
  issuing_body text,
  decision_or_issue_date date,
  source_url text,
  source_storage_path text,
  official_source boolean not null default false,
  language text,
  checksum text,
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','SOURCE_CHECKED','LAWYER_VERIFIED','REJECTED')),
  verified_by uuid references public.lawyers(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.legal_propositions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  authority_id uuid references public.legal_authorities(id) on delete cascade,
  proposition text not null,
  pinpoint_reference text,
  confidence text not null default 'MEDIUM' check (confidence in ('LOW','MEDIUM','HIGH')),
  lawyer_verified boolean not null default false,
  verified_by uuid references public.lawyers(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.matter_authority_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  authority_id uuid not null references public.legal_authorities(id) on delete cascade,
  proposition_id uuid references public.legal_propositions(id) on delete set null,
  usage_type text not null default 'RESEARCH',
  relevance_note text,
  added_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_work_products (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  work_product_type text not null,
  title text not null,
  model_provider text,
  model_name text,
  prompt_hash text,
  source_authority_ids uuid[] not null default '{}',
  source_document_ids uuid[] not null default '{}',
  draft_storage_path text,
  output_hash text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','UNDER_REVIEW','APPROVED','REJECTED','ARCHIVED')),
  generated_by uuid references public.lawyers(id) on delete set null,
  reviewed_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  review_note text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.institutional_memory_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  memory_type text not null,
  title text not null,
  summary text not null,
  reusable_proposition text,
  outcome text,
  confidence text not null default 'MEDIUM' check (confidence in ('LOW','MEDIUM','HIGH')),
  sensitivity text not null default 'RESTRICTED'
    check (sensitivity in ('INTERNAL','RESTRICTED','TRAINING_SAFE')),
  approved boolean not null default false,
  proposed_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  proposed_at timestamptz not null default now(),
  approved_at timestamptz,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.client_portal_grants (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  client_email text not null,
  grant_status text not null default 'PENDING'
    check (grant_status in ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
  can_view_documents boolean not null default true,
  can_view_finance boolean not null default true,
  can_view_updates boolean not null default true,
  can_upload_documents boolean not null default false,
  granted_by uuid references public.lawyers(id) on delete set null,
  granted_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists client_portal_grant_unique on public.client_portal_grants(matter_id,client_email);

create table if not exists public.matter_closure_reviews (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null unique references public.matters(id) on delete cascade,
  outcome_summary text,
  client_outcome text,
  financial_reconciled boolean not null default false,
  obligations_resolved boolean not null default false,
  documents_archived boolean not null default false,
  client_notified boolean not null default false,
  knowledge_reviewed boolean not null default false,
  lessons_learned text,
  approved_by uuid references public.lawyers(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.finance_ledger_entries enable row level security;
alter table public.legal_authorities enable row level security;
alter table public.legal_propositions enable row level security;
alter table public.matter_authority_links enable row level security;
alter table public.ai_work_products enable row level security;
alter table public.institutional_memory_entries enable row level security;
alter table public.client_portal_grants enable row level security;
alter table public.matter_closure_reviews enable row level security;
