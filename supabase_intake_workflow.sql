-- TSIDEK intake, conflict review, engagement approval, and matter opening.
-- Run after supabase_schema.sql. The tables are firm-scoped and preserve the
-- decision trail before an enquiry becomes an active matter.

create table if not exists prospects (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    created_by uuid references lawyers(id),
    name text not null,
    normalized_name text not null,
    email text,
    phone text,
    matter_type text not null,
    jurisdiction text not null default 'OHADA',
    summary text not null,
    status text not null default 'Conflict review' check (status in ('New', 'Conflict review', 'Engagement', 'Ready to open', 'Converted', 'Declined')),
    matter_id uuid references matters(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists prospect_parties (
    id uuid primary key default uuid_generate_v4(),
    prospect_id uuid not null references prospects(id) on delete cascade,
    name text not null,
    normalized_name text not null,
    party_role text not null check (party_role in ('Prospective client', 'Opposing party', 'Related party', 'Witness', 'Director', 'Beneficial owner', 'Other')),
    created_at timestamptz not null default now()
);

create table if not exists conflict_checks (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    prospect_id uuid not null unique references prospects(id) on delete cascade,
    status text not null default 'Pending' check (status in ('Pending', 'Potential conflict', 'Cleared', 'Waived')),
    matches jsonb not null default '[]'::jsonb,
    reviewed_by uuid references lawyers(id),
    reviewed_at timestamptz,
    decision_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists engagements (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    prospect_id uuid not null unique references prospects(id) on delete cascade,
    status text not null default 'Draft' check (status in ('Draft', 'Approval required', 'Approved', 'Declined')),
    scope_of_work text not null,
    fee_arrangement text not null,
    approved_by uuid references lawyers(id),
    approved_at timestamptz,
    decision_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists matter_opening_checklists (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    prospect_id uuid not null unique references prospects(id) on delete cascade,
    identity_complete boolean not null default false,
    conflict_cleared boolean not null default false,
    engagement_approved boolean not null default false,
    responsible_lawyer_assigned boolean not null default false,
    responsible_lawyer_id uuid references lawyers(id),
    initial_deadline_reviewed boolean not null default false,
    initial_deadline_note text,
    document_structure_created boolean not null default false,
    document_structure_note text,
    opening_notes text,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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

create index if not exists idx_prospects_firm_status on prospects(firm_id, status, created_at desc);
create index if not exists idx_prospects_firm_name on prospects(firm_id, normalized_name);
create index if not exists idx_prospect_parties_name on prospect_parties(normalized_name);
create index if not exists idx_conflict_checks_firm_status on conflict_checks(firm_id, status);
create index if not exists idx_intake_decision_events_prospect_created on intake_decision_events(prospect_id, created_at desc);

drop trigger if exists trg_prospects_updated_at on prospects;
create trigger trg_prospects_updated_at before update on prospects for each row execute function set_updated_at();
drop trigger if exists trg_conflict_checks_updated_at on conflict_checks;
create trigger trg_conflict_checks_updated_at before update on conflict_checks for each row execute function set_updated_at();
drop trigger if exists trg_engagements_updated_at on engagements;
create trigger trg_engagements_updated_at before update on engagements for each row execute function set_updated_at();
drop trigger if exists trg_matter_opening_checklists_updated_at on matter_opening_checklists;
create trigger trg_matter_opening_checklists_updated_at before update on matter_opening_checklists for each row execute function set_updated_at();

alter table prospects enable row level security;
alter table prospect_parties enable row level security;
alter table conflict_checks enable row level security;
alter table engagements enable row level security;
alter table matter_opening_checklists enable row level security;
alter table intake_decision_events enable row level security;

create policy "firm members can access prospects" on prospects for all using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
create policy "firm members can access prospect parties" on prospect_parties for all using (exists (select 1 from prospects where prospects.id = prospect_parties.prospect_id and prospects.firm_id = current_firm_id())) with check (exists (select 1 from prospects where prospects.id = prospect_parties.prospect_id and prospects.firm_id = current_firm_id()));
create policy "firm members can access conflict checks" on conflict_checks for all using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
create policy "firm members can access engagements" on engagements for all using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
create policy "firm members can access opening checklists" on matter_opening_checklists for all using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
create policy "firm members can access intake decision events" on intake_decision_events for all using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
