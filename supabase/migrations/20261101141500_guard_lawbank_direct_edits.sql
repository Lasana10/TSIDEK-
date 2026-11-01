-- Prevent direct authenticated Data API writes from declaring sources professionally verified
-- or changing already verified source passages. Privileged routes govern reviews.
revoke update on public.legal_source_documents from authenticated;
revoke update,delete on public.legal_source_chunks from authenticated;
-- Existing ingestion uses the backend service-role client.
-- Protect publication status from direct content changes even by service-role bugs:
create or replace function public.tsidek_guard_verified_legal_source()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.verification_status='verified' and (
   new.checksum is distinct from old.checksum or new.source_url is distinct from old.source_url
   or new.canonical_uri is distinct from old.canonical_uri or new.valid_from is distinct from old.valid_from
   or new.valid_until is distinct from old.valid_until or new.version_label is distinct from old.version_label
 ) then raise exception 'Verified legal source cannot be silently modified. Re-ingest a new version and review again.';end if;
 return new;
end $$;
drop trigger if exists tsidek_guard_verified_legal_source on public.legal_source_documents;
create trigger tsidek_guard_verified_legal_source
before update on public.legal_source_documents
for each row execute function public.tsidek_guard_verified_legal_source();
