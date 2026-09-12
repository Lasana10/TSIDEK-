create table if not exists public.workflow_transition_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  instance_id uuid not null references public.matter_workflow_instances(id) on delete cascade,
  transition_id uuid not null references public.firm_workflow_transitions(id) on delete cascade,
  from_stage_key text not null,
  to_stage_key text not null,
  requester_lawyer_id uuid references public.lawyers(id) on delete set null,
  requester_role text,
  reason text,
  guard_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','stale')),
  reviewer_lawyer_id uuid references public.lawyers(id) on delete set null,
  reviewer_role text,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists workflow_transition_pending_unique on public.workflow_transition_requests(instance_id,transition_id) where status='pending';
create index if not exists workflow_transition_requests_firm_status on public.workflow_transition_requests(firm_id,status,created_at desc);
create index if not exists workflow_transition_requests_matter on public.workflow_transition_requests(matter_id,status,created_at desc);
create index if not exists workflow_transition_requests_requester on public.workflow_transition_requests(requester_lawyer_id) where requester_lawyer_id is not null;
create index if not exists workflow_transition_requests_reviewer on public.workflow_transition_requests(reviewer_lawyer_id) where reviewer_lawyer_id is not null;
alter table public.workflow_transition_requests enable row level security;
revoke all on table public.workflow_transition_requests from anon;
grant select on table public.workflow_transition_requests to authenticated;
create policy workflow_transition_requests_member_select on public.workflow_transition_requests for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
