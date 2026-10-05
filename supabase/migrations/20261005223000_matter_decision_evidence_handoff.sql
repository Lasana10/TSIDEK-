create table if not exists public.matter_decisions (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
 decision_type text not null default 'professional', title text not null, question text, decision text, status text not null default 'proposed' check(status in ('proposed','approved','rejected','superseded')),
 authority_level text not null default 'matter_team', decided_by uuid references public.lawyers(id) on delete set null, decided_at timestamptz, rationale text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.matter_client_instructions (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
 instruction text not null, channel text not null default 'recorded', received_at timestamptz not null default now(), recorded_by uuid references public.lawyers(id) on delete set null,
 confirmation_status text not null default 'recorded' check(confirmation_status in ('recorded','confirmation_requested','confirmed','disputed','superseded')), decision_id uuid references public.matter_decisions(id) on delete set null,
 source_reference text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.matter_evidence_provenance (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
 evidence_type text not null, title text not null, source_kind text not null, source_reference text, document_id uuid, assertion text, verification_status text not null default 'unverified' check(verification_status in ('unverified','corroborated','verified','disputed','superseded')),
 verified_by uuid references public.lawyers(id) on delete set null, verified_at timestamptz, reliability_note text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.matter_handoffs (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
 handoff_type text not null default 'professional', from_lawyer_id uuid references public.lawyers(id) on delete set null, to_lawyer_id uuid references public.lawyers(id) on delete set null,
 external_professional text, purpose text not null, status text not null default 'prepared' check(status in ('prepared','accepted','in_progress','returned','completed','cancelled')),
 scope_note text, authority_note text, evidence_snapshot jsonb not null default '{}'::jsonb, accepted_at timestamptz, completed_at timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_matter_decisions_matter on public.matter_decisions(matter_id,status,created_at desc);
create index if not exists idx_matter_client_instructions_matter on public.matter_client_instructions(matter_id,received_at desc);
create index if not exists idx_matter_evidence_provenance_matter on public.matter_evidence_provenance(matter_id,verification_status,created_at desc);
create index if not exists idx_matter_handoffs_matter on public.matter_handoffs(matter_id,status,created_at desc);
alter table public.matter_decisions enable row level security; alter table public.matter_client_instructions enable row level security; alter table public.matter_evidence_provenance enable row level security; alter table public.matter_handoffs enable row level security;
revoke all on public.matter_decisions,public.matter_client_instructions,public.matter_evidence_provenance,public.matter_handoffs from anon;
grant select,insert,update,delete on public.matter_decisions,public.matter_client_instructions,public.matter_evidence_provenance,public.matter_handoffs to authenticated;
do $$ declare t text; begin foreach t in array array['matter_decisions','matter_client_instructions','matter_evidence_provenance','matter_handoffs'] loop
 execute format('drop policy if exists %I on public.%I',t||'_access',t);
 execute format('create policy %I on public.%I for all to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))',t||'_access',t);
 end loop; end $$;