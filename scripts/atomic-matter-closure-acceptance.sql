-- Synthetic matter under an existing active member. This transaction rolls back.
begin;
do $$
declare
  v_firm uuid;
  v_actor uuid;
  v_matter uuid;
  v_first jsonb;
  v_retry jsonb;
begin
  select fm.firm_id,fm.user_id into v_firm,v_actor
  from public.firm_memberships fm join public.lawyers l on l.id=fm.user_id
  where fm.status='active' limit 1;
  if v_actor is null then raise exception 'No active member for controlled fixture.'; end if;
  if has_function_privilege('authenticated','public.tsidek_approve_matter_closure(uuid,uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.tsidek_approve_matter_closure(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Closure RPC execute grants are incorrect.';
  end if;
  insert into public.matters(firm_id,title,client_name,status,risk_level)
  values(v_firm,'TSIDEK CLOSURE ROLLBACK FIXTURE','Synthetic client','Active','Low')
  returning id into v_matter;
  insert into public.matter_closure_reviews(firm_id,matter_id,outcome_summary,
    financial_reconciled,obligations_resolved,documents_archived,client_notified,knowledge_reviewed)
  values(v_firm,v_matter,'Synthetic outcome for rollback acceptance.',true,true,true,true,true);
  begin
    perform public.tsidek_approve_matter_closure(v_firm,v_matter,v_actor);
    raise exception 'Checkboxes bypassed missing finance evidence.';
  exception when others then
    if sqlerrm <> 'Finance reconciliation evidence is incomplete.' then raise; end if;
  end;
  if (select status from public.matters where id=v_matter) <> 'Active' then
    raise exception 'Rejected closure changed the matter.';
  end if;
  insert into public.finance_reconciliation_reviews(firm_id,matter_id,status)
  values(v_firm,v_matter,'approved');
  insert into public.documents(matter_id,title,status,document_status)
  values(v_matter,'Synthetic filed closing record','Filed','Filed');
  insert into public.matter_client_updates(firm_id,matter_id,title,body,status,delivery_status)
  values(v_firm,v_matter,'Synthetic delivery','Controlled rollback fixture.','Sent','sent');
  v_first := public.tsidek_approve_matter_closure(v_firm,v_matter,v_actor);
  v_retry := public.tsidek_approve_matter_closure(v_firm,v_matter,v_actor);
  if v_first->>'created'<>'true' or v_retry->>'created'<>'false'
    or v_retry->>'outcomeId' is distinct from v_first->>'outcomeId'
    or (select status from public.matters where id=v_matter)<>'Closed'
    or (select count(*) from public.matter_outcomes where matter_id=v_matter)<>1
    or (select count(*) from public.matter_events where matter_id=v_matter and event_type='MATTER_CLOSED')<>1
    or (select approved_by from public.matter_closure_reviews where matter_id=v_matter) is distinct from v_actor then
    raise exception 'Closure transaction or retry acceptance failed.';
  end if;
  raise notice 'Controlled closure acceptance passed; rolling back.';
end;
$$;
rollback;
