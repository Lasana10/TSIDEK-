-- Align the production case-room runtime with the fields and governed records used by TSIDKENU.

alter table public.matters
  add column if not exists lifecycle_state text not null default 'OPEN';

do $$ begin
  alter table public.matters
    add constraint matters_lifecycle_state_check
    check (lifecycle_state in ('OPEN','STRATEGY','EXECUTION','REVIEW','CLOSING','CLOSED'));
exception when duplicate_object then null; end $$;

create table if not exists public.matter_obligations (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  title text not null,
  obligation_type text not null default 'deadline',
  source_type text,
  source_reference text,
  legal_basis text,
  due_at timestamptz,
  responsible_lawyer_id uuid references public.lawyers(id) on delete set null,
  consequence text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','SATISFIED','WAIVED','MISSED','CANCELLED')),
  completion_evidence jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.matter_approvals (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  approval_type text not null,
  subject_type text not null,
  subject_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  requested_by uuid references public.lawyers(id) on delete set null,
  decided_by uuid references public.lawyers(id) on delete set null
);

create table if not exists public.legal_document_records (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  existing_document_id uuid references public.documents(id) on delete set null,
  external_file_id text,
  title text not null,
  document_type text,
  authoritative_version integer not null default 1,
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','IN_REVIEW','APPROVED','ISSUED','FILED','SENT','SUPERSEDED','ARCHIVED')),
  security_classification text not null default 'Standard',
  client_visible boolean not null default false,
  provenance jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id) on delete set null,
  reviewed_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_communications (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  channel text not null,
  direction text not null default 'OUTBOUND' check (direction in ('INBOUND','OUTBOUND')),
  subject text,
  recipient_or_sender text,
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','IN_REVIEW','APPROVED','SENT','DELIVERED','ACKNOWLEDGED','REPLIED','FAILED')),
  substantive_legal_advice boolean not null default false,
  body_hash text,
  external_message_id text,
  drafted_by uuid references public.lawyers(id) on delete set null,
  reviewed_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  sent_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_matter_obligations_matter_due on public.matter_obligations(matter_id,due_at);
create index if not exists idx_matter_approvals_matter_status on public.matter_approvals(matter_id,status);
create index if not exists idx_legal_document_records_matter_state on public.legal_document_records(matter_id,lifecycle_state);
create index if not exists idx_matter_communications_matter_state on public.matter_communications(matter_id,lifecycle_state);

alter table public.matter_obligations enable row level security;
alter table public.matter_approvals enable row level security;
alter table public.legal_document_records enable row level security;
alter table public.matter_communications enable row level security;

revoke all on public.matter_obligations, public.matter_approvals, public.legal_document_records, public.matter_communications from anon;
grant select,insert,update,delete on public.matter_obligations, public.matter_approvals, public.legal_document_records, public.matter_communications to authenticated;

do $$ begin
  create policy "matter participants access obligations" on public.matter_obligations for all to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "matter participants access approvals" on public.matter_approvals for all to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "matter participants access legal documents" on public.legal_document_records for all to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "matter participants access communications" on public.matter_communications for all to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
exception when duplicate_object then null; end $$;

alter table public.documents add column if not exists document_status text;
update public.documents set document_status=status where document_status is null;
alter table public.documents alter column document_status set default 'Draft';

create or replace function public.tsidek_sync_document_status()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.document_status is null then new.document_status := coalesce(new.status,'Draft'); end if;
  if new.status is null or new.status is distinct from new.document_status then new.status := new.document_status; end if;
  return new;
end;
$$;

drop trigger if exists trg_tsidek_sync_document_status on public.documents;
create trigger trg_tsidek_sync_document_status before insert or update on public.documents for each row execute function public.tsidek_sync_document_status();

alter table public.matter_client_updates add column if not exists message text;
update public.matter_client_updates set message=body where message is null;
alter table public.matter_client_updates add column if not exists recipient text;
alter table public.matter_client_updates add column if not exists delivery_note text;
alter table public.matter_client_updates add column if not exists drafted_by uuid references public.lawyers(id) on delete set null;
alter table public.matter_client_updates add column if not exists dispatched_at timestamptz;
alter table public.matter_client_updates add column if not exists acknowledged_at timestamptz;
update public.matter_client_updates
set drafted_by=coalesce(drafted_by,created_by),
    dispatched_at=coalesce(dispatched_at,sent_at),
    acknowledged_at=coalesce(acknowledged_at,client_acknowledged_at)
where drafted_by is null or dispatched_at is null or acknowledged_at is null;
