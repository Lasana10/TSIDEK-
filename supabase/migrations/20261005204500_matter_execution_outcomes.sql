create table if not exists public.matter_execution_actions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  action_type text not null,
  title text not null,
  target_system text,
  execution_mode text not null default 'human_assisted' check (execution_mode in ('direct_api','partner_api','human_assisted','manual')),
  status text not null default 'planned' check (status in ('planned','ready','awaiting_approval','in_progress','submitted','acknowledged','completed','failed','cancelled')),
  approval_id uuid,
  external_reference text,
  evidence_reference text,
  responsible_lawyer_id uuid references public.lawyers(id) on delete set null,
  due_at timestamptz,
  executed_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_outcomes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  outcome_type text not null default 'matter_result',
  title text not null,
  result_summary text not null,
  client_result text,
  reusable_lesson text,
  precedent_candidate boolean not null default false,
  knowledge_status text not null default 'draft' check (knowledge_status in ('draft','reviewed','approved_internal','restricted','not_reusable')),
  reviewed_by uuid references public.lawyers(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matter_execution_actions_matter on public.matter_execution_actions(matter_id,status,due_at);
create index if not exists idx_matter_outcomes_matter on public.matter_outcomes(matter_id,knowledge_status,created_at desc);

alter table public.matter_execution_actions enable row level security;
alter table public.matter_outcomes enable row level security;
revoke all on public.matter_execution_actions, public.matter_outcomes from anon;
grant select,insert,update,delete on public.matter_execution_actions, public.matter_outcomes to authenticated;

drop policy if exists matter_execution_actions_access on public.matter_execution_actions;
create policy matter_execution_actions_access on public.matter_execution_actions for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_outcomes_access on public.matter_outcomes;
create policy matter_outcomes_access on public.matter_outcomes for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));