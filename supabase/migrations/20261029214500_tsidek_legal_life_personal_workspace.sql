-- Personal user-owned workspace; no cross-firm data, privileges or professional verification.
create table if not exists public.tsidek_personal_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
 profession_claim text not null default 'unspecified' check (profession_claim in ('unspecified','lawyer','bailiff','magistrate','clerk','paralegal','student','client','other')),
 preferred_language text not null default 'en' check (preferred_language in ('en','fr')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
comment on table public.tsidek_personal_profiles is 'Self-declared identity only. Never evidence of professional authorization.';
create table if not exists public.tsidek_personal_items (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('note','task','research')),
 title text not null check (char_length(btrim(title)) between 1 and 180),
 body text not null default '' check (char_length(body)<=20000),
 status text not null default 'open' check (status in ('open','done','archived')),
 due_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
comment on table public.tsidek_personal_items is 'Personal work only. Firm matters and confidential client materials remain under firm governance.';
create index if not exists idx_tsidek_personal_items_owner_updated on public.tsidek_personal_items(owner_id,updated_at desc);
alter table public.tsidek_personal_profiles enable row level security;
alter table public.tsidek_personal_items enable row level security;
revoke all on public.tsidek_personal_profiles,public.tsidek_personal_items from public,anon,authenticated;
grant select on public.tsidek_personal_profiles to authenticated;
grant insert (user_id,display_name,profession_claim,preferred_language) on public.tsidek_personal_profiles to authenticated;
grant update (display_name,profession_claim,preferred_language,updated_at) on public.tsidek_personal_profiles to authenticated;
grant select,insert,update,delete on public.tsidek_personal_items to authenticated;
create policy "owner reads personal profile" on public.tsidek_personal_profiles for select to authenticated using (user_id=(select auth.uid()));
create policy "owner creates personal profile" on public.tsidek_personal_profiles for insert to authenticated with check (user_id=(select auth.uid()));
create policy "owner updates personal profile" on public.tsidek_personal_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "owner reads personal work" on public.tsidek_personal_items for select to authenticated using (owner_id=(select auth.uid()));
create policy "owner creates personal work" on public.tsidek_personal_items for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owner updates personal work" on public.tsidek_personal_items for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "owner deletes personal work" on public.tsidek_personal_items for delete to authenticated using (owner_id=(select auth.uid()));
