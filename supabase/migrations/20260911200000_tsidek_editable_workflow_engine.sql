create table if not exists public.firm_workflow_definitions (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
  workflow_key text not null, name text not null, subject_type text not null check (subject_type in ('prospect','matter','engagement')),
  description text, status text not null default 'active' check (status in ('draft','active','retired')), version integer not null default 1,
  configuration jsonb not null default '{}'::jsonb, created_by uuid references public.lawyers(id), updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(firm_id,workflow_key,version)
);
create table if not exists public.firm_workflow_stages (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.firm_workflow_definitions(id) on delete cascade,
  stage_key text not null, name text not null, description text, sort_order integer not null default 0,
  stage_type text not null default 'work' check (stage_type in ('gate','work','review','finance','closure')), color_token text,
  required_roles text[] not null default '{}', entry_requirements jsonb not null default '{}'::jsonb, exit_requirements jsonb not null default '{}'::jsonb,
  sla_hours integer, is_terminal boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workflow_id,stage_key)
);
create table if not exists public.firm_workflow_transitions (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.firm_workflow_definitions(id) on delete cascade,
  from_stage_key text not null, to_stage_key text not null, name text not null, allowed_roles text[] not null default '{}', guard_rules jsonb not null default '{}'::jsonb,
  requires_reason boolean not null default false, requires_approval boolean not null default false, approval_roles text[] not null default '{}', automation jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workflow_id,from_stage_key,to_stage_key)
);
create table if not exists public.matter_workflow_instances (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
  workflow_id uuid not null references public.firm_workflow_definitions(id), current_stage_key text not null,
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')), stage_entered_at timestamptz not null default now(),
  completed_at timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(matter_id)
);
create table if not exists public.matter_workflow_events (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade, matter_id uuid not null references public.matters(id) on delete cascade,
  instance_id uuid not null references public.matter_workflow_instances(id) on delete cascade, transition_id uuid references public.firm_workflow_transitions(id),
  from_stage_key text, to_stage_key text not null, action text not null default 'transition', reason text, guard_snapshot jsonb not null default '{}'::jsonb,
  actor_lawyer_id uuid references public.lawyers(id), actor_role text, created_at timestamptz not null default now()
);
alter table public.firm_workflow_definitions enable row level security; alter table public.firm_workflow_stages enable row level security; alter table public.firm_workflow_transitions enable row level security; alter table public.matter_workflow_instances enable row level security; alter table public.matter_workflow_events enable row level security;
revoke all on public.firm_workflow_definitions,public.firm_workflow_stages,public.firm_workflow_transitions,public.matter_workflow_instances,public.matter_workflow_events from anon;
grant select,insert,update,delete on public.firm_workflow_definitions,public.firm_workflow_stages,public.firm_workflow_transitions to authenticated;
grant select,insert,update on public.matter_workflow_instances to authenticated; grant select,insert on public.matter_workflow_events to authenticated;
create policy "workflow_definition_read" on public.firm_workflow_definitions for select to authenticated using (firm_id=public.current_firm_id());
create policy "workflow_definition_manage" on public.firm_workflow_definitions for all to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id)) with check (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id));
create policy "workflow_stage_read" on public.firm_workflow_stages for select to authenticated using (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id()));
create policy "workflow_stage_manage" on public.firm_workflow_stages for all to authenticated using (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(w.firm_id))) with check (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(w.firm_id)));
create policy "workflow_transition_read" on public.firm_workflow_transitions for select to authenticated using (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id()));
create policy "workflow_transition_manage" on public.firm_workflow_transitions for all to authenticated using (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(w.firm_id))) with check (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(w.firm_id)));
create policy "matter_workflow_read" on public.matter_workflow_instances for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "matter_workflow_insert" on public.matter_workflow_instances for insert to authenticated with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "matter_workflow_update" on public.matter_workflow_instances for update to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id)) with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "matter_workflow_event_read" on public.matter_workflow_events for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy "matter_workflow_event_insert" on public.matter_workflow_events for insert to authenticated with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create index if not exists idx_workflow_definitions_firm_subject on public.firm_workflow_definitions(firm_id,subject_type,status,version desc); create index if not exists idx_workflow_stages_order on public.firm_workflow_stages(workflow_id,sort_order); create index if not exists idx_workflow_transitions_from on public.firm_workflow_transitions(workflow_id,from_stage_key,active,sort_order); create index if not exists idx_matter_workflow_firm_stage on public.matter_workflow_instances(firm_id,current_stage_key,status); create index if not exists idx_matter_workflow_events_matter on public.matter_workflow_events(matter_id,created_at desc);
