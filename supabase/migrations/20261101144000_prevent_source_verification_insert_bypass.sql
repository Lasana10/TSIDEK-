-- Source creation and chunk writes go through the authenticated server intake only.
-- Ordinary authenticated Data API writers must not declare unreviewed law VERIFIED on INSERT.
revoke insert,update,delete on public.legal_source_documents from authenticated;
revoke insert,update,delete on public.legal_source_chunks from authenticated;
-- Defense in depth: no new source may self-assert verified at insertion,
-- even if a server code path accidentally submits verification metadata.
create or replace function public.tsidek_initial_legal_source_review_state()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.verification_status is distinct from 'pending'
    or new.verified_by is not null or new.verified_at is not null
    or new.rights_attestation is not null then
   raise exception 'Sources must enter through pending professional verification';
 end if;
 return new;
end $$;
drop trigger if exists tsidek_initial_legal_source_review_state on public.legal_source_documents;
create trigger tsidek_initial_legal_source_review_state before insert on public.legal_source_documents
for each row execute function public.tsidek_initial_legal_source_review_state();
