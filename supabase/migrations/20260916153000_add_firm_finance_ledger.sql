create table if not exists public.finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  entry_type text not null check (entry_type in ('payment','expense','disbursement','receipt','adjustment')),
  amount_xaf numeric not null check (amount_xaf >= 0),
  direction text not null check (direction in ('in','out')),
  payment_method text,
  reference text,
  description text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists finance_ledger_entries_firm_idx on public.finance_ledger_entries(firm_id, occurred_at desc);
create index if not exists finance_ledger_entries_matter_idx on public.finance_ledger_entries(matter_id, occurred_at desc);
create index if not exists finance_ledger_entries_invoice_idx on public.finance_ledger_entries(invoice_id, occurred_at desc);

alter table public.finance_ledger_entries enable row level security;

drop policy if exists finance_ledger_entries_select on public.finance_ledger_entries;
create policy finance_ledger_entries_select on public.finance_ledger_entries for select using (
  tsidek_private.current_firm_id() = firm_id and exists (
    select 1 from public.firm_memberships fm where fm.user_id = auth.uid() and fm.firm_id = finance_ledger_entries.firm_id and fm.status = 'active' and fm.role_key in ('owner','partner','administrator','finance','lawyer')
  )
);

drop policy if exists finance_ledger_entries_insert on public.finance_ledger_entries;
create policy finance_ledger_entries_insert on public.finance_ledger_entries for insert with check (
  tsidek_private.current_firm_id() = firm_id and exists (
    select 1 from public.firm_memberships fm where fm.user_id = auth.uid() and fm.firm_id = finance_ledger_entries.firm_id and fm.status = 'active' and fm.role_key in ('owner','partner','administrator','finance')
  )
);

drop policy if exists finance_ledger_entries_update on public.finance_ledger_entries;
create policy finance_ledger_entries_update on public.finance_ledger_entries for update using (
  tsidek_private.current_firm_id() = firm_id and exists (
    select 1 from public.firm_memberships fm where fm.user_id = auth.uid() and fm.firm_id = finance_ledger_entries.firm_id and fm.status = 'active' and fm.role_key in ('owner','partner','administrator','finance')
  )
) with check (
  tsidek_private.current_firm_id() = firm_id and exists (
    select 1 from public.firm_memberships fm where fm.user_id = auth.uid() and fm.firm_id = finance_ledger_entries.firm_id and fm.status = 'active' and fm.role_key in ('owner','partner','administrator','finance')
  )
);

drop policy if exists finance_ledger_entries_delete on public.finance_ledger_entries;
create policy finance_ledger_entries_delete on public.finance_ledger_entries for delete using (
  tsidek_private.current_firm_id() = firm_id and exists (
    select 1 from public.firm_memberships fm where fm.user_id = auth.uid() and fm.firm_id = finance_ledger_entries.firm_id and fm.status = 'active' and fm.role_key in ('owner','partner','administrator')
  )
);
