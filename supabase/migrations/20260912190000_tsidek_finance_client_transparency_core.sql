alter table public.invoices add column if not exists firm_id uuid references public.firms(id) on delete cascade;
update public.invoices i set firm_id=m.firm_id from public.matters m where i.matter_id=m.id and i.firm_id is null;
alter table public.invoices alter column firm_id set not null;
alter table public.invoices add column if not exists invoice_number text;
alter table public.invoices add column if not exists description text;
alter table public.invoices add column if not exists issued_at timestamptz;
alter table public.invoices add column if not exists paid_xaf bigint not null default 0;
alter table public.invoices add column if not exists currency text not null default 'XAF';
alter table public.invoices add column if not exists created_by uuid references public.lawyers(id) on delete set null;
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
create unique index if not exists invoices_firm_number_unique on public.invoices(firm_id,invoice_number) where invoice_number is not null;
create index if not exists invoices_firm_status_idx on public.invoices(firm_id,status,due_date);

create table if not exists public.matter_payments (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade, invoice_id uuid references public.invoices(id) on delete set null,
 amount_xaf bigint not null check(amount_xaf>0), currency text not null default 'XAF', provider text not null default 'CASH',
 phone_number text, payment_kind text not null default 'Invoice payment', account_type text not null default 'Firm operating',
 status text not null default 'Pending' check(status in ('Requested','Pending','Confirmed','Failed','Cancelled','Reversed')),
 provider_reference text, note text, received_at timestamptz, confirmed_by uuid references public.lawyers(id) on delete set null,
 created_by uuid references public.lawyers(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists matter_payments_matter_idx on public.matter_payments(matter_id,status,created_at desc);
create unique index if not exists matter_payments_provider_ref_unique on public.matter_payments(firm_id,provider,provider_reference) where provider_reference is not null and provider_reference<>'';

create table if not exists public.matter_disbursements (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade, amount_xaf bigint not null check(amount_xaf>0),
 category text not null default 'Other', payee text not null, status text not null default 'Planned' check(status in ('Planned','Approved','Paid','Reconciled','Cancelled')),
 proof_document_id uuid references public.documents(id) on delete set null, client_recoverable boolean not null default true,
 note text, approved_by uuid references public.lawyers(id) on delete set null, paid_at timestamptz,
 created_by uuid references public.lawyers(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists matter_disbursements_matter_idx on public.matter_disbursements(matter_id,status,created_at desc);

create table if not exists public.payment_receipts (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade, payment_id uuid not null references public.matter_payments(id) on delete restrict,
 receipt_number text not null, amount_xaf bigint not null, issued_to text, issued_by uuid references public.lawyers(id) on delete set null,
 issued_at timestamptz not null default now(), delivery_status text not null default 'Not sent', metadata jsonb not null default '{}'::jsonb,
 unique(firm_id,receipt_number), unique(payment_id)
);

create table if not exists public.client_financial_statements (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade, statement_date date not null default current_date,
 invoiced_xaf bigint not null default 0, paid_xaf bigint not null default 0, outstanding_xaf bigint not null default 0,
 recoverable_expenses_xaf bigint not null default 0, client_funds_xaf bigint not null default 0,
 generated_by uuid references public.lawyers(id) on delete set null, snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists client_financial_statements_matter_idx on public.client_financial_statements(matter_id,created_at desc);

alter table public.matter_payments enable row level security;
alter table public.matter_disbursements enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.client_financial_statements enable row level security;
revoke all on table public.matter_payments,public.matter_disbursements,public.payment_receipts,public.client_financial_statements from anon;
grant select,insert,update on table public.matter_payments,public.matter_disbursements to authenticated;
grant select on table public.payment_receipts,public.client_financial_statements to authenticated;

create policy matter_payments_read on public.matter_payments for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_payments_write on public.matter_payments for all to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id)) with check(firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_disbursements_read on public.matter_disbursements for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_disbursements_write on public.matter_disbursements for all to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id)) with check(firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy payment_receipts_read on public.payment_receipts for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy client_financial_statements_read on public.client_financial_statements for select to authenticated using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

create or replace function public.next_firm_document_number(p_firm_id uuid,p_prefix text,p_table text)
returns text language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 if not tsidek_private.is_active_member(p_firm_id) then raise exception 'Not authorized'; end if;
 if p_table='invoice' then select count(*)+1 into n from public.invoices where firm_id=p_firm_id;
 elsif p_table='receipt' then select count(*)+1 into n from public.payment_receipts where firm_id=p_firm_id;
 else raise exception 'Unsupported sequence'; end if;
 return upper(p_prefix)||'-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,5,'0');
end;$$;
revoke all on function public.next_firm_document_number(uuid,text,text) from public,anon;
grant execute on function public.next_firm_document_number(uuid,text,text) to authenticated;

create unique index if not exists finance_ledger_source_unique on public.finance_ledger_entries(firm_id,source_table,source_id,entry_type) where source_table is not null and source_id is not null;
