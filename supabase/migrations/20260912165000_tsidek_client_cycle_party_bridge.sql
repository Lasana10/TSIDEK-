alter table public.prospects add column if not exists primary_party_id uuid references public.parties(id) on delete set null;
alter table public.prospects add column if not exists matter_id uuid references public.matters(id) on delete set null;
create index if not exists idx_prospects_primary_party on public.prospects(primary_party_id) where primary_party_id is not null;
create index if not exists idx_prospects_matter on public.prospects(matter_id) where matter_id is not null;
