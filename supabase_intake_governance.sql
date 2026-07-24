-- TSIDEK intake governance enrichment.
-- Run after supabase_intake_workflow.sql on existing environments.

alter table if exists matter_opening_checklists
  add column if not exists responsible_lawyer_id uuid references lawyers(id);

alter table if exists matter_opening_checklists
  add column if not exists initial_deadline_note text;

alter table if exists matter_opening_checklists
  add column if not exists document_structure_note text;

alter table if exists matter_opening_checklists
  add column if not exists opening_notes text;

create table if not exists intake_decision_events (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    prospect_id uuid not null references prospects(id) on delete cascade,
    actor_id uuid references lawyers(id),
    event_type text not null check (
        event_type in (
            'prospect_created',
            'conflict_scan_completed',
            'conflict_decided',
            'engagement_updated',
            'engagement_approved',
            'checklist_updated',
            'matter_opened'
        )
    ),
    summary text not null,
    detail text,
    created_at timestamptz not null default now()
);

create index if not exists idx_intake_decision_events_prospect_created
  on intake_decision_events(prospect_id, created_at desc);

alter table intake_decision_events enable row level security;

create policy "firm members can access intake decision events"
  on intake_decision_events
  for all
  using (firm_id = current_firm_id())
  with check (firm_id = current_firm_id());
