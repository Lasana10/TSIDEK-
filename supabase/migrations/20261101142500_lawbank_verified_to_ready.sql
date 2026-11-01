-- A professionally verified and chunked source becomes searchable atomically.
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
     ingestion_status=case when v_status='verified' then 'ready' else ingestion_status end,
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
