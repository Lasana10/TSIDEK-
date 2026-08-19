-- TSIDEK Firm Backbone
-- Adds governed matter lifecycle, immutable event history, obligations,
-- communications evidence, legal document records and approvals.
-- Deliberately additive: existing prototype/display columns remain intact.

create extension if not exists pgcrypto;

alter table public.matters
  add column if not exists lifecycle_state text not null default 'OPEN';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matters_lifecycle_state_check'
  ) then
    alter table public.matters
      add constraint matters_lifecycle_state_check
      check (
        lifecycle_state in (
          'PROSPECT',
          'CONFLICT_REVIEW',
          'ENGAGEMENT',
          'OPEN',
          'ACTIVE',
          'WAITING_EXTERNAL',
          'CLOSING',
          'CLOSED',
          'ARCHIVED'
        )
      );
  end if;
end $$;

create table if not exists public.matter_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  event_type text not null,
  previous_state text,
  new_state text,
  actor_lawyer_id uuid references public.lawyers(id) on delete set null,
  actor_name text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists matter_events_matter_occurred_idx
  on public.matter_events(matter_id, occurred_at);

create index if not exists matter_events_firm_occurred_idx
  on public.matter_events(firm_id, occurred_at);

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
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','SATISFIED','WAIVED','MISSED','CANCELLED')),
  completion_evidence jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists matter_obligations_due_idx
  on public.matter_obligations(firm_id, status, due_at);

create table if not exists public.legal_document_records (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  external_file_id text,
  title text not null,
  document_type text,
  authoritative_version integer not null default 1,
  lifecycle_state text not null default 'DRAFT'
    check (lifecycle_state in ('DRAFT','IN_REVIEW','APPROVED','ISSUED','FILED','SENT','SUPERSEDED','ARCHIVED')),
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

create index if not exists legal_document_records_matter_idx
  on public.legal_document_records(matter_id, lifecycle_state);

create table if not exists public.matter_communications (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  channel text not null,
  direction text not null check (direction in ('INBOUND','OUTBOUND')),
  subject text,
  recipient_or_sender text,
  lifecycle_state text not null default 'DRAFT'
    check (lifecycle_state in ('DRAFT','IN_REVIEW','APPROVED','SENT','DELIVERED','ACKNOWLEDGED','REPLIED','FAILED')),
  external_message_id text,
  body_hash text,
  substantive_legal_advice boolean not null default false,
  drafted_by uuid references public.lawyers(id) on delete set null,
  reviewed_by uuid references public.lawyers(id) on delete set null,
  approved_by uuid references public.lawyers(id) on delete set null,
  sent_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists matter_communications_timeline_idx
  on public.matter_communications(matter_id, created_at);

create table if not exists public.matter_approvals (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  approval_type text not null,
  subject_type text not null,
  subject_id text not null,
  requested_by uuid references public.lawyers(id) on delete set null,
  decided_by uuid references public.lawyers(id) on delete set null,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists matter_approvals_pending_idx
  on public.matter_approvals(firm_id, status, requested_at);

create or replace function public.transition_matter_lifecycle(
  p_matter_id uuid,
  p_expected_state text,
  p_new_state text,
  p_actor_lawyer_id uuid default null,
  p_actor_name text default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.matters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matter public.matters;
  v_allowed boolean := false;
begin
  select *
    into v_matter
  from public.matters
  where id = p_matter_id
  for update;

  if not found then
    raise exception 'Matter not found.';
  end if;

  if v_matter.lifecycle_state is distinct from p_expected_state then
    raise exception
      'Matter lifecycle changed concurrently. Expected %, found %.',
      p_expected_state,
      v_matter.lifecycle_state;
  end if;

  v_allowed := case v_matter.lifecycle_state
    when 'PROSPECT' then p_new_state in ('CONFLICT_REVIEW')
    when 'CONFLICT_REVIEW' then p_new_state in ('ENGAGEMENT','PROSPECT')
    when 'ENGAGEMENT' then p_new_state in ('OPEN','CONFLICT_REVIEW')
    when 'OPEN' then p_new_state in ('ACTIVE','CLOSING')
    when 'ACTIVE' then p_new_state in ('WAITING_EXTERNAL','CLOSING')
    when 'WAITING_EXTERNAL' then p_new_state in ('ACTIVE','CLOSING')
    when 'CLOSING' then p_new_state in ('ACTIVE','CLOSED')
    when 'CLOSED' then p_new_state in ('ARCHIVED')
    when 'ARCHIVED' then false
    else false
  end;

  if not v_allowed then
    raise exception
      'Invalid matter lifecycle transition: % -> %.',
      v_matter.lifecycle_state,
      p_new_state;
  end if;

  insert into public.matter_events (
    matter_id,
    firm_id,
    event_type,
    previous_state,
    new_state,
    actor_lawyer_id,
    actor_name,
    reason,
    metadata
  )
  values (
    v_matter.id,
    v_matter.firm_id,
    'MATTER_LIFECYCLE_TRANSITION',
    v_matter.lifecycle_state,
    p_new_state,
    p_actor_lawyer_id,
    p_actor_name,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  );

  update public.matters
  set lifecycle_state = p_new_state
  where id = v_matter.id
  returning * into v_matter;

  return v_matter;
end;
$$;

-- Existing TSIDEK application APIs use a server-side Supabase service-role client.
-- Do not expose direct client transition rights. The API route performs firm,
-- matter-membership, ethical-wall and permission checks before invoking this RPC.
revoke all on function public.transition_matter_lifecycle(
  uuid, text, text, uuid, text, text, jsonb
) from public, anon, authenticated;

-- RLS is enabled now so newly-added records cannot accidentally become
-- browser-readable before explicit user-session policies are designed.
alter table public.matter_events enable row level security;
alter table public.matter_obligations enable row level security;
alter table public.legal_document_records enable row level security;
alter table public.matter_communications enable row level security;
alter table public.matter_approvals enable row level security;
