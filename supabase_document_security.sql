-- TSIDEK document security and client-sharing controls.
-- Run after supabase_schema.sql and supabase_document_control.sql.

alter table if exists documents
  add column if not exists access_level text not null default 'Matter team'
    check (access_level in ('Matter team', 'Lead+Partner'));

alter table if exists documents
  add column if not exists sharing_policy text not null default 'Internal only'
    check (sharing_policy in ('Internal only', 'Client-share ready', 'Blocked'));

create index if not exists idx_documents_matter_access_level
  on documents(matter_id, access_level);

create index if not exists idx_documents_matter_sharing_policy
  on documents(matter_id, sharing_policy);
