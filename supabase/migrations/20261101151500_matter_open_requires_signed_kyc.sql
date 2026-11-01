-- Matter conversion rejects forged or stale KYC clearance even if UI reports success.
CREATE OR REPLACE FUNCTION public.tsidek_open_matter_from_intake(p_firm_id uuid, p_prospect_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_prospect public.prospects%rowtype;
  v_checklist public.matter_opening_checklists%rowtype;
  v_conflict public.conflict_checks%rowtype;
  v_engagement public.engagements%rowtype;
  v_kyc public.prospect_kyc_reviews%rowtype;
  v_matter public.matters%rowtype;
  v_actor_name text;
  v_actor_role text;
  v_type text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
  if p_firm_id is null or p_prospect_id is null or p_actor_id is null then
    raise exception 'Firm, assessment and actor are required.';
  end if;
  select l.full_name, fm.role_key into v_actor_name, v_actor_role
  from public.firm_memberships fm
  join public.lawyers l on l.id = fm.user_id
  where fm.firm_id = p_firm_id and fm.user_id = p_actor_id and fm.status = 'active'
  for share of fm;
  if not found then raise exception 'Active firm authority is required.'; end if;

  select * into v_prospect from public.prospects
  where id = p_prospect_id and firm_id = p_firm_id for update;
  if not found then raise exception 'Assessment not found.'; end if;
  if v_prospect.matter_id is not null then
    return jsonb_build_object('matterId',v_prospect.matter_id,'created',false);
  end if;

  select * into v_checklist from public.matter_opening_checklists
  where prospect_id = p_prospect_id and firm_id = p_firm_id
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Matter opening controls are missing.'; end if;
  select * into v_conflict from public.conflict_checks
  where prospect_id = p_prospect_id and firm_id = p_firm_id
  order by created_at desc limit 1;
  if v_conflict.status not in ('Cleared','Waived') or v_conflict.status is null then
    raise exception 'Conflict review must be cleared or formally waived before opening the matter.';
  end if;
  select * into v_kyc from public.prospect_kyc_reviews
  where prospect_id = p_prospect_id and firm_id = p_firm_id
  order by created_at desc limit 1;
  if v_kyc.status is distinct from 'cleared' or v_kyc.reviewed_by is null
     or v_kyc.reviewed_at is null or length(trim(coalesce(v_kyc.decision_note,'')))<20
     or v_kyc.risk_rating='prohibited'
     or v_kyc.pep_status<>'clear' or v_kyc.sanctions_status<>'clear'
     or v_kyc.adverse_media_status<>'clear'
     or (v_kyc.expires_at is not null and v_kyc.expires_at<=now())
     or not exists(
      select 1 from public.firm_memberships fm
      where fm.firm_id=p_firm_id and fm.user_id=v_kyc.reviewed_by and fm.status='active'
        and (fm.role_key in ('owner','partner','managing_partner') or fm.governance_role_key in ('founder','firm_head'))
     ) then
    raise exception 'Current, signed KYC screening clearance is required before opening the matter.';
  end if;
  select * into v_engagement from public.engagements
  where prospect_id = p_prospect_id and firm_id = p_firm_id
  order by created_at desc limit 1;
  if v_engagement.approval_status is distinct from 'Approved' then
    raise exception 'Engagement approval is required before opening the matter.';
  end if;
  if not v_checklist.responsible_lawyer_assigned or v_checklist.responsible_lawyer_id is null
    or not exists (select 1 from public.firm_memberships where user_id=v_checklist.responsible_lawyer_id
      and firm_id=p_firm_id and status='active') then
    raise exception 'Assign a responsible lawyer in this firm before opening the matter.';
  end if;
  if not v_checklist.initial_deadline_reviewed then
    raise exception 'Record the initial deadline review before opening the matter.';
  end if;
  if not v_checklist.opening_documents_ready then
    raise exception 'Confirm the opening file structure before opening the matter.';
  end if;
  if v_prospect.primary_party_id is not null and not exists
    (select 1 from public.parties where id=v_prospect.primary_party_id and firm_id=p_firm_id) then
    raise exception 'The primary client is outside this firm.';
  end if;

  v_type := coalesce(nullif(v_prospect.proposed_matter_type,''),'General legal matter');
  insert into public.matters (
    firm_id,title,client_name,matter_type,jurisdiction,risk_level,status,synopsis,
    primary_track,risk_to_monitor,ai_usage_rule,next_draft,lead_lawyer_id,record_state,
    engagement_nature,service_type,client_objective,plan_label,client_party_id
  ) values (
    p_firm_id,v_prospect.prospect_name||' - '||v_type,v_prospect.prospect_name,v_type,
    coalesce(nullif(v_prospect.jurisdiction,''),'Cameroon'),
    case when v_conflict.status='Waived' or v_kyc.risk_rating='high' then 'High'
      when v_prospect.risk_level in ('Low','Medium','High') then v_prospect.risk_level else 'Medium' end,
    'Active',coalesce(nullif(v_prospect.matter_summary,''),'Matter opened from assessment.'),
    'Matter opening and first working plan',
    coalesce(nullif(btrim(v_checklist.initial_deadline_notes),''),'Initial deadline review completed; continue procedural monitoring.'),
    'AI suggestions require human review and matter confidentiality policy applies.',
    'Opening memorandum',v_checklist.responsible_lawyer_id,'active','custom',v_type,
    v_prospect.matter_summary,'Matter plan',v_prospect.primary_party_id
  ) returning * into v_matter;

  insert into public.matter_members(matter_id,lawyer_id,is_primary)
  values (v_matter.id,v_checklist.responsible_lawyer_id,true);
  if p_actor_id <> v_checklist.responsible_lawyer_id then
    insert into public.matter_members(matter_id,lawyer_id,is_primary)
    values (v_matter.id,p_actor_id,false);
  end if;
  insert into public.physical_files (
    matter_id,file_code,label,location,custody_status,qr_payload,qr_destination,
    barcode_value,verification_status
  ) values (
    v_matter.id,v_matter.case_reference,v_prospect.prospect_name||' — '||v_matter.title,
    'Registry / not yet assigned','Registered','/matters/'||v_matter.id,
    '/matters/'||v_matter.id,v_matter.case_reference,'UNVERIFIED'
  );
  insert into public.tasks(matter_id,title,description,assigned_to,status,is_completed)
  values (v_matter.id,'Opening review and first action plan',
    coalesce(nullif(btrim(v_checklist.initial_deadline_notes),''),'Confirm chronology, deadlines, immediate responsibilities and next client update.'),
    v_checklist.responsible_lawyer_id,'Open',false);
  insert into public.documents (
    matter_id,uploaded_by,title,document_type,status,review_status,access_level,
    sharing_policy,version_label,source_kind,ai_summary,requires_compliance_audit
  ) values (
    v_matter.id,p_actor_id,'Matter Opening Memorandum','Opening memorandum','Draft',
    'Working','Lead+Partner','Internal only','v1','Generated from intake',
    coalesce(nullif(v_prospect.matter_summary,''),'Opening memorandum record created from approved assessment.'),true
  );
  if v_prospect.primary_party_id is not null then
    update public.parties set client_status='client',updated_by=p_actor_id,updated_at=now()
    where id=v_prospect.primary_party_id and firm_id=p_firm_id;
    insert into public.matter_parties(firm_id,matter_id,party_id,relationship_type,relationship_detail,is_primary)
    values (p_firm_id,v_matter.id,v_prospect.primary_party_id,'client','Primary client from intake',true);
  end if;
  update public.matter_opening_checklists set kyc_complete=true,status='Completed',
    matter_id=v_matter.id,updated_at=now() where id=v_checklist.id;
  update public.prospects set status='Converted',matter_id=v_matter.id,updated_at=now()
  where id=p_prospect_id and firm_id=p_firm_id;
  insert into public.intake_decision_events (
    firm_id,prospect_id,matter_id,actor_id,event_type,status,notes,metadata
  ) values (p_firm_id,p_prospect_id,v_matter.id,p_actor_id,'matter_opened','completed',
    'Matter opened after conflict, KYC and engagement gates were satisfied.',
    jsonb_build_object('matter_id',v_matter.id));
  insert into public.matter_events (
    firm_id,matter_id,event_type,title,details,actor_name,actor_role
  ) values (p_firm_id,v_matter.id,'MATTER_OPENED','Matter opened from governed intake',
    'Conflict, KYC, engagement, responsible lawyer, deadline review and document readiness gates were satisfied.',
    coalesce(v_actor_name,'Firm member'),coalesce(v_actor_role,'firm_member'));
  return jsonb_build_object('matterId',v_matter.id,'created',true);
end;
$function$
