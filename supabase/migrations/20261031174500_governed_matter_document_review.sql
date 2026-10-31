-- A stored, reviewed matter document is required before filing and client sharing.
create or replace function public.tsidek_transition_document_review(
 p_firm_id uuid,p_matter_id uuid,p_actor_id uuid,p_document_id uuid,p_action text,p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype;m public.matters%rowtype;
 actor_name text;actor_role text;v_path text;v_new text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 select l.full_name,fm.role_key into actor_name,actor_role
 from public.lawyers l join public.firm_memberships fm on fm.user_id=l.id and fm.firm_id=p_firm_id and fm.status='active'
 where l.id=p_actor_id;
 if not found then raise exception 'Active professional membership is required';end if;
 select * into m from public.matters where firm_id=p_firm_id and id=p_matter_id for update;
 if not found or m.status='Closed' then raise exception 'Active matter required';end if;
 select * into d from public.documents where id=p_document_id and matter_id=p_matter_id for update;
 if not found then raise exception 'Document not in this matter';end if;
 if p_action not in ('submit','approve','return','file','archive','share','unshare') then raise exception 'Unsupported document action';end if;
 if p_action='submit' then
  if lower(d.review_status) not in ('working','not reviewed','needs revision') then raise exception 'Document cannot be resubmitted at this stage';end if;
  update public.documents set review_status='Internal review',updated_at=now(),
    review_note=nullif(left(trim(coalesce(p_note,'')),2000),'') where id=d.id;
  v_new:='Internal review';
 elsif p_action='return' then
  if d.review_status not in ('Internal review','Approved') then raise exception 'Only submitted or approved documents can be returned';end if;
  if length(trim(coalesce(p_note,'')))<8 then raise exception 'Review reason required';end if;
  update public.documents set review_status='Needs revision',sharing_policy='Internal only',
    approved_at=null,approved_by=null,review_note=left(trim(p_note),2000),updated_at=now() where id=d.id;
  v_new:='Needs revision';
 else
  if nullif(trim(coalesce(d.storage_path,'')),'') is null then
   raise exception 'Stored original document required';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id='tsidek-vault' and o.name=d.storage_path)
  then raise exception 'Original document object missing from private vault';end if;
  if p_action='approve' then
   if d.review_status<>'Internal review' then raise exception 'Document must be under review';end if;
   update public.documents set review_status='Approved',reviewed_by=p_actor_id,
    reviewed_at=now(),approved_by=p_actor_id,approved_at=now(),updated_at=now(),
    review_note=nullif(left(trim(coalesce(p_note,'')),2000),'') where id=d.id;
   v_new:='Approved';
  elsif p_action='file' then
   if d.review_status<>'Approved' then raise exception 'Professional approval is required before filing';end if;
   if lower(d.status) in ('filed','archived') then
    return jsonb_build_object('document_id',d.id,'status',d.status,'created',false);
   end if;
   update public.documents set status='Filed',document_status='Filed',filed_at=now(),
    updated_at=now() where id=d.id;
   v_new:='Filed';
  elsif p_action='archive' then
   if lower(d.status)<>'filed' or d.review_status<>'Approved' then raise exception 'Approved filed document is required before archiving';end if;
   update public.documents set status='Archived',document_status='Archived',
    updated_at=now() where id=d.id;
   v_new:='Archived';
  elsif p_action='share' then
   if lower(d.status) not in ('filed','archived') or d.review_status<>'Approved'
   then raise exception 'Only approved, filed documents can be client-shared';end if;
   update public.documents set sharing_policy='Client-share ready',updated_at=now() where id=d.id;
   v_new:='Client-share ready';
  elsif p_action='unshare' then
   update public.documents set sharing_policy='Internal only',updated_at=now() where id=d.id;
   v_new:='Internal only';
  end if;
 end if;
 insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
 values(p_firm_id,p_matter_id,'DOCUMENT_REVIEW_'||upper(p_action),
  'Governed document '||p_action,'Document decision recorded by authorized professional',
  coalesce(actor_name,'Professional'),coalesce(actor_role,'Firm role'),
  jsonb_build_object('document_id',d.id,'action',p_action,'state',v_new));
 return jsonb_build_object('document_id',d.id,'state',v_new,'created',true);
end $$;
revoke all on function public.tsidek_transition_document_review(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.tsidek_transition_document_review(uuid,uuid,uuid,uuid,text,text) to service_role;
