-- Validate real private vault object, not only document metadata, before approving reconciliation.
create or replace function public.tsidek_reconcile_matter_finance(
 p_firm_id uuid,p_matter_id uuid,p_actor_id uuid,p_notes text
)returns jsonb language plpgsql security definer set search_path='' as $$
declare v_expected bigint;v_paid bigint;v_unverified int;v_review public.finance_reconciliation_reviews%rowtype;
 v_outstanding bigint;v_matter public.matters%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 select * into v_matter from public.matters where id=p_matter_id and firm_id=p_firm_id for update;
 if not found then raise exception 'Matter not found';end if;
 if not exists(select 1 from public.lawyers l join public.firm_memberships fm on fm.user_id=l.id
  where l.id=p_actor_id and fm.firm_id=p_firm_id and fm.status='active')
 then raise exception 'Actor is not an active linked firm member';end if;
 select coalesce(sum(amount_xaf),0)::bigint into v_expected from public.invoices where firm_id=p_firm_id and matter_id=p_matter_id;
 select coalesce(sum(amount_xaf),0)::bigint into v_paid from public.matter_payments where firm_id=p_firm_id and matter_id=p_matter_id and status='Confirmed';
 select count(*) into v_unverified from public.matter_payments p
 where p.firm_id=p_firm_id and p.matter_id=p_matter_id and p.status='Confirmed'
 and not public.tsidek_finance_proof_object_exists(p_firm_id,p_matter_id,p.manual_evidence_document_id);
 v_outstanding:=v_expected-v_paid;
 insert into public.finance_reconciliation_reviews(firm_id,matter_id,expected_xaf,received_xaf,variance_xaf,
  status,notes,source_summary,prepared_by,reviewed_by,reviewed_at)
 values(p_firm_id,p_matter_id,v_expected,v_paid,v_outstanding,
  case when v_unverified=0 and v_expected>0 and v_outstanding=0 then 'approved'
   when v_unverified>0 then 'variance' else 'open' end,
  nullif(left(trim(coalesce(p_notes,'')),2000),''),
  jsonb_build_object('unverified_confirmed_payments',v_unverified,'basis','matter invoices and evidenced confirmed payments','no_invoices',v_expected=0),
  p_actor_id,case when v_unverified=0 and v_expected>0 and v_outstanding=0 then p_actor_id else null end,
  case when v_unverified=0 and v_expected>0 and v_outstanding=0 then now() else null end)
 returning * into v_review;
 return jsonb_build_object('review_id',v_review.id,'status',v_review.status,
   'invoiced',v_expected,'paid',v_paid,'unverified_confirmed_payments',v_unverified);
end $$;
revoke all on function public.tsidek_reconcile_matter_finance(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.tsidek_reconcile_matter_finance(uuid,uuid,uuid,text) to service_role;
