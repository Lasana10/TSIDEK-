create table if not exists public.firm_workflow_stage_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.firm_workflow_definitions(id) on delete cascade,
  stage_key text not null,
  action_key text not null,
  action_type text not null check (action_type in ('create_task','require_document','require_client_update','notify_role','require_finance_reconciliation','create_review','create_closure_checklist')),
  name text not null,
  configuration jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workflow_id,stage_key,action_key)
);

create table if not exists public.matter_workflow_action_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  instance_id uuid not null references public.matter_workflow_instances(id) on delete cascade,
  stage_action_id uuid not null references public.firm_workflow_stage_actions(id) on delete cascade,
  stage_key text not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','skipped')),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  executed_by uuid references public.lawyers(id) on delete set null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id,stage_action_id,stage_key)
);

create index if not exists workflow_stage_actions_stage_idx on public.firm_workflow_stage_actions(workflow_id,stage_key,active,sort_order);
create index if not exists workflow_action_runs_matter_idx on public.matter_workflow_action_runs(matter_id,stage_key,status,created_at desc);
create index if not exists workflow_action_runs_firm_status_idx on public.matter_workflow_action_runs(firm_id,status,created_at desc);

alter table public.firm_workflow_stage_actions enable row level security;
alter table public.matter_workflow_action_runs enable row level security;
revoke all on table public.firm_workflow_stage_actions, public.matter_workflow_action_runs from anon;
grant select on table public.firm_workflow_stage_actions, public.matter_workflow_action_runs to authenticated;

create policy workflow_stage_actions_member_select on public.firm_workflow_stage_actions
for select to authenticated
using (exists(select 1 from public.firm_workflow_definitions w where w.id=workflow_id and w.firm_id=public.current_firm_id()));

create policy workflow_action_runs_member_select on public.matter_workflow_action_runs
for select to authenticated
using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

insert into public.firm_workflow_stage_actions(workflow_id,stage_key,action_key,action_type,name,configuration,sort_order)
select w.id, v.stage_key, v.action_key, v.action_type, v.name, v.configuration::jsonb, v.sort_order
from public.firm_workflow_definitions w
cross join (values
 ('planning','strategy_work_plan','create_task','Prepare strategy and delegation plan','{"title":"Prepare strategy and delegation plan","description":"Confirm legal theory, responsibilities, immediate deadlines, evidence plan and client communication plan.","assign":"lead"}',10),
 ('planning','client_update_plan','require_client_update','Confirm client communication plan','{"title":"Initial client progress update","instruction_required":false}',20),
 ('execution','evidence_review','create_task','Review evidence and outstanding documents','{"title":"Evidence and document review","description":"Review the matter evidence, identify missing documents and assign follow-up.","assign":"lead"}',10),
 ('filing_hearing','filing_review','create_review','Create filing/hearing review','{"title":"Filing / hearing readiness review"}',10),
 ('client_finance','client_progress_update','require_client_update','Prepare governed client update','{"title":"Matter progress update","instruction_required":false}',10),
 ('client_finance','finance_reconciliation','require_finance_reconciliation','Require matter financial reconciliation','{}',20),
 ('closing','closure_checklist','create_closure_checklist','Create closure control checklist','{}',10)
) as v(stage_key,action_key,action_type,name,configuration,sort_order)
where w.workflow_key='matter_standard'
on conflict(workflow_id,stage_key,action_key) do nothing;
