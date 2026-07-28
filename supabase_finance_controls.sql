-- TSIDEK finance controls: payments, client funds, and disbursements.
-- Run after supabase_schema.sql. This keeps finance matter-scoped and auditable.

create table if not exists matter_payments (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    amount_xaf decimal not null check (amount_xaf > 0),
    currency text not null default 'XAF' check (currency in ('XAF', 'XOF')),
    provider text not null default 'MTN' check (provider in ('MTN', 'ORANGE', 'BANK', 'CASH')),
    phone_number text,
    payment_kind text not null default 'Provision' check (payment_kind in ('Provision', 'Invoice payment', 'Retainer', 'Client funds')),
    account_type text not null default 'Client funds' check (account_type in ('Client funds', 'Firm operating')),
    status text not null default 'Requested' check (status in ('Requested', 'Pending', 'Confirmed', 'Failed', 'Cancelled')),
    provider_reference text,
    note text,
    created_at timestamptz not null default now()
);

create table if not exists matter_disbursements (
    id uuid primary key default uuid_generate_v4(),
    firm_id uuid not null references firms(id) on delete cascade,
    matter_id uuid not null references matters(id) on delete cascade,
    amount_xaf decimal not null check (amount_xaf > 0),
    category text not null default 'Other' check (category in ('Court fees', 'Bailiff', 'Registry', 'Transport', 'Expert', 'Other')),
    payee text not null,
    status text not null default 'Planned' check (status in ('Planned', 'Approved', 'Paid', 'Reconciled')),
    proof_document_id uuid references documents(id) on delete set null,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists idx_matter_payments_matter_created on matter_payments(matter_id, created_at desc);
create index if not exists idx_matter_payments_firm_status on matter_payments(firm_id, status, created_at desc);
create index if not exists idx_matter_disbursements_matter_created on matter_disbursements(matter_id, created_at desc);
create index if not exists idx_matter_disbursements_firm_status on matter_disbursements(firm_id, status, created_at desc);

alter table matter_payments enable row level security;
alter table matter_disbursements enable row level security;

drop policy if exists "firm members can access matter payments" on matter_payments;
create policy "firm members can access matter payments" on matter_payments
for all using (
    firm_id = current_firm_id()
    and exists (
        select 1 from matters
        where matters.id = matter_payments.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    firm_id = current_firm_id()
    and exists (
        select 1 from matters
        where matters.id = matter_payments.matter_id
          and matters.firm_id = current_firm_id()
    )
);

drop policy if exists "firm members can access matter disbursements" on matter_disbursements;
create policy "firm members can access matter disbursements" on matter_disbursements
for all using (
    firm_id = current_firm_id()
    and exists (
        select 1 from matters
        where matters.id = matter_disbursements.matter_id
          and matters.firm_id = current_firm_id()
    )
)
with check (
    firm_id = current_firm_id()
    and exists (
        select 1 from matters
        where matters.id = matter_disbursements.matter_id
          and matters.firm_id = current_firm_id()
    )
);
