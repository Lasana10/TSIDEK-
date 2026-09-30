-- Intelligent document intake, supplier payables and governed external review.
-- Adds evidence-first financial intake without merging Business and Finance domains.

alter table public.firm_operational_obligations
  add column if not exists supplier_id uuid references public.firm_suppliers(id) on delete set null,
  add column if not exists source_kind text not null default 'manual',
  add column if not exists evidence_requirements jsonb not null default '[]'::jsonb,
  add column if not exists approval_status text not null default 'not_required';

do $$ begin
  alter table public.firm_operational_obligations
    add constraint firm_operational_obligations_source_kind_check
    check (source_kind in ('manual','supplier_bill','contract','regulatory','subscription','system'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.firm_operational_obligations
    add constraint firm_operational_obligations_approval_status_check
    check (approval_status in ('not_required','pending','approved','rejected'));
exception when duplicate_object then null; end $$;

create table if not exists public.firm_document_intake_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  supplier_id uuid references public.firm_suppliers(id) on delete set null,
  expense_id uuid references public.firm_expenses(id) on delete set null,
  source_kind text not null default 'upload' check (source_kind in ('upload','email','external_api','workroom','mobile_scan')),
  original_name text not null,
  storage_provider text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  document_kind text not null default 'other' check (document_kind in ('invoice','receipt','quotation','payment_proof','tax_document','registration','contract','statement','other')),
  counterparty_name text,
  document_number text,
  currency text,
  amount numeric,
  tax_amount numeric,
  document_date date,
  due_date date,
  description text,
  extraction_provider text,
  extraction_model text,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  extraction_data jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending' check (review_status in ('pending','extracted','needs_review','approved','rejected','posted')),
  proposed_action text not null default 'review' check (proposed_action in ('review','create_supplier_bill','create_expense','attach_to_matter','archive')),
  reviewed_by uuid references public.lawyers(id) on delete set null,
  reviewed_at timestamptz,
  posted_at timestamptz,
  created_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists firm_document_intake_checksum_unique
  on public.firm_document_intake_items(firm_id, checksum)
  where checksum is not null;
create index if not exists firm_document_intake_queue_idx
  on public.firm_document_intake_items(firm_id, review_status, created_at desc);
create index if not exists firm_document_intake_matter_idx
  on public.firm_document_intake_items(matter_id, created_at desc);
create index if not exists firm_document_intake_supplier_idx
  on public.firm_document_intake_items(supplier_id, created_at desc);

alter table public.firm_document_intake_items enable row level security;
revoke all on public.firm_document_intake_items from anon;
grant select, insert, update on public.firm_document_intake_items to authenticated;
drop policy if exists "firm_document_intake_read" on public.firm_document_intake_items;
create policy "firm_document_intake_read" on public.firm_document_intake_items
for select to authenticated
using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "firm_document_intake_insert" on public.firm_document_intake_items;
create policy "firm_document_intake_insert" on public.firm_document_intake_items
for insert to authenticated
with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "firm_document_intake_update" on public.firm_document_intake_items;
create policy "firm_document_intake_update" on public.firm_document_intake_items
for update to authenticated
using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)))
with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

create table if not exists public.firm_supplier_bills (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  supplier_id uuid references public.firm_suppliers(id) on delete set null,
  matter_id uuid references public.matters(id) on delete set null,
  source_intake_id uuid references public.firm_document_intake_items(id) on delete set null,
  obligation_id uuid references public.firm_operational_obligations(id) on delete set null,
  expense_id uuid references public.firm_expenses(id) on delete set null,
  bill_number text,
  description text not null,
  currency text not null default 'XAF',
  subtotal numeric,
  tax_amount numeric,
  total_amount numeric not null check (total_amount >= 0),
  issued_at date,
  due_at date,
  status text not null default 'draft' check (status in ('draft','review','approved','due','paid','rejected','void')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','not_required')),
  paid_at timestamptz,
  created_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists firm_supplier_bills_queue_idx on public.firm_supplier_bills(firm_id,status,due_at);
create index if not exists firm_supplier_bills_supplier_idx on public.firm_supplier_bills(supplier_id,created_at desc);
create index if not exists firm_supplier_bills_matter_idx on public.firm_supplier_bills(matter_id,created_at desc);

alter table public.firm_supplier_bills enable row level security;
revoke all on public.firm_supplier_bills from anon;
grant select,insert,update on public.firm_supplier_bills to authenticated;
drop policy if exists "firm_supplier_bills_read" on public.firm_supplier_bills;
create policy "firm_supplier_bills_read" on public.firm_supplier_bills
for select to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "firm_supplier_bills_insert" on public.firm_supplier_bills;
create policy "firm_supplier_bills_insert" on public.firm_supplier_bills
for insert to authenticated with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "firm_supplier_bills_update" on public.firm_supplier_bills;
create policy "firm_supplier_bills_update" on public.firm_supplier_bills
for update to authenticated
using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)))
with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

alter table public.firm_document_intake_items
  add column if not exists supplier_bill_id uuid references public.firm_supplier_bills(id) on delete set null;

create table if not exists public.workroom_external_reviews (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  thread_id uuid not null references public.workroom_threads(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  token_hash text not null unique,
  reviewer_label text,
  reviewer_email text,
  access_scope text not null default 'thread_summary' check (access_scope in ('thread_summary','selected_messages','document_review')),
  allow_comment boolean not null default true,
  allow_upload boolean not null default false,
  allow_ai_review boolean not null default false,
  selected_message_ids jsonb not null default '[]'::jsonb,
  title text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists workroom_external_reviews_thread_idx on public.workroom_external_reviews(thread_id,created_at desc);
create index if not exists workroom_external_reviews_firm_idx on public.workroom_external_reviews(firm_id,expires_at);

alter table public.workroom_external_reviews enable row level security;
revoke all on public.workroom_external_reviews from anon;
grant select,insert,update on public.workroom_external_reviews to authenticated;
drop policy if exists "workroom_external_reviews_read" on public.workroom_external_reviews;
create policy "workroom_external_reviews_read" on public.workroom_external_reviews
for select to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "workroom_external_reviews_insert" on public.workroom_external_reviews;
create policy "workroom_external_reviews_insert" on public.workroom_external_reviews
for insert to authenticated with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "workroom_external_reviews_update" on public.workroom_external_reviews;
create policy "workroom_external_reviews_update" on public.workroom_external_reviews
for update to authenticated
using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)))
with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

create table if not exists public.workroom_external_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.workroom_external_reviews(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  thread_id uuid not null references public.workroom_threads(id) on delete cascade,
  event_type text not null check (event_type in ('opened','comment','ai_review_requested','ai_review_completed','upload')),
  author_label text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workroom_external_review_events_review_idx on public.workroom_external_review_events(review_id,created_at);
alter table public.workroom_external_review_events enable row level security;
revoke all on public.workroom_external_review_events from anon;
grant select on public.workroom_external_review_events to authenticated;
drop policy if exists "workroom_external_review_events_read" on public.workroom_external_review_events;
create policy "workroom_external_review_events_read" on public.workroom_external_review_events
for select to authenticated using (firm_id = public.current_firm_id());

create index if not exists firm_operational_obligations_supplier_idx on public.firm_operational_obligations(supplier_id,due_at);
