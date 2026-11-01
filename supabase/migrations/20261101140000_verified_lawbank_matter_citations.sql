-- LawBank: enforce professional validation between extraction and citation.
-- Existing 'ready' material is NOT backfilled as verified.
alter table public.legal_source_documents
 add column if not exists verification_status text not null default 'pending',
 add column if not exists verified_by uuid references auth.users(id) on delete set null,
 add column if not exists verified_at timestamptz,
 add column if not exists review_note text,
 add column if not exists rights_attestation text,
 add column if not exists source_class text not null default 'unclassified';
do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.legal_source_documents'::regclass and conname='tsidek_legal_source_verification_ck') then
  alter table public.legal_source_documents add constraint tsidek_legal_source_verification_ck check (verification_status in ('pending','verified','rejected','revoked'));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.legal_source_documents'::regclass and conname='tsidek_legal_source_class_ck') then
  alter table public.legal_source_documents add constraint tsidek_legal_source_class_ck check (source_class in ('unclassified','official','secondary','internal'));
 end if;
end $$;
create index if not exists tsidek_legal_verified_scope
 on public.legal_source_documents(firm_id,verification_status,ingestion_status,valid_from);

create table if not exists public.tsidek_legal_source_reviews(
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 source_document_id uuid not null references public.legal_source_documents(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 action text not null check (action in ('verify','reject','revoke')),
 source_class text not null check (source_class in ('official','secondary','internal','unclassified')),
 review_note text not null,
 rights_attestation text,
 content_checksum text not null,
 created_at timestamptz not null default now()
);
create index if not exists tsidek_legal_source_reviews_source
 on public.tsidek_legal_source_reviews(source_document_id,created_at desc);
alter table public.tsidek_legal_source_reviews enable row level security;
revoke all on public.tsidek_legal_source_reviews from public,anon,authenticated;
grant select,insert on public.tsidek_legal_source_reviews to service_role;

create table if not exists public.tsidek_matter_source_citations(
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 source_document_id uuid not null references public.legal_source_documents(id) on delete restrict,
 chunk_id uuid not null references public.legal_source_chunks(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict,
 citation_note text,
 source_title text not null,
 source_checksum text not null,
 source_version text,
 quoted_excerpt text not null,
 verified_at_snapshot timestamptz not null,
 cited_at timestamptz not null default now(),
 unique(matter_id,chunk_id)
);
create index if not exists tsidek_matter_source_citations_matter
 on public.tsidek_matter_source_citations(firm_id,matter_id,cited_at desc);
alter table public.tsidek_matter_source_citations enable row level security;
revoke all on public.tsidek_matter_source_citations from public,anon,authenticated;
grant select,insert on public.tsidek_matter_source_citations to service_role;

create or replace function public.tsidek_review_legal_source(
 p_firm_id uuid,p_reviewer_id uuid,p_source_id uuid,
 p_action text,p_source_class text,p_note text,p_rights_attestation text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare source_row public.legal_source_documents%rowtype;
 v_count integer;v_status text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if not exists(select 1 from public.firm_memberships fm join public.lawyers l on l.id=fm.user_id
   where fm.firm_id=p_firm_id and fm.user_id=p_reviewer_id and fm.status='active'
   and lower(fm.role_key) in ('owner','partner','managing_partner','admin'))
 then raise exception 'Active firm legal-source governor required';end if;
 if p_action not in ('verify','reject','revoke') then raise exception 'Invalid review action';end if;
 if p_source_class not in ('official','secondary','internal','unclassified') then raise exception 'Invalid source class';end if;
 if length(trim(coalesce(p_note,'')))<20 then raise exception 'Specific professional review rationale of at least 20 characters required';end if;
 select * into source_row from public.legal_source_documents
  where id=p_source_id and firm_id=p_firm_id and source_scope='firm' for update;
 if not found then raise exception 'Firm source not found';end if;
 if p_action='verify' then
  if source_row.ingestion_status not in ('ready','needs_review') then raise exception 'Text extraction and chunking must finish before verification';end if;
  select count(*) into v_count from public.legal_source_chunks
   where source_document_id=source_row.id and firm_id=p_firm_id;
  if v_count=0 then raise exception 'Verified source requires readable indexed text';end if;
  if length(trim(coalesce(p_rights_attestation,'')))<20 then raise exception 'Document-specific lawful-use/rights assessment required';end if;
  if source_row.valid_from is not null and source_row.valid_until is not null and source_row.valid_from>source_row.valid_until
  then raise exception 'Effective-date range is invalid';end if;
  v_status:='verified';
 elsif p_action='reject' then v_status:='rejected';
 else v_status:='revoked'; end if;
 if source_row.verification_status=v_status then
  return jsonb_build_object('source_id',source_row.id,'verification_status',v_status,'created',false);
 end if;
 update public.legal_source_documents
 set verification_status=v_status,
     verified_by=case when v_status='verified' then p_reviewer_id else null end,
     verified_at=case when v_status='verified' then now() else null end,
     review_note=left(trim(p_note),3000),
     rights_attestation=case when v_status='verified' then left(trim(p_rights_attestation),3000) else null end,
     source_class=p_source_class,updated_at=now()
 where id=source_row.id;
 insert into public.tsidek_legal_source_reviews
 (firm_id,source_document_id,reviewer_id,action,source_class,review_note,rights_attestation,content_checksum)
 values(p_firm_id,p_source_id,p_reviewer_id,p_action,p_source_class,left(trim(p_note),3000),
  nullif(left(trim(coalesce(p_rights_attestation,'')),3000),''),source_row.checksum);
 return jsonb_build_object('source_id',source_row.id,'verification_status',v_status,'created',true);
end $$;
revoke all on function public.tsidek_review_legal_source(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.tsidek_review_legal_source(uuid,uuid,uuid,text,text,text,text) to service_role;

-- Current and date-aware, permissioned, ONLY professionally verified sources.
-- The stored full-text index is reused. No AI text is invented to fill missing law.
create or replace function public.tsidek_search_verified_legal_chunks(
 search_query text,requested_firm_id uuid,match_count integer,p_as_of_date date
) returns table(
 chunk_id uuid,source_document_id uuid,authority_id uuid,title text,jurisdiction text,
 section_path text,content text,source_url text,canonical_uri text,rank real,
 publisher text,version_label text,valid_from date,valid_until date,
 source_checksum text,verified_at timestamptz,source_class text
) language sql stable security invoker set search_path='' as $$
 select c.id,c.source_document_id,c.authority_id,d.title,d.jurisdiction,
 c.section_path,c.content,d.source_url,d.canonical_uri,
 ts_rank_cd(c.content_tsv,websearch_to_tsquery('simple',search_query))::real,
 d.publisher,d.version_label,d.valid_from,d.valid_until,d.checksum,d.verified_at,d.source_class
 from public.legal_source_chunks c
 join public.legal_source_documents d on d.id=c.source_document_id
 where requested_firm_id=tsidek_private.current_firm_id()
  and (d.source_scope='public' or d.firm_id=requested_firm_id)
  and d.verification_status='verified' and d.ingestion_status='ready'
  and d.verified_at is not null and nullif(d.rights_attestation,'') is not null
  and (d.valid_from is null or d.valid_from<=coalesce(p_as_of_date,current_date))
  and (d.valid_until is null or d.valid_until>=coalesce(p_as_of_date,current_date))
  and c.content_tsv @@ websearch_to_tsquery('simple',search_query)
 order by 10 desc,c.chunk_index asc
 limit greatest(1,least(match_count,30));
$$;
revoke all on function public.tsidek_search_verified_legal_chunks(text,uuid,integer,date) from public,anon;
grant execute on function public.tsidek_search_verified_legal_chunks(text,uuid,integer,date) to authenticated;

-- Maintain the existing RPC contract while closing the unverified-corpus bypass.
create or replace function public.search_legal_source_chunks(
 search_query text,requested_firm_id uuid,match_count integer default 12
) returns table(chunk_id uuid,source_document_id uuid,authority_id uuid,title text,
 jurisdiction text,section_path text,content text,source_url text,canonical_uri text,rank real)
 language sql stable security invoker set search_path='' as $$
 select v.chunk_id,v.source_document_id,v.authority_id,v.title,v.jurisdiction,
 v.section_path,v.content,v.source_url,v.canonical_uri,v.rank
 from public.tsidek_search_verified_legal_chunks(search_query,requested_firm_id,match_count,current_date) v;
$$;
revoke all on function public.search_legal_source_chunks(text,uuid,integer) from public,anon;
grant execute on function public.search_legal_source_chunks(text,uuid,integer) to authenticated;

create or replace function public.tsidek_save_matter_source_citation(
 p_firm_id uuid,p_matter_id uuid,p_author_id uuid,p_chunk_id uuid,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.legal_source_documents%rowtype;
 v_chunk public.legal_source_chunks%rowtype;v_saved public.tsidek_matter_source_citations%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if not exists(select 1 from public.firm_memberships fm join public.lawyers l on l.id=fm.user_id
   where fm.firm_id=p_firm_id and fm.user_id=p_author_id and fm.status='active')
 then raise exception 'Active firm member required';end if;
 if not exists(select 1 from public.matters m where m.id=p_matter_id and m.firm_id=p_firm_id and m.status<>'Closed')
 then raise exception 'Active matter required';end if;
 select * into v_chunk from public.legal_source_chunks where id=p_chunk_id;
 if not found then raise exception 'Source passage not found';end if;
 select * into v_source from public.legal_source_documents
  where id=v_chunk.source_document_id and (firm_id=p_firm_id or source_scope='public');
 if not found or v_source.verification_status<>'verified' or v_source.ingestion_status<>'ready'
    or v_source.verified_at is null or nullif(v_source.rights_attestation,'') is null
    or (v_source.valid_from is not null and v_source.valid_from>current_date)
    or (v_source.valid_until is not null and v_source.valid_until<current_date)
 then raise exception 'Only current, verified, lawful-use legal source passages may be cited';end if;
 insert into public.tsidek_matter_source_citations
  (firm_id,matter_id,source_document_id,chunk_id,created_by,citation_note,source_title,
   source_checksum,source_version,quoted_excerpt,verified_at_snapshot)
 values(p_firm_id,p_matter_id,v_source.id,v_chunk.id,p_author_id,
  nullif(left(trim(coalesce(p_note,'')),1000),''),v_source.title,v_source.checksum,
  v_source.version_label,left(v_chunk.content,2400),v_source.verified_at)
 on conflict(matter_id,chunk_id) do nothing returning * into v_saved;
 if not found then
  select * into v_saved from public.tsidek_matter_source_citations
   where matter_id=p_matter_id and chunk_id=p_chunk_id;
  return jsonb_build_object('id',v_saved.id,'created',false);
 end if;
 insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
 values(p_firm_id,p_matter_id,'LEGAL_SOURCE_CITED','Verified legal source attached to matter',
 'Citation provenance and verification snapshot recorded','Authorized professional','Matter researcher',
 jsonb_build_object('citation_id',v_saved.id,'source_id',v_source.id,'chunk_id',v_chunk.id));
 return jsonb_build_object('id',v_saved.id,'created',true);
end $$;
revoke all on function public.tsidek_save_matter_source_citation(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.tsidek_save_matter_source_citation(uuid,uuid,uuid,uuid,text) to service_role;
