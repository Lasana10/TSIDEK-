-- TSIDEK: legal cooperation backend foundation
-- Core posture:
-- 1. Supabase/Postgres is the primary source of truth.
-- 2. OneDrive is an external document adapter, not the core database.
-- 3. Every matter is firm-scoped and protected with RLS.

create extension if not exists "uuid-ossp";

-- 1. firms and users
create table if not exists firms (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    country text default 'Cameroon',
    created_at timestamptz not null default now()
);

create table if not exists lawyers (
    id uuid primary key references auth.users(id) on delete cascade,
    firm_id uuid not null references firms(id) on delete cascade,
    full_name text not null,
    role text check (role in ('Partner', 'Senior Associate', 'Junior Associate', 'Intern', 'Paralegal', 'Project Manager')),
    microsoft_graph_token text,
    created_at timestamptz not null default now()
);

-- 2. roles and permissions
create table if not exists firm_roles (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    name text not null,
    description text,
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    unique (firm_id, name)
);

create table if not exists role_permissions (
    id uuid primary key default uuid_generate_v4(),
    role_id uuid not null references firm_roles(id) on delete cascade,
    permission_key text not null,
    created_at timestamptz not null default now(),
    unique (role_id, permission_key)
);

-- 3. matter core
create table if not exists matters (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    lead_lawyer_id uuid references lawyers(id),
    title text not null,
    client_name text not null,
    status text check (status in ('Lead', 'Onboarding', 'Active', 'In Court', 'Closed')),
    risk_level text check (risk_level in ('Low', 'Medium', 'High')),
    matter_type text,
    jurisdiction text default 'OHADA',
    synopsis text,
    primary_track text,
    risk_to_monitor text,
    ai_usage_rule text,
    next_draft text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists matter_members (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null references matters(id) on delete cascade,
    lawyer_id uuid not null references lawyers(id) on delete cascade,
    firm_role_id uuid references firm_roles(id),
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    unique (matter_id, lawyer_id)
);

-- 4. tasks, comments, and audit
create table if not exists tasks (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null references matters(id) on delete cascade,
    assigned_to uuid references lawyers(id),
    title text not null,
    description text,
    deadline timestamptz,
    status text not null default 'Open' check (status in ('Open', 'In Progress', 'Blocked', 'Done')),
    is_completed boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists matter_comments (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null references matters(id) on delete cascade,
    author_id uuid references lawyers(id),
    body text not null,
    comment_type text not null default 'note' check (comment_type in ('note', 'ai', 'approval', 'warning')),
    created_at timestamptz not null default now()
);

create table if not exists audit_logs (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    actor_id uuid references lawyers(id),
    action_type text not null,
    description text not null,
    is_critical boolean not null default false,
    created_at timestamptz not null default now()
);

-- 5. documents and physical file registry
create table if not exists documents (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null references matters(id) on delete cascade,
    uploaded_by uuid references lawyers(id),
    title text not null,
    document_type text,
    onedrive_file_id text,
    storage_path text,
    ai_summary text,
    requires_compliance_audit boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists physical_files (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null unique references matters(id) on delete cascade,
    file_code text not null unique,
    label text not null,
    location text,
    custody_status text,
    qr_payload text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists file_custody_events (
    id uuid primary key default uuid_generate_v4(),
    physical_file_id uuid not null references physical_files(id) on delete cascade,
    actor_id uuid references lawyers(id),
    event_type text not null check (event_type in ('registered', 'checked_out', 'checked_in', 'relocated')),
    note text,
    created_at timestamptz not null default now()
);

-- 5b. matter intelligence and compliance
create table if not exists case_preparation_items (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    preparation_type text not null check (preparation_type in ('Hearing', 'Filing', 'Witness', 'Client briefing', 'Research')),
    title text not null,
    owner_name text,
    due_date timestamptz,
    status text not null default 'Open' check (status in ('Open', 'In progress', 'Ready', 'Blocked')),
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists jurisprudence_entries (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    title text not null,
    forum text not null,
    jurisdiction text not null,
    decision_date date,
    legal_topics text[] not null default '{}',
    holding_summary text not null,
    citation text,
    source_type text not null check (source_type in ('Official reporter', 'Online research', 'Private scan', 'Internal memo')),
    source_url text,
    relevance_label text not null default 'Useful' check (relevance_label in ('Core authority', 'Useful', 'Watchlist')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists council_register_entries (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    body_name text not null,
    register_type text not null,
    reference_code text not null,
    jurisdiction text not null,
    status text not null default 'Draft' check (status in ('Draft', 'Filed', 'Pending response', 'Resolved')),
    filing_date date,
    follow_up_date date,
    history_note text,
    created_at timestamptz not null default now()
);

create table if not exists compliance_checklists (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null unique references matters(id) on delete cascade,
    title text not null,
    checklist_type text not null,
    overall_status text not null default 'In progress' check (overall_status in ('In progress', 'Ready for review', 'Completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists compliance_checklist_items (
    id uuid primary key default uuid_generate_v4(),
    checklist_id uuid not null references compliance_checklists(id) on delete cascade,
    label text not null,
    owner_name text,
    due_date timestamptz,
    status text not null default 'Pending' check (status in ('Pending', 'Satisfied', 'Escalated')),
    evidence_note text,
    created_at timestamptz not null default now()
);

create table if not exists knowledge_entries (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    source_document_id uuid references documents(id) on delete set null,
    title text not null,
    entry_type text not null check (entry_type in ('Precedent note', 'Book scan', 'Statute extract', 'Checklist', 'Strategy note')),
    tags text[] not null default '{}',
    summary text not null,
    storage_path text,
    sensitivity text not null default 'Internal' check (sensitivity in ('Internal', 'Restricted', 'Training-safe')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists matter_case_fields (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    field_key text not null,
    field_label text not null,
    field_value text not null,
    field_group text not null default 'Core facts',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (matter_id, field_key)
);

create table if not exists digital_case_files (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    file_label text not null,
    file_category text not null,
    storage_path text,
    storage_provider text not null default 'TSIDEK Vault',
    reference_code text,
    version_label text,
    status text not null default 'Draft' check (status in ('Draft', 'Active', 'Archived')),
    uploaded_at timestamptz not null default now()
);

create table if not exists document_templates (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    title text not null,
    practice_area text not null,
    jurisdiction text not null,
    language text not null check (language in ('FR', 'EN', 'Bilingual')),
    template_body text not null,
    preserved_form_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists template_generations (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    template_id uuid not null references document_templates(id) on delete cascade,
    title text not null,
    context_note text,
    output_text text not null,
    generated_at timestamptz not null default now()
);

-- 6. billing
create table if not exists invoices (
    id uuid primary key default uuid_generate_v4(),
    matter_id uuid not null references matters(id) on delete cascade,
    amount_xaf decimal not null,
    status text check (status in ('Draft', 'Sent', 'Partial', 'Paid', 'Overdue')),
    due_date timestamptz,
    created_at timestamptz not null default now()
);

-- 7. updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_matters_updated_at on matters;
create trigger set_matters_updated_at
before update on matters
for each row
execute function set_updated_at();

drop trigger if exists set_physical_files_updated_at on physical_files;
create trigger set_physical_files_updated_at
before update on physical_files
for each row
execute function set_updated_at();

drop trigger if exists set_jurisprudence_entries_updated_at on jurisprudence_entries;
create trigger set_jurisprudence_entries_updated_at
before update on jurisprudence_entries
for each row
execute function set_updated_at();

drop trigger if exists set_compliance_checklists_updated_at on compliance_checklists;
create trigger set_compliance_checklists_updated_at
before update on compliance_checklists
for each row
execute function set_updated_at();

drop trigger if exists set_knowledge_entries_updated_at on knowledge_entries;
create trigger set_knowledge_entries_updated_at
before update on knowledge_entries
for each row
execute function set_updated_at();

drop trigger if exists set_matter_case_fields_updated_at on matter_case_fields;
create trigger set_matter_case_fields_updated_at
before update on matter_case_fields
for each row
execute function set_updated_at();

drop trigger if exists set_document_templates_updated_at on document_templates;
create trigger set_document_templates_updated_at
before update on document_templates
for each row
execute function set_updated_at();

-- 8. row level security
alter table firms enable row level security;
alter table lawyers enable row level security;
alter table matters enable row level security;
alter table matter_members enable row level security;
alter table tasks enable row level security;
alter table matter_comments enable row level security;
alter table documents enable row level security;
alter table physical_files enable row level security;
alter table file_custody_events enable row level security;
alter table case_preparation_items enable row level security;
alter table jurisprudence_entries enable row level security;
alter table council_register_entries enable row level security;
alter table compliance_checklists enable row level security;
alter table compliance_checklist_items enable row level security;
alter table knowledge_entries enable row level security;
alter table matter_case_fields enable row level security;
alter table digital_case_files enable row level security;
alter table document_templates enable row level security;
alter table template_generations enable row level security;
alter table invoices enable row level security;
alter table audit_logs enable row level security;
alter table firm_roles enable row level security;
alter table role_permissions enable row level security;

create or replace function current_firm_id()
returns uuid
language sql
stable
as $$
    select firm_id from lawyers where id = auth.uid()
$$;

create policy "firm members can read their firm record" on firms
for select using (id = current_firm_id());

create policy "firm members can read lawyers in their firm" on lawyers
for select using (firm_id = current_firm_id());

create policy "firm members can manage their own matters" on matters
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can read matter membership" on matter_members
for all using (
    exists (
        select 1 from matters
        where matters.id = matter_members.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = matter_members.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access tasks" on tasks
for all using (
    exists (
        select 1 from matters
        where matters.id = tasks.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = tasks.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access comments" on matter_comments
for all using (
    exists (
        select 1 from matters
        where matters.id = matter_comments.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = matter_comments.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access documents" on documents
for all using (
    exists (
        select 1 from matters
        where matters.id = documents.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = documents.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access case preparation items" on case_preparation_items
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access jurisprudence entries" on jurisprudence_entries
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access council register entries" on council_register_entries
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access compliance checklists" on compliance_checklists
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access compliance checklist items" on compliance_checklist_items
for all using (
    exists (
        select 1 from compliance_checklists
        where compliance_checklists.id = compliance_checklist_items.checklist_id
          and compliance_checklists.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from compliance_checklists
        where compliance_checklists.id = compliance_checklist_items.checklist_id
          and compliance_checklists.firm_id = current_firm_id()
    )
);

create policy "firm members can access knowledge entries" on knowledge_entries
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access matter case fields" on matter_case_fields
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access digital case files" on digital_case_files
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access document templates" on document_templates
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access template generations" on template_generations
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access physical files" on physical_files
for all using (
    exists (
        select 1 from matters
        where matters.id = physical_files.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = physical_files.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access file custody events" on file_custody_events
for all using (
    exists (
        select 1
        from physical_files
        join matters on matters.id = physical_files.matter_id
        where physical_files.id = file_custody_events.physical_file_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1
        from physical_files
        join matters on matters.id = physical_files.matter_id
        where physical_files.id = file_custody_events.physical_file_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access invoices" on invoices
for all using (
    exists (
        select 1 from matters
        where matters.id = invoices.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from matters
        where matters.id = invoices.matter_id
          and matters.firm_id = current_firm_id()
    )
);

create policy "firm members can access audit logs" on audit_logs
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access firm roles" on firm_roles
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access role permissions" on role_permissions
for all using (
    exists (
        select 1 from firm_roles
        where firm_roles.id = role_permissions.role_id
          and firm_roles.firm_id = current_firm_id()
    )
)
with check (
    exists (
        select 1 from firm_roles
        where firm_roles.id = role_permissions.role_id
          and firm_roles.firm_id = current_firm_id()
    )
);

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    channel text not null default 'In-app',
    title text not null,
    message text not null,
    status text not null default 'Queued',
    action_label text,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists notification_preferences (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    channel text not null,
    enabled boolean not null default true,
    quiet_hours jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists chat_threads (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    title text not null,
    participants text[] not null default '{}'::text[],
    unread_count integer not null default 0,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists chat_messages (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    thread_id uuid not null references chat_threads(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    author text not null,
    role text not null,
    body text not null,
    origin text not null default 'human',
    created_at timestamptz not null default now()
);

create table if not exists quality_questionnaires (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    client_name text not null,
    overall_score integer not null default 0,
    preferred_channel text not null default 'Email',
    preferred_tone text not null default '',
    responses jsonb not null default '{}'::jsonb,
    summary text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists quality_responses (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    profile_id uuid not null references quality_questionnaires(id) on delete cascade,
    quality_score integer not null default 0,
    preferred_channel text not null,
    preferred_tone text not null,
    questionnaire_summary text not null,
    guidance_summary text not null,
    next_action text not null,
    created_at timestamptz not null default now()
);

create table if not exists client_guidance_profiles (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    client_name text not null,
    quality_score integer not null default 0,
    score_trend text not null default 'Stable',
    preferred_channel text not null default 'Email',
    preferred_tone text not null default '',
    questionnaire_summary text not null default '',
    guidance_summary text not null default '',
    next_action text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists ai_provider_accounts (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    provider text not null,
    plan text not null,
    status text not null default 'Configured',
    scope text not null default '',
    purpose text not null default '',
    preferred_for text not null default '',
    notes text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists automation_rules (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    name text not null,
    trigger text not null,
    action text not null,
    channel text not null,
    status text not null default 'Active',
    next_run text not null default '',
    last_run text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists automation_runs (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    rule_id uuid not null references automation_rules(id) on delete cascade,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'queued',
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists matter_context_snapshots (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    summary text not null,
    key_decision text not null,
    unresolved_items text[] not null default '{}'::text[],
    recalled_for text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists matter_events (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid references matters(id) on delete cascade,
    event_type text not null,
    title text not null,
    details text not null default '',
    actor_name text not null default 'System',
    actor_role text not null default 'system',
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_firm_created on notifications(firm_id, created_at desc);
create index if not exists idx_chat_threads_firm_updated on chat_threads(firm_id, updated_at desc);
create index if not exists idx_chat_messages_thread_created on chat_messages(thread_id, created_at asc);
create index if not exists idx_guidance_profiles_firm_updated on client_guidance_profiles(firm_id, updated_at desc);
create index if not exists idx_ai_accounts_firm_updated on ai_provider_accounts(firm_id, updated_at desc);
create index if not exists idx_automation_rules_firm_updated on automation_rules(firm_id, updated_at desc);
create index if not exists idx_memory_snapshots_matter_updated on matter_context_snapshots(matter_id, updated_at desc);
create index if not exists idx_matter_events_matter_created on matter_events(matter_id, created_at desc);

drop trigger if exists trg_notifications_updated_at on notifications;
create trigger trg_notifications_updated_at
before update on notifications
for each row execute function set_updated_at();

drop trigger if exists trg_notification_preferences_updated_at on notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on notification_preferences
for each row execute function set_updated_at();

drop trigger if exists trg_chat_threads_updated_at on chat_threads;
create trigger trg_chat_threads_updated_at
before update on chat_threads
for each row execute function set_updated_at();

drop trigger if exists trg_quality_questionnaires_updated_at on quality_questionnaires;
create trigger trg_quality_questionnaires_updated_at
before update on quality_questionnaires
for each row execute function set_updated_at();

drop trigger if exists trg_client_guidance_profiles_updated_at on client_guidance_profiles;
create trigger trg_client_guidance_profiles_updated_at
before update on client_guidance_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_ai_provider_accounts_updated_at on ai_provider_accounts;
create trigger trg_ai_provider_accounts_updated_at
before update on ai_provider_accounts
for each row execute function set_updated_at();

drop trigger if exists trg_automation_rules_updated_at on automation_rules;
create trigger trg_automation_rules_updated_at
before update on automation_rules
for each row execute function set_updated_at();

drop trigger if exists trg_automation_runs_updated_at on automation_runs;
create trigger trg_automation_runs_updated_at
before update on automation_runs
for each row execute function set_updated_at();

drop trigger if exists trg_matter_context_snapshots_updated_at on matter_context_snapshots;
create trigger trg_matter_context_snapshots_updated_at
before update on matter_context_snapshots
for each row execute function set_updated_at();

alter table notifications enable row level security;
alter table notification_preferences enable row level security;
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
alter table quality_questionnaires enable row level security;
alter table quality_responses enable row level security;
alter table client_guidance_profiles enable row level security;
alter table ai_provider_accounts enable row level security;
alter table automation_rules enable row level security;
alter table automation_runs enable row level security;
alter table matter_context_snapshots enable row level security;
alter table matter_events enable row level security;

create policy "firm members can access notifications" on notifications
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access notification preferences" on notification_preferences
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access chat threads" on chat_threads
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access chat messages" on chat_messages
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access quality questionnaires" on quality_questionnaires
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access quality responses" on quality_responses
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access client guidance profiles" on client_guidance_profiles
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access ai provider accounts" on ai_provider_accounts
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access automation rules" on automation_rules
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access automation runs" on automation_runs
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access matter context snapshots" on matter_context_snapshots
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create policy "firm members can access matter events" on matter_events
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());

create or replace function touch_chat_thread_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    update chat_threads
    set updated_at = now()
    where id = new.thread_id;
    return new;
end;
$$;

drop trigger if exists trg_chat_message_thread_touch on chat_messages;
create trigger trg_chat_message_thread_touch
after insert on chat_messages
for each row execute function touch_chat_thread_activity();
