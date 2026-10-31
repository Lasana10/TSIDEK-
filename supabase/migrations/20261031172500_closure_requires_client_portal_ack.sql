-- Upgrade closure acceptance from staff-reported sent status to independently acknowledged portal publication.
-- Closure is a single governed transaction. Server permission checks precede
-- this RPC; the function rechecks active membership and actual evidence.
create or replace function public.tsidek_approve_matter_closure(
  p_firm_id uuid,p_matter_id uuid,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_matter public.matters%rowtype;
  v_review public.matter_closure_reviews%rowtype;
  v_outcome_id uuid;
  v_actor_name text;
  v_actor_role text;
  v_finance_status text;
  v_client_status text;
  v_delivery_status text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
  if p_firm_id is null or p_matter_id is null or p_actor_id is null then
    raise exception 'Firm, matter and actor are required.';
  end if;
  select l.full_name,fm.role_key into v_actor_name,v_actor_role
  from public.firm_memberships fm join public.lawyers l on l.id=fm.user_id
  where fm.firm_id=p_firm_id and fm.user_id=p_actor_id and fm.status='active'
  for share of fm;
  if not found then raise exception 'Active firm authority is required.'; end if;
  select * into v_matter from public.matters
  where id=p_matter_id and firm_id=p_firm_id for update;
  if not found then raise exception 'Matter not found in this firm.'; end if;
  if v_matter.status='Closed' then
    select id into v_outcome_id from public.matter_outcomes
    where matter_id=p_matter_id and firm_id=p_firm_id order by created_at desc limit 1;
    return jsonb_build_object('outcomeId',v_outcome_id,'closed',true,'created',false);
  end if;
  select * into v_review from public.matter_closure_reviews
  where matter_id=p_matter_id and firm_id=p_firm_id for update;
  if not found then raise exception 'Closure review is missing.'; end if;
  if exists (select 1 from public.tasks where matter_id=p_matter_id and not is_completed)
    then raise exception 'Open tasks remain.'; end if;
  select status into v_finance_status from public.finance_reconciliation_reviews
  where matter_id=p_matter_id and firm_id=p_firm_id order by created_at desc limit 1;
  if v_finance_status not in ('approved','matched') or v_finance_status is null
    or not v_review.financial_reconciled then
    raise exception 'Finance reconciliation evidence is incomplete.';
  end if;
  if not v_review.obligations_resolved then raise exception 'Outstanding obligations remain.'; end if;
  if not exists (select 1 from public.documents where matter_id=p_matter_id)
    or exists (select 1 from public.documents where matter_id=p_matter_id
      and lower(coalesce(status,'')) not in ('archived','filed'))
    or not v_review.documents_archived then
    raise exception 'Documents are not fully archived or filed.';
  end if;
  select status,delivery_status into v_client_status,v_delivery_status
  from public.matter_client_updates where matter_id=p_matter_id and firm_id=p_firm_id
  order by created_at desc limit 1;
  -- Only a real authenticated client's recorded acknowledgment of the latest
  -- published update qualifies. A staff-entered Sent/Delivered flag does not.
  if not exists (
    select 1 from public.matter_client_updates u
    join public.tsidek_client_update_publications p
      on p.update_id=u.id and p.matter_id=u.matter_id and p.firm_id=u.firm_id
    join public.tsidek_client_update_acknowledgements a
      on a.publication_id=p.id and a.update_id=u.id and a.matter_id=u.matter_id
    where u.firm_id=p_firm_id and u.matter_id=p_matter_id
      and u.status='Published' and a.client_auth_user_id is not null
      and u.id=(
        select cu.id from public.matter_client_updates cu
        where cu.firm_id=p_firm_id and cu.matter_id=p_matter_id
          and cu.status='Published'
        order by cu.created_at desc,cu.id desc limit 1
      )
  ) or not v_review.client_notified then
    raise exception 'Authenticated client portal acknowledgment of the latest published update is incomplete.';
  end if;
  if not v_review.knowledge_reviewed or nullif(btrim(v_review.outcome_summary),'') is null
    then raise exception 'Outcome and knowledge review is incomplete.'; end if;

  select id into v_outcome_id from public.matter_outcomes
  where matter_id=p_matter_id and firm_id=p_firm_id order by created_at desc limit 1;
  if v_outcome_id is null then
    insert into public.matter_outcomes(firm_id,matter_id,outcome_type,title,result_summary,
      client_result,reusable_lesson,precedent_candidate,knowledge_status)
    values(p_firm_id,p_matter_id,'matter_result','Outcome — '||v_matter.title,
      v_review.outcome_summary,v_review.client_outcome,v_review.lessons_learned,
      nullif(btrim(v_review.lessons_learned),'') is not null,'draft')
    returning id into v_outcome_id;
  end if;
  update public.matter_closure_reviews set approved_by=p_actor_id,approved_at=now(),updated_at=now()
  where id=v_review.id;
  update public.matters set status='Closed',closed_at=now(),updated_at=now()
  where id=p_matter_id and firm_id=p_firm_id;
  update public.matter_workflow_instances set status='completed',current_stage_key='closed',
    completed_at=now(),updated_at=now() where matter_id=p_matter_id and firm_id=p_firm_id;
  insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
  values(p_firm_id,p_matter_id,'MATTER_CLOSED','Matter formally closed',v_review.outcome_summary,
    coalesce(v_actor_name,'Authorized lawyer'),coalesce(v_actor_role,'lawyer'),
    jsonb_build_object('outcomeId',v_outcome_id));
  return jsonb_build_object('outcomeId',v_outcome_id,'closed',true,'created',true);
end;
$$;
revoke all on function public.tsidek_approve_matter_closure(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tsidek_approve_matter_closure(uuid,uuid,uuid) to service_role;
