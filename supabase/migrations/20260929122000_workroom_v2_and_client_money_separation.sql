-- Workroom v2 + client-money separation. Applied to production on 2026-09-29; kept here for reproducible environments.
alter table public.workroom_threads add column if not exists thread_type text not null default 'discussion';
alter table public.workroom_threads add column if not exists description text;
alter table public.workroom_threads add column if not exists is_pinned boolean not null default false;
alter table public.workroom_threads add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workroom_messages add column if not exists reply_to uuid references public.workroom_messages(id) on delete set null;
alter table public.workroom_messages add column if not exists mentions jsonb not null default '[]'::jsonb;
alter table public.workroom_messages add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.workroom_decisions (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 thread_id uuid references public.workroom_threads(id) on delete cascade, matter_id uuid references public.matters(id) on delete cascade,
 work_item_id uuid references public.firm_work_items(id) on delete set null, title text not null, description text,
 decision_type text not null default 'decision' check(decision_type in('decision','approval','review','handoff')),
 status text not null default 'open' check(status in('open','approved','rejected','resolved','cancelled')),
 requested_by uuid references public.lawyers(id), assigned_to uuid references public.lawyers(id), resolution text,
 resolved_by uuid references public.lawyers(id), resolved_at timestamptz, due_at timestamptz,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.workroom_decisions enable row level security;
revoke all on public.workroom_decisions from anon;
grant select,insert,update on public.workroom_decisions to authenticated;
drop policy if exists "workroom_decisions_read" on public.workroom_decisions;
create policy "workroom_decisions_read" on public.workroom_decisions for select to authenticated using(firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
drop policy if exists "workroom_decisions_write" on public.workroom_decisions;
create policy "workroom_decisions_write" on public.workroom_decisions for all to authenticated using(firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id))) with check(firm_id=public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

create table if not exists public.client_money_transactions (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid references public.matters(id) on delete set null, party_id uuid references public.parties(id) on delete set null,
 transaction_type text not null check(transaction_type in('received','released','refunded','transferred','adjustment')),
 amount_xaf bigint not null check(amount_xaf>0), direction text not null check(direction in('in','out')),
 payment_method text, reference text, purpose text not null,
 status text not null default 'recorded' check(status in('recorded','verified','reversed')),
 occurred_at timestamptz not null default now(), created_by uuid references public.lawyers(id), verified_by uuid references public.lawyers(id),
 verified_at timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.client_money_transactions enable row level security;
revoke all on public.client_money_transactions from anon;
grant select,insert,update on public.client_money_transactions to authenticated;
drop policy if exists "client_money_read" on public.client_money_transactions;
create policy "client_money_read" on public.client_money_transactions for select to authenticated using(firm_id=public.current_firm_id());
drop policy if exists "client_money_write" on public.client_money_transactions;
create policy "client_money_write" on public.client_money_transactions for all to authenticated using(firm_id=public.current_firm_id()) with check(firm_id=public.current_firm_id());
create index if not exists idx_workroom_decisions_firm_status on public.workroom_decisions(firm_id,status,created_at desc);
create index if not exists idx_client_money_firm_date on public.client_money_transactions(firm_id,occurred_at desc);
create index if not exists idx_client_money_matter on public.client_money_transactions(matter_id,occurred_at desc);
