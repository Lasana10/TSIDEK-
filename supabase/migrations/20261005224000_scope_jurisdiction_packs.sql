alter table public.jurisdiction_packs
add column if not exists firm_id uuid references public.firms(id) on delete cascade,
add column if not exists source_scope text not null default 'public';

alter table public.jurisdiction_packs drop constraint if exists jurisdiction_packs_source_scope_check;
alter table public.jurisdiction_packs add constraint jurisdiction_packs_source_scope_check check (source_scope in ('public','firm'));

alter table public.jurisdiction_packs drop constraint if exists jurisdiction_packs_scope_integrity_check;
alter table public.jurisdiction_packs add constraint jurisdiction_packs_scope_integrity_check check (
  (source_scope='public' and firm_id is null) or (source_scope='firm' and firm_id is not null)
);

alter table public.jurisdiction_packs drop constraint if exists jurisdiction_packs_jurisdiction_key_version_key;
create unique index if not exists uq_public_jurisdiction_pack_version
on public.jurisdiction_packs(jurisdiction_key,version) where source_scope='public';
create unique index if not exists uq_firm_jurisdiction_pack_version
on public.jurisdiction_packs(firm_id,jurisdiction_key,version) where source_scope='firm';
create index if not exists idx_jurisdiction_packs_firm on public.jurisdiction_packs(firm_id,status,jurisdiction_key);

drop policy if exists jurisdiction_packs_read on public.jurisdiction_packs;
create policy jurisdiction_packs_read on public.jurisdiction_packs
for select to authenticated
using (
  status='active'
  and (source_scope='public' or firm_id=tsidek_private.current_firm_id())
);

grant insert,update,delete on public.jurisdiction_packs to authenticated;
drop policy if exists jurisdiction_packs_firm_write on public.jurisdiction_packs;
create policy jurisdiction_packs_firm_write on public.jurisdiction_packs
for all to authenticated
using (source_scope='firm' and firm_id=tsidek_private.current_firm_id())
with check (source_scope='firm' and firm_id=tsidek_private.current_firm_id());
