-- Governed case record state and QR-first physical file identity.
alter table public.matters
  add column if not exists record_state text not null default 'active',
  add column if not exists record_state_reason text,
  add column if not exists record_state_at timestamptz,
  add column if not exists record_state_by uuid references public.lawyers(id) on delete set null;

do $$ begin
  alter table public.matters
    add constraint matters_record_state_check
    check (record_state in ('active','archived','deleted'));
exception when duplicate_object then null; end $$;

alter table public.physical_files
  add column if not exists qr_destination text;

update public.physical_files pf
set qr_destination = '/matters/' || pf.matter_id::text
where qr_destination is null;

create index if not exists idx_matters_firm_record_state
  on public.matters(firm_id,record_state,created_at desc);
