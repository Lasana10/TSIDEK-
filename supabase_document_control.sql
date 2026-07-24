-- TSIDEK document control enrichment.
-- Run after supabase_schema.sql.

alter table if exists documents
  add column if not exists document_status text not null default 'Draft'
    check (document_status in ('Draft', 'Final', 'Filed', 'Archived'));

alter table if exists documents
  add column if not exists review_status text not null default 'Working'
    check (review_status in ('Working', 'Internal review', 'Approved', 'Needs revision'));

alter table if exists documents
  add column if not exists version_label text;

alter table if exists documents
  add column if not exists filed_at timestamptz;

alter table if exists documents
  add column if not exists review_note text;

create index if not exists idx_documents_matter_created on documents(matter_id, created_at desc);
create index if not exists idx_documents_matter_status on documents(matter_id, document_status, review_status);
