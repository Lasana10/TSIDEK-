-- Repair a live matter-document schema inconsistency uncovered by actual review testing.
alter table public.documents add column if not exists review_note text;
comment on column public.documents.review_note is 'Professional review decision and required revision context. Not automatically released to clients.';
