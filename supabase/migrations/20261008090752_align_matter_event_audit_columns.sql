-- Keep the legacy matter event ledger compatible with the canonical audit runtime.
-- This is additive and preserves created_at for older readers.

alter table public.matter_events
  add column if not exists reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists occurred_at timestamptz;

update public.matter_events
set occurred_at = created_at
where occurred_at is null;

alter table public.matter_events
  alter column occurred_at set default now(),
  alter column occurred_at set not null,
  alter column title set default 'Matter event';

create or replace function public.tsidek_prepare_matter_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.firm_id is null and new.matter_id is not null then
    select firm_id into new.firm_id
    from public.matters
    where id = new.matter_id;
  end if;

  if new.title is null or btrim(new.title) = '' then
    new.title := initcap(replace(coalesce(new.event_type, 'matter_event'), '_', ' '));
  end if;

  if new.occurred_at is null then
    new.occurred_at := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tsidek_prepare_matter_event on public.matter_events;
create trigger trg_tsidek_prepare_matter_event
before insert on public.matter_events
for each row execute function public.tsidek_prepare_matter_event();

create index if not exists idx_matter_events_matter_occurred
  on public.matter_events(matter_id, occurred_at desc);
