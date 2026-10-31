-- Verify proof bytes exist in the private governed vault before any new payment becomes Confirmed.
-- Legacy already-confirmed records remain unchanged; reconciliation treats missing proof as a variance.
create or replace function public.tsidek_validate_payment_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_path text;v_kind text;
begin
 if new.status <> 'Confirmed' then return new; end if;
 if new.manual_evidence_document_id is null then
   raise exception 'Confirmed payment requires registered proof in the private vault';
 end if;
 select d.storage_path,d.source_kind into v_path,v_kind
 from public.documents d
 where d.id=new.manual_evidence_document_id
  and d.matter_id=new.matter_id
  and d.document_type='payment_proof';
 if not found or v_kind<>'Uploaded' or v_path is null
   or v_path not like 'firms/'||new.firm_id::text||'/matters/'||new.matter_id::text||'/payment-proof/%'
 then raise exception 'Payment evidence does not belong to this matter private vault';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='tsidek-vault' and o.name=v_path)
 then raise exception 'Payment proof file is not present in private vault';end if;
 return new;
end $$;
revoke all on function public.tsidek_validate_payment_evidence() from public,anon,authenticated;
drop trigger if exists tsidek_validate_payment_evidence_before_confirm on public.matter_payments;
create trigger tsidek_validate_payment_evidence_before_confirm
before insert or update of status,manual_evidence_document_id on public.matter_payments
for each row execute function public.tsidek_validate_payment_evidence();

-- Only evidence-backed legacy/new receipts can be accepted as reconciled.
create or replace function public.tsidek_finance_proof_object_exists(p_firm_id uuid,p_matter_id uuid,p_document_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.documents d join storage.objects o
  on o.name=d.storage_path and o.bucket_id='tsidek-vault'
  where d.id=p_document_id and d.matter_id=p_matter_id and d.document_type='payment_proof'
   and d.source_kind='Uploaded'
   and d.storage_path like 'firms/'||p_firm_id::text||'/matters/'||p_matter_id::text||'/payment-proof/%'
 );
$$;
revoke all on function public.tsidek_finance_proof_object_exists(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tsidek_finance_proof_object_exists(uuid,uuid,uuid) to service_role;
