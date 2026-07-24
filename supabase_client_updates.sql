-- TSIDEK controlled client communication ledger.
-- Run after supabase_schema.sql and supabase_intake_workflow.sql.

create table if not exists matter_client_updates (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    channel text not null default 'Email' check (channel in ('In-app', 'Email', 'WhatsApp', 'SMS')),
    title text not null,
    message text not null,
    status text not null default 'Draft' check (status in ('Draft', 'Approved', 'Queued', 'Sent', 'Delivered', 'Acknowledged', 'Needs revision')),
    recipient text,
    delivery_note text,
    drafted_by uuid references lawyers(id),
    approved_by uuid references lawyers(id),
    approved_at timestamptz,
    dispatched_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_matter_client_updates_firm_created on matter_client_updates(firm_id, created_at desc);
create index if not exists idx_matter_client_updates_matter_created on matter_client_updates(matter_id, created_at desc);
create index if not exists idx_matter_client_updates_status on matter_client_updates(firm_id, status, updated_at desc);

drop trigger if exists trg_matter_client_updates_updated_at on matter_client_updates;
create trigger trg_matter_client_updates_updated_at
before update on matter_client_updates
for each row execute function set_updated_at();

alter table matter_client_updates enable row level security;

create policy "firm members can access matter client updates" on matter_client_updates
for all using (firm_id = current_firm_id())
with check (firm_id = current_firm_id());
