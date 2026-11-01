-- KYC decision and intake-to-matter gates are one governed transaction.
alter table public.prospect_kyc_reviews add column if not exists decision_note text;
revoke update on public.prospect_kyc_reviews from authenticated;
create or replace function public.tsidek_decide_prospect_kyc(
 p_firm_id uuid,p_prospect_id uuid,p_review_id uuid,p_actor_id uuid,p_status text,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.prospect_kyc_reviews%rowtype;v_status text;v_note text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if not exists (
  select 1 from public.firm_memberships fm where fm.firm_id=p_firm_id and fm.user_id=p_actor_id
   and fm.status='active' and
   (fm.role_key in ('owner','partner','managing_partner') or fm.governance_role_key in ('founder','firm_head'))
 ) then raise exception 'Authorized professional KYC approver required';end if;
 if p_status not in ('cleared','enhanced_due_diligence','rejected') then raise exception 'Unsupported compliance decision';end if;
 v_note:=trim(coalesce(p_note,''));
 if length(v_note)<20 then raise exception 'Professional compliance decision requires a specific written rationale';end if;
 perform 1 from public.prospects where firm_id=p_firm_id and id=p_prospect_id and matter_id is null for update;
 if not found then raise exception 'Open prospect in current firm required';end if;
 select * into k from public.prospect_kyc_reviews
 where id=p_review_id and firm_id=p_firm_id and prospect_id=p_prospect_id for update;
 if not found then raise exception 'KYC review not found in firm prospect';end if;
 if k.status=p_status then return jsonb_build_object('reviewId',k.id,'status',k.status,'created',false);end if;
 if k.status in ('cleared','rejected','expired') then raise exception 'Final KYC decision is immutable; open a new review';end if;
 if p_status='cleared' then
  if k.risk_rating='prohibited' then raise exception 'Prohibited risk cannot be cleared';end if;
  if k.pep_status<>'clear' or k.sanctions_status<>'clear' or k.adverse_media_status<>'clear' then
   raise exception 'Documented PEP, sanctions and adverse-media screening must be clear';end if;
  if k.expires_at is not null and k.expires_at<=now() then raise exception 'Expired KYC cannot be cleared';end if;
 end if;
 update public.prospect_kyc_reviews
 set status=p_status,reviewed_by=p_actor_id,reviewed_at=now(),
  decision_note=left(v_note,3000),updated_at=now()
 where id=k.id;
 update public.prospects
 set status=case when p_status='cleared' then 'Compliance & terms'
                 when p_status='rejected' then 'Compliance blocked'
                 else 'Enhanced due diligence' end,
     risk_level=case when p_status='rejected' or k.risk_rating in ('high','prohibited') then 'High'
       when k.risk_rating='low' then 'Low' else 'Medium' end,
     updated_at=now()
 where id=p_prospect_id and firm_id=p_firm_id;
 update public.matter_opening_checklists
 set kyc_complete=(p_status='cleared'),updated_at=now()
 where prospect_id=p_prospect_id and firm_id=p_firm_id;
 insert into public.intake_decision_events(firm_id,prospect_id,actor_id,event_type,status,notes,metadata)
 values(p_firm_id,p_prospect_id,p_actor_id,'kyc_decision',p_status,left(v_note,3000),
 jsonb_build_object('review_id',k.id,'pep',k.pep_status,'sanctions',k.sanctions_status,'adverse_media',k.adverse_media_status,'risk',k.risk_rating));
 return jsonb_build_object('reviewId',k.id,'status',p_status,'created',true);
end $$;
revoke all on function public.tsidek_decide_prospect_kyc(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.tsidek_decide_prospect_kyc(uuid,uuid,uuid,uuid,text,text) to service_role;
create or replace function public.tsidek_guard_cleared_kyc()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='cleared' then
  if new.pep_status<>'clear' or new.sanctions_status<>'clear'
    or new.adverse_media_status<>'clear' or new.risk_rating='prohibited'
    or new.reviewed_by is null or new.reviewed_at is null
    or length(trim(coalesce(new.decision_note,'')))<20 then
    raise exception 'KYC clearance requires screened evidence and professional signed decision';end if;
 end if;
 return new;
end $$;
drop trigger if exists tsidek_guard_cleared_kyc on public.prospect_kyc_reviews;
create trigger tsidek_guard_cleared_kyc before insert or update on public.prospect_kyc_reviews
for each row execute function public.tsidek_guard_cleared_kyc();
