alter table public.matters add column if not exists case_reference text;

update public.matters
set case_reference = 'TSK-' || extract(year from coalesce(opened_at,created_at,now()))::int::text || '-' || upper(substr(replace(id::text,'-',''),1,8))
where case_reference is null or btrim(case_reference)='';

alter table public.matters alter column case_reference set not null;

create unique index if not exists idx_matters_firm_case_reference
on public.matters(firm_id,case_reference);

create or replace function public.tsidek_assign_case_reference()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.case_reference is null or btrim(new.case_reference)='' then
    new.case_reference := 'TSK-' || extract(year from coalesce(new.opened_at,new.created_at,now()))::int::text || '-' || upper(substr(replace(new.id::text,'-',''),1,8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tsidek_assign_case_reference on public.matters;
create trigger trg_tsidek_assign_case_reference
before insert on public.matters
for each row execute function public.tsidek_assign_case_reference();
