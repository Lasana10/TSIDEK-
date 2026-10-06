-- Production repair for adaptive Matter tables that were merged in code but skipped in the live migration history.
-- The application writes these governed records through server-side permission checks; authenticated clients receive read-only access.

alter table public.matters add column if not exists engagement_nature text not null default 'custom';
alter table public.matters add column if not exists practice_area text;
alter table public.matters add column if not exists service_type text;
alter table public.matters add column if not exists client_objective text;
alter table public.matters add column if not exists plan_label text not null default 'Matter plan';
alter table public.matters drop constraint if exists matters_engagement_nature_check;
alter table public.matters add constraint matters_engagement_nature_check check (engagement_nature in ('contentious','transactional','registration','advisory','diligence','compliance','custom'));

create table if not exists public.matter_workstreams (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 name text not null,
 workstream_type text not null default 'general',
 status text not null default 'active' check (status in ('planned','active','blocked','completed','cancelled')),
 sequence_no integer not null default 0,
 objective text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.matter_milestones (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 workstream_id uuid references public.matter_workstreams(id) on delete cascade,
 title text not null,
 status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','waived')),
 due_at timestamptz,
 source_kind text not null default 'matter_plan',
 source_detail text,
 sequence_no integer not null default 0,
 completed_at timestamptz,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.matter_milestones drop constraint if exists matter_milestones_source_kind_check;
alter table public.matter_milestones add constraint matter_milestones_source_kind_check check (source_kind in ('matter_plan','law','court','authority','contract','client','internal','ai_proposal','docket_event'));

create table if not exists public.matter_decisions (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 decision_type text not null default 'professional',
 title text not null,
 question text,
 decision text,
 status text not null default 'proposed' check(status in ('proposed','approved','rejected','superseded')),
 authority_level text not null default 'matter_team',
 decided_by uuid references public.lawyers(id) on delete set null,
 decided_at timestamptz,
 rationale text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.matter_client_instructions (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 instruction text not null,
 channel text not null default 'recorded',
 received_at timestamptz not null default now(),
 recorded_by uuid references public.lawyers(id) on delete set null,
 confirmation_status text not null default 'recorded' check(confirmation_status in ('recorded','confirmation_requested','confirmed','disputed','superseded')),
 decision_id uuid references public.matter_decisions(id) on delete set null,
 source_reference text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.matter_evidence_provenance (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 evidence_type text not null,
 title text not null,
 source_kind text not null,
 source_reference text,
 document_id uuid,
 assertion text,
 verification_status text not null default 'unverified' check(verification_status in ('unverified','corroborated','verified','disputed','superseded')),
 verified_by uuid references public.lawyers(id) on delete set null,
 verified_at timestamptz,
 reliability_note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.matter_handoffs (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 handoff_type text not null default 'professional',
 from_lawyer_id uuid references public.lawyers(id) on delete set null,
 to_lawyer_id uuid references public.lawyers(id) on delete set null,
 external_professional text,
 purpose text not null,
 status text not null default 'prepared' check(status in ('prepared','accepted','in_progress','returned','completed','cancelled')),
 scope_note text,
 authority_note text,
 evidence_snapshot jsonb not null default '{}'::jsonb,
 accepted_at timestamptz,
 completed_at timestamptz,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists idx_matter_workstreams_matter on public.matter_workstreams(matter_id,status,sequence_no);
create index if not exists idx_matter_workstreams_firm on public.matter_workstreams(firm_id);
create index if not exists idx_matter_milestones_matter on public.matter_milestones(matter_id,status,sequence_no);
create index if not exists idx_matter_milestones_firm on public.matter_milestones(firm_id);
create index if not exists idx_matter_milestones_workstream on public.matter_milestones(workstream_id);
create index if not exists idx_matter_decisions_matter on public.matter_decisions(matter_id,status,created_at desc);
create index if not exists idx_matter_decisions_firm on public.matter_decisions(firm_id);
create index if not exists idx_matter_decisions_decided_by on public.matter_decisions(decided_by);
create index if not exists idx_matter_client_instructions_matter on public.matter_client_instructions(matter_id,received_at desc);
create index if not exists idx_matter_client_instructions_firm on public.matter_client_instructions(firm_id);
create index if not exists idx_matter_client_instructions_recorded_by on public.matter_client_instructions(recorded_by);
create index if not exists idx_matter_client_instructions_decision on public.matter_client_instructions(decision_id);
create index if not exists idx_matter_evidence_provenance_matter on public.matter_evidence_provenance(matter_id,verification_status,created_at desc);
create index if not exists idx_matter_evidence_provenance_firm on public.matter_evidence_provenance(firm_id);
create index if not exists idx_matter_evidence_provenance_verified_by on public.matter_evidence_provenance(verified_by);
create index if not exists idx_matter_handoffs_matter on public.matter_handoffs(matter_id,status,created_at desc);
create index if not exists idx_matter_handoffs_firm on public.matter_handoffs(firm_id);
create index if not exists idx_matter_handoffs_from_lawyer on public.matter_handoffs(from_lawyer_id);
create index if not exists idx_matter_handoffs_to_lawyer on public.matter_handoffs(to_lawyer_id);

alter table public.matter_workstreams enable row level security;
alter table public.matter_milestones enable row level security;
alter table public.matter_decisions enable row level security;
alter table public.matter_client_instructions enable row level security;
alter table public.matter_evidence_provenance enable row level security;
alter table public.matter_handoffs enable row level security;

revoke all on public.matter_workstreams, public.matter_milestones, public.matter_decisions, public.matter_client_instructions, public.matter_evidence_provenance, public.matter_handoffs from anon;
revoke all on public.matter_workstreams, public.matter_milestones, public.matter_decisions, public.matter_client_instructions, public.matter_evidence_provenance, public.matter_handoffs from authenticated;
grant select on public.matter_workstreams, public.matter_milestones, public.matter_decisions, public.matter_client_instructions, public.matter_evidence_provenance, public.matter_handoffs to authenticated;

drop policy if exists matter_workstreams_access on public.matter_workstreams;
drop policy if exists matter_workstreams_read on public.matter_workstreams;
create policy matter_workstreams_read on public.matter_workstreams for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
drop policy if exists matter_milestones_access on public.matter_milestones;
drop policy if exists matter_milestones_read on public.matter_milestones;
create policy matter_milestones_read on public.matter_milestones for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
drop policy if exists matter_decisions_access on public.matter_decisions;
drop policy if exists matter_decisions_read on public.matter_decisions;
create policy matter_decisions_read on public.matter_decisions for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
drop policy if exists matter_client_instructions_access on public.matter_client_instructions;
drop policy if exists matter_client_instructions_read on public.matter_client_instructions;
create policy matter_client_instructions_read on public.matter_client_instructions for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
drop policy if exists matter_evidence_provenance_access on public.matter_evidence_provenance;
drop policy if exists matter_evidence_provenance_read on public.matter_evidence_provenance;
create policy matter_evidence_provenance_read on public.matter_evidence_provenance for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
drop policy if exists matter_handoffs_access on public.matter_handoffs;
drop policy if exists matter_handoffs_read on public.matter_handoffs;
create policy matter_handoffs_read on public.matter_handoffs for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
