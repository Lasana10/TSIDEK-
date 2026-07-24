-- TSIDEK operational spine live patch.
-- Applied to Supabase project vpxtmgpxqlmkkyijuare.
-- Purpose: align the live backend with the real product spine:
-- intake, conflict review, engagement, matter opening, document governance,
-- controlled client updates, matter security, and tenant-safe RLS.

create extension if not exists pgcrypto;

alter table if exists matters
  add column if not exists confidentiality_level text not null default 'Normal',
  add column if not exists security_notes text,
  add column if not exists procedural_stage text,
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz;

alter table if exists documents
  add column if not exists status text not null default 'Draft',
  add column if not exists review_status text not null default 'Not reviewed',
  add column if not exists access_level text not null default 'Matter team',
  add column if not exists sharing_policy text not null default 'Internal only',
  add column if not exists version_label text not null default 'v1',
  add column if not exists source_kind text not null default 'Uploaded',
  add column if not exists checksum text,
  add column if not exists reviewed_by uuid references lawyers(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by uuid references lawyers(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists filed_at timestamptz,
  add column if not exists original_location text,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists retention_until date,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists matter_access_overrides (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  lawyer_id uuid not null references lawyers(id) on delete cascade,
  access_type text not null default 'Temporary grant',
  reason text not null,
  expires_at timestamptz,
  created_by uuid references lawyers(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table matter_access_overrides
  add column if not exists firm_id uuid references firms(id) on delete cascade,
  add column if not exists matter_id uuid references matters(id) on delete cascade,
  add column if not exists lawyer_id uuid references lawyers(id) on delete cascade,
  add column if not exists access_type text not null default 'Temporary grant',
  add column if not exists reason text,
  add column if not exists expires_at timestamptz,
  add column if not exists created_by uuid references lawyers(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  prospect_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text,
  matter_summary text,
  proposed_matter_type text,
  jurisdiction text,
  status text not null default 'Intake',
  risk_level text not null default 'Medium',
  responsible_lawyer_id uuid references lawyers(id) on delete set null,
  conflict_status text not null default 'Not checked',
  engagement_status text not null default 'Not prepared',
  created_by uuid references lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prospect_parties (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  party_name text not null,
  party_role text not null,
  relationship_notes text,
  created_at timestamptz not null default now()
);

create table if not exists conflict_checks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  checked_by uuid references lawyers(id) on delete set null,
  status text not null default 'Pending review',
  match_summary text,
  decision_reason text,
  waiver_required boolean not null default false,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists engagements (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  approved_by uuid references lawyers(id) on delete set null,
  fee_model text not null default 'To define',
  scope_of_work text,
  engagement_letter_status text not null default 'Draft',
  approval_status text not null default 'Pending approval',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists matter_opening_checklists (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  matter_id uuid references matters(id) on delete cascade,
  conflict_cleared boolean not null default false,
  kyc_complete boolean not null default false,
  engagement_approved boolean not null default false,
  responsible_lawyer_assigned boolean not null default false,
  initial_deadline_reviewed boolean not null default false,
  opening_documents_ready boolean not null default false,
  responsible_lawyer_id uuid references lawyers(id) on delete set null,
  initial_deadline_notes text,
  opening_document_notes text,
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intake_decision_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  matter_id uuid references matters(id) on delete cascade,
  event_type text not null,
  status text not null,
  actor_id uuid references lawyers(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists matter_client_updates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  created_by uuid references lawyers(id) on delete set null,
  approved_by uuid references lawyers(id) on delete set null,
  title text not null,
  body text not null,
  channel text not null default 'Email',
  audience text not null default 'Client',
  status text not null default 'Draft',
  instruction_required boolean not null default false,
  instruction_status text not null default 'Not requested',
  delivery_status text not null default 'Not sent',
  client_acknowledged_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_review_status on documents(review_status);
create index if not exists idx_documents_access_level on documents(access_level);
create index if not exists idx_documents_legal_hold on documents(legal_hold);
create index if not exists idx_matters_confidentiality on matters(confidentiality_level);
create index if not exists idx_matter_access_overrides_matter on matter_access_overrides(matter_id);
create index if not exists idx_matter_access_overrides_lawyer on matter_access_overrides(lawyer_id);
create index if not exists idx_prospects_firm_status on prospects(firm_id, status);
create index if not exists idx_prospect_parties_prospect on prospect_parties(prospect_id);
create index if not exists idx_conflict_checks_prospect on conflict_checks(prospect_id);
create index if not exists idx_engagements_prospect on engagements(prospect_id);
create index if not exists idx_matter_opening_checklists_prospect on matter_opening_checklists(prospect_id);
create index if not exists idx_matter_opening_checklists_matter on matter_opening_checklists(matter_id);
create index if not exists idx_intake_decision_events_prospect on intake_decision_events(prospect_id, created_at desc);
create index if not exists idx_matter_client_updates_matter on matter_client_updates(matter_id, created_at desc);
create index if not exists idx_matter_client_updates_status on matter_client_updates(status);

alter table matter_access_overrides enable row level security;
alter table prospects enable row level security;
alter table prospect_parties enable row level security;
alter table conflict_checks enable row level security;
alter table engagements enable row level security;
alter table matter_opening_checklists enable row level security;
alter table intake_decision_events enable row level security;
alter table matter_client_updates enable row level security;

drop policy if exists "firm members can access matter access overrides" on matter_access_overrides;
create policy "firm members can access matter access overrides" on matter_access_overrides
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access prospects" on prospects;
create policy "firm members can access prospects" on prospects
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access prospect parties" on prospect_parties;
create policy "firm members can access prospect parties" on prospect_parties
for all to authenticated
using (exists (
  select 1 from prospects
  where prospects.id = prospect_parties.prospect_id
  and prospects.firm_id = current_firm_id()
))
with check (exists (
  select 1 from prospects
  where prospects.id = prospect_parties.prospect_id
  and prospects.firm_id = current_firm_id()
));

drop policy if exists "firm members can access conflict checks" on conflict_checks;
create policy "firm members can access conflict checks" on conflict_checks
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access engagements" on engagements;
create policy "firm members can access engagements" on engagements
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access opening checklists" on matter_opening_checklists;
create policy "firm members can access opening checklists" on matter_opening_checklists
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access intake decision events" on intake_decision_events;
create policy "firm members can access intake decision events" on intake_decision_events
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

drop policy if exists "firm members can access matter client updates" on matter_client_updates;
create policy "firm members can access matter client updates" on matter_client_updates
for all to authenticated
using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  matter_access_overrides,
  prospects,
  prospect_parties,
  conflict_checks,
  engagements,
  matter_opening_checklists,
  intake_decision_events,
  matter_client_updates
  to authenticated;

grant select on
  firms,
  lawyers,
  matters,
  matter_members,
  documents,
  tasks,
  audit_logs,
  knowledge_entries,
  matter_case_fields,
  digital_case_files
  to authenticated;
