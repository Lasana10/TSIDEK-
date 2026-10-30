-- Run against the intended TSIDEK database. Everything here is rolled back.
-- Uses an existing active member only as an authorization fixture; creates no
-- permanent client, matter, document, task or event.
begin;
do $$
declare
  v_firm uuid;
  v_actor uuid;
  v_prospect uuid;
  v_blocked uuid;
  v_first jsonb;
  v_retry jsonb;
  v_matter uuid;
begin
  select fm.firm_id,fm.user_id into v_firm,v_actor
  from public.firm_memberships fm join public.lawyers l on l.id=fm.user_id
  where fm.status='active' limit 1;
  if v_actor is null then raise exception 'No active firm member fixture available.'; end if;
  if has_function_privilege('authenticated','public.tsidek_open_matter_from_intake(uuid,uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.tsidek_open_matter_from_intake(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Intake RPC execute grants are incorrect.';
  end if;
  insert into public.prospects(firm_id,prospect_name,matter_summary,proposed_matter_type,jurisdiction)
  values(v_firm,'TSIDEK CONTROLLED ROLLBACK FIXTURE','Synthetic intake for transaction acceptance.','Advisory','Cameroon')
  returning id into v_prospect;
  insert into public.conflict_checks(firm_id,prospect_id,status)
  values(v_firm,v_prospect,'Cleared');
  insert into public.engagements(firm_id,prospect_id,fee_model,scope_of_work,approval_status)
  values(v_firm,v_prospect,'Fixed fee','Synthetic acceptance scope','Approved');
  insert into public.prospect_kyc_reviews(firm_id,prospect_id,subject_type,legal_name,
    pep_status,sanctions_status,adverse_media_status,risk_rating,status)
  values(v_firm,v_prospect,'individual','TSIDEK CONTROLLED ROLLBACK FIXTURE',
    'clear','clear','clear','low','cleared');
  insert into public.matter_opening_checklists(firm_id,prospect_id,responsible_lawyer_assigned,
    responsible_lawyer_id,initial_deadline_reviewed,opening_documents_ready)
  values(v_firm,v_prospect,true,v_actor,true,true);
  v_first := public.tsidek_open_matter_from_intake(v_firm,v_prospect,v_actor);
  v_retry := public.tsidek_open_matter_from_intake(v_firm,v_prospect,v_actor);
  v_matter := (v_first->>'matterId')::uuid;
  if v_first->>'created' <> 'true' or v_retry->>'created' <> 'false'
    or (v_retry->>'matterId')::uuid is distinct from v_matter then
    raise exception 'Matter opening retry was not idempotent.';
  end if;
  if (select count(*) from public.matters where id=v_matter)<>1
    or (select count(*) from public.matter_members where matter_id=v_matter)<>1
    or (select count(*) from public.physical_files where matter_id=v_matter)<>1
    or (select count(*) from public.tasks where matter_id=v_matter)<>1
    or (select count(*) from public.documents where matter_id=v_matter)<>1
    or (select count(*) from public.intake_decision_events where matter_id=v_matter and event_type='matter_opened')<>1
    or (select count(*) from public.matter_events where matter_id=v_matter and event_type='MATTER_OPENED')<>1
    or (select matter_id from public.prospects where id=v_prospect) is distinct from v_matter
    or (select matter_id from public.matter_opening_checklists where prospect_id=v_prospect) is distinct from v_matter then
    raise exception 'Matter opening did not connect all required records exactly once.';
  end if;
  insert into public.prospects(firm_id,prospect_name,matter_summary,proposed_matter_type)
  values(v_firm,'TSIDEK BLOCKED ROLLBACK FIXTURE','Synthetic blocked assessment.','Advisory')
  returning id into v_blocked;
  begin
    perform public.tsidek_open_matter_from_intake(v_firm,v_blocked,v_actor);
    raise exception 'Opening bypassed conflict and KYC gates.';
  exception when others then
    if sqlerrm <> 'Matter opening controls are missing.' then raise; end if;
  end;
  if (select matter_id from public.prospects where id=v_blocked) is not null then
    raise exception 'Blocked assessment was converted.';
  end if;
  raise notice 'Atomic intake acceptance passed within rollback transaction.';
end;
$$;
rollback;
