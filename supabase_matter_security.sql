-- Matter security hardening for TSIDEK.
-- Adds enforceable matter classification and explicit allowed/screened access overrides.

alter table matters
  add column if not exists security_classification text not null default 'Standard'
    check (security_classification in ('Standard', 'Confidential', 'Partner-only')),
  add column if not exists ethical_wall_enabled boolean not null default false;

create table if not exists matter_access_overrides (
  id uuid primary key default uuid_generate_v4(),
  matter_id uuid not null references matters(id) on delete cascade,
  lawyer_id uuid not null references lawyers(id) on delete cascade,
  access_status text not null check (access_status in ('allowed', 'screened')),
  reason text,
  created_at timestamptz not null default now(),
  unique (matter_id, lawyer_id)
);

create index if not exists idx_matter_access_overrides_matter_id on matter_access_overrides(matter_id);
create index if not exists idx_matter_access_overrides_lawyer_id on matter_access_overrides(lawyer_id);

alter table matter_access_overrides enable row level security;

create policy "firm members can access matter access overrides"
  on matter_access_overrides
  for all
  using (
    exists (
      select 1
      from matters
      where matters.id = matter_access_overrides.matter_id
        and matters.firm_id = current_firm_id()
    )
  )
  with check (
    exists (
      select 1
      from matters
      where matters.id = matter_access_overrides.matter_id
        and matters.firm_id = current_firm_id()
    )
  );
