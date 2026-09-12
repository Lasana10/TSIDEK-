create table if not exists public.performance_reviews (
 id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.firms(id) on delete cascade,
 lawyer_id uuid not null references public.lawyers(id) on delete cascade, period_start date not null, period_end date not null,
 metrics jsonb not null default '{}'::jsonb, supervisor_assessment text, development_plan text,
 status text not null default 'draft' check(status in ('draft','shared','acknowledged','closed')),
 reviewed_by uuid references public.lawyers(id) on delete set null, reviewed_at timestamptz,
 acknowledged_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(firm_id,lawyer_id,period_start,period_end)
);
create index if not exists performance_reviews_firm_period_idx on public.performance_reviews(firm_id,period_end desc);
alter table public.performance_reviews enable row level security;
revoke all on table public.performance_reviews from anon;
grant select on table public.performance_reviews to authenticated;
create policy performance_reviews_governor_select on public.performance_reviews for select to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_firm_governor(firm_id));
