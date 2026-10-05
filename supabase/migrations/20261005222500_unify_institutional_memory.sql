alter table public.firm_knowledge_entries
add column if not exists legacy_memory_id uuid unique references public.institutional_memory_entries(id) on delete set null;

create or replace function tsidek_private.sync_institutional_memory_to_firm_knowledge()
returns trigger
language plpgsql
security definer
set search_path = public, tsidek_private
as $$
begin
  insert into public.firm_knowledge_entries(
    firm_id,source_matter_id,legacy_memory_id,knowledge_type,title,summary,confidentiality,status,
    approved_by,approved_at,metadata,updated_at
  ) values (
    new.firm_id,new.matter_id,new.id,lower(coalesce(new.memory_type,'practice_lesson')),new.title,new.summary,
    'internal',case when coalesce(new.approved,false) then 'approved' else 'draft' end,
    new.approved_by,new.approved_at,
    jsonb_build_object('legacyInstitutionalMemory',true,'outcome',new.outcome,'proposedBy',new.proposed_by),now()
  )
  on conflict (legacy_memory_id) do update set
    source_matter_id=excluded.source_matter_id,
    knowledge_type=excluded.knowledge_type,
    title=excluded.title,
    summary=excluded.summary,
    status=excluded.status,
    approved_by=excluded.approved_by,
    approved_at=excluded.approved_at,
    metadata=excluded.metadata,
    updated_at=now();
  return new;
end $$;

drop trigger if exists trg_sync_institutional_memory_to_firm_knowledge on public.institutional_memory_entries;
create trigger trg_sync_institutional_memory_to_firm_knowledge
after insert or update of approved,title,summary,outcome,approved_by,approved_at on public.institutional_memory_entries
for each row execute function tsidek_private.sync_institutional_memory_to_firm_knowledge();

insert into public.firm_knowledge_entries(
  firm_id,source_matter_id,legacy_memory_id,knowledge_type,title,summary,confidentiality,status,approved_by,approved_at,metadata
)
select
  i.firm_id,i.matter_id,i.id,lower(coalesce(i.memory_type,'practice_lesson')),i.title,i.summary,'internal',
  case when coalesce(i.approved,false) then 'approved' else 'draft' end,
  i.approved_by,i.approved_at,
  jsonb_build_object('legacyInstitutionalMemory',true,'outcome',i.outcome,'proposedBy',i.proposed_by)
from public.institutional_memory_entries i
on conflict (legacy_memory_id) do nothing;
