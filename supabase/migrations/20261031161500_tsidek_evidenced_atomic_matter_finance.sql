-- TSIDKENU matter finance: no ledger or receipt without an evidence-backed, atomic transaction.
-- Additive; historic confirmed payments are not silently rewritten.
alter table public.matter_payments
 add column if not exists manual_evidence_document_id uuid references public.documents(id) on delete restrict,
 add column if not exists idempotency_key uuid;
create unique index if not exists tsidek_payment_idempotency_per_firm
 on public.matter_payments(firm_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists tsidek_payment_evidence_once_per_firm
 on public.matter_payments(firm_id,manual_evidence_document_id)
 where manual_evidence_document_id is not null and status='Confirmed';

alter table public.invoices add column if not exists idempotency_key uuid;
create unique index if not exists tsidek_invoice_idempotency_per_firm on public.invoices(firm_id,idempotency_key)
 where idempotency_key is not null;

create table if not exists public.tsidek_finance_sequences(
 firm_id uuid not null references public.firms(id) on delete cascade,
 kind text not null check(kind in ('invoice','receipt')),
 year integer not null,
 last_value bigint not null default 0 check(last_value>=0),
 primary key(firm_id,kind,year)
);
alter table public.tsidek_finance_sequences enable row level security;
revoke all on public.tsidek_finance_sequences from public,anon,authenticated;
grant select,insert,update on public.tsidek_finance_sequences to service_role;

create or replace function public.tsidek_record_evidenced_payment(
 p_firm_id uuid,p_matter_id uuid,p_actor_id uuid,p_invoice_id uuid,
 p_amount_xaf bigint,p_provider text,p_reference text,p_account_type text,
 p_evidence_document_id uuid,p_idempotency_key uuid,p_attestation text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_matter public.matters%rowtype;v_invoice public.invoices%rowtype;
 v_document public.documents%rowtype;v_payment public.matter_payments%rowtype;
 v_existing public.matter_payments%rowtype;v_seq bigint;v_receipt text;v_paid bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if p_idempotency_key is null or p_firm_id is null or p_matter_id is null or p_actor_id is null then raise exception 'Invalid payment context';end if;
 if p_amount_xaf is null or p_amount_xaf<=0 or p_amount_xaf>1000000000000 then raise exception 'Invalid amount';end if;
 if upper(coalesce(p_provider,'')) not in ('CASH','BANK','MTN','ORANGE','WAVE') then raise exception 'Unsupported payment provider';end if;
 if p_evidence_document_id is null or length(trim(coalesce(p_attestation,'')))<12 then raise exception 'Supporting document and verification attestation are required';end if;
 if upper(p_provider)<>'CASH' and length(trim(coalesce(p_reference,'')))<5 then raise exception 'Payment transaction reference is required';end if;

 select * into v_matter from public.matters where id=p_matter_id and firm_id=p_firm_id for update;
 if not found then raise exception 'Matter not found in firm';end if;
 if v_matter.closed_at is not null or lower(coalesce(v_matter.status,''))='closed' then raise exception 'Closed matters cannot receive new payments';end if;
 if not exists(select 1 from public.lawyers l join public.firm_memberships fm on fm.user_id=l.id
    where l.id=p_actor_id and fm.firm_id=p_firm_id and fm.status='active')
 then raise exception 'Actor is not an active linked firm member';end if;

 select * into v_existing from public.matter_payments where firm_id=p_firm_id and idempotency_key=p_idempotency_key;
 if found then
   if v_existing.matter_id<>p_matter_id or v_existing.amount_xaf<>p_amount_xaf
      or v_existing.manual_evidence_document_id is distinct from p_evidence_document_id
   then raise exception 'Idempotency key reused with different payment';end if;
   return jsonb_build_object('payment_id',v_existing.id,'created',false);
 end if;

 select * into v_document from public.documents
 where id=p_evidence_document_id and matter_id=p_matter_id
 and document_type='payment_proof'
 and (nullif(trim(coalesce(storage_path,'')),'') is not null or nullif(trim(coalesce(onedrive_file_id,'')),'') is not null)
 for share;
 if not found then raise exception 'A stored payment-proof document from this matter is required';end if;
 if exists(select 1 from public.matter_payments where firm_id=p_firm_id
  and manual_evidence_document_id=p_evidence_document_id and status='Confirmed')
 then raise exception 'This evidence is already attached to a confirmed payment';end if;

 if p_invoice_id is not null then
   select * into v_invoice from public.invoices where id=p_invoice_id and firm_id=p_firm_id and matter_id=p_matter_id for update;
   if not found then raise exception 'Invoice not found in this matter';end if;
   if v_invoice.amount_xaf < v_invoice.paid_xaf+p_amount_xaf then raise exception 'Payment would exceed invoice balance';end if;
 end if;

 insert into public.matter_payments(
  firm_id,matter_id,invoice_id,amount_xaf,provider,payment_kind,account_type,status,
  provider_reference,note,received_at,confirmed_by,created_by,
  provider_status,provider_payload,manual_evidence_document_id,idempotency_key
 )values(
  p_firm_id,p_matter_id,p_invoice_id,p_amount_xaf,upper(p_provider),'Invoice payment',
  case when p_account_type='Client funds' then 'Client funds' else 'Firm operating' end,
  'Confirmed',nullif(trim(p_reference),''),trim(p_attestation),now(),p_actor_id,p_actor_id,
  'MANUALLY_ATTESTED',jsonb_build_object('verification','human-attested','external_settlement_verified',false,'evidence_document_id',p_evidence_document_id),
  p_evidence_document_id,p_idempotency_key
 ) returning * into v_payment;

 insert into public.finance_ledger_entries(
  firm_id,matter_id,entry_type,source_table,source_id,amount_xaf,direction,
  account_bucket,status,description,provider_reference,created_by,metadata
 )values(
  p_firm_id,p_matter_id,'PAYMENT','matter_payments',v_payment.id::text,p_amount_xaf,
  'CREDIT',case when p_account_type='Client funds' then 'CLIENT_FUNDS' else 'OPERATING' end,
  'POSTED','Manually evidenced payment via '||upper(p_provider),nullif(trim(p_reference),''),p_actor_id,
  jsonb_build_object('evidence_document_id',p_evidence_document_id,'verification','human-attested')
 );

 if p_invoice_id is not null then
   update public.invoices set paid_xaf=paid_xaf+p_amount_xaf,
    status=case when paid_xaf+p_amount_xaf>=amount_xaf then 'Paid' else 'Partial' end,
    updated_at=now() where id=p_invoice_id returning paid_xaf into v_paid;
 end if;

 insert into public.tsidek_finance_sequences(firm_id,kind,year,last_value)
 values(p_firm_id,'receipt',extract(year from current_date)::int,
   (select coalesce(max((substring(receipt_number from '([0-9]+)$'))::bigint),0)+1 from public.payment_receipts
    where firm_id=p_firm_id and receipt_number like 'RCT-'||to_char(current_date,'YYYY')||'-%'))
 on conflict(firm_id,kind,year) do update set last_value=public.tsidek_finance_sequences.last_value+1
 returning last_value into v_seq;
 v_receipt:='RCT-'||to_char(current_date,'YYYY')||'-'||lpad(v_seq::text,5,'0');

 insert into public.payment_receipts(
  firm_id,matter_id,payment_id,receipt_number,amount_xaf,issued_to,issued_by,metadata
 )values(p_firm_id,p_matter_id,v_payment.id,v_receipt,p_amount_xaf,v_matter.client_name,p_actor_id,
   jsonb_build_object('provider',upper(p_provider),'provider_reference',p_reference,
   'evidence_document_id',p_evidence_document_id,'external_settlement_verified',false));

 insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
 values(p_firm_id,p_matter_id,'payment_recorded','Evidenced payment recorded',
  'Payment was manually attested and linked to a stored proof document',
  'Authorized firm member','Finance reviewer',
  jsonb_build_object('payment_id',v_payment.id,'receipt_number',v_receipt,
   'evidence_document_id',p_evidence_document_id,'amount_xaf',p_amount_xaf));

 return jsonb_build_object('payment_id',v_payment.id,'receipt_number',v_receipt,'created',true);
end $$;
revoke all on function public.tsidek_record_evidenced_payment(uuid,uuid,uuid,uuid,bigint,text,text,text,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.tsidek_record_evidenced_payment(uuid,uuid,uuid,uuid,bigint,text,text,text,uuid,uuid,text) to service_role;

create or replace function public.tsidek_issue_matter_invoice(
 p_firm_id uuid,p_matter_id uuid,p_actor_id uuid,p_amount_xaf bigint,
 p_description text,p_due_at timestamptz,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare v_matter public.matters%rowtype;v_inv public.invoices%rowtype;v_seq bigint;v_number text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 if p_idempotency_key is null or p_amount_xaf is null or p_amount_xaf<=0 or p_amount_xaf>1000000000000 then raise exception 'Invalid invoice request';end if;
 select * into v_matter from public.matters where firm_id=p_firm_id and id=p_matter_id for update;
 if not found or v_matter.closed_at is not null then raise exception 'Active matter required';end if;
 if not exists(select 1 from public.lawyers l join public.firm_memberships fm on fm.user_id=l.id
  where l.id=p_actor_id and fm.firm_id=p_firm_id and fm.status='active')
 then raise exception 'Actor is not an active linked firm member';end if;
 select * into v_inv from public.invoices where firm_id=p_firm_id and idempotency_key=p_idempotency_key;
 if found then
  if v_inv.matter_id<>p_matter_id or v_inv.amount_xaf<>p_amount_xaf then raise exception 'Idempotency key conflict';end if;
  return jsonb_build_object('invoice_id',v_inv.id,'invoice_number',v_inv.invoice_number,'created',false);
 end if;
 insert into public.tsidek_finance_sequences(firm_id,kind,year,last_value)
 values(p_firm_id,'invoice',extract(year from current_date)::int,
  (select coalesce(max((substring(invoice_number from '([0-9]+)$'))::bigint),0)+1 from public.invoices
   where firm_id=p_firm_id and invoice_number like 'INV-'||to_char(current_date,'YYYY')||'-%'))
 on conflict(firm_id,kind,year) do update set last_value=public.tsidek_finance_sequences.last_value+1
 returning last_value into v_seq;
 v_number:='INV-'||to_char(current_date,'YYYY')||'-'||lpad(v_seq::text,5,'0');
 insert into public.invoices(firm_id,matter_id,amount_xaf,status,due_date,
  invoice_number,description,issued_at,created_by,idempotency_key)
 values(p_firm_id,p_matter_id,p_amount_xaf,'Sent',p_due_at,
  v_number,left(coalesce(nullif(trim(p_description),''),'Legal fees'),1000),now(),p_actor_id,p_idempotency_key)
 returning * into v_inv;
 insert into public.finance_ledger_entries(firm_id,matter_id,entry_type,source_table,source_id,
  amount_xaf,direction,account_bucket,status,description,created_by)
 values(p_firm_id,p_matter_id,'INVOICE','invoices',v_inv.id::text,p_amount_xaf,'DEBIT',
 'RECEIVABLE','POSTED','Invoice '||v_number,p_actor_id);
 return jsonb_build_object('invoice_id',v_inv.id,'invoice_number',v_number,'created',true);
end $$;
revoke all on function public.tsidek_issue_matter_invoice(uuid,uuid,uuid,bigint,text,timestamptz,uuid)
 from public,anon,authenticated;
grant execute on function public.tsidek_issue_matter_invoice(uuid,uuid,uuid,bigint,text,timestamptz,uuid) to service_role;

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
 and not exists(select 1 from public.documents d where d.id=p.manual_evidence_document_id and d.matter_id=p_matter_id
  and d.document_type='payment_proof' and nullif(trim(coalesce(d.storage_path,'')),'') is not null);
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
