create unique index if not exists uq_matter_communication_external
on public.matter_communication_ingest(matter_id,channel,external_id)
where external_id is not null;

create or replace function tsidek_private.bridge_legal_interaction_to_matter_intelligence()
returns trigger
language plpgsql
security definer
set search_path = public, tsidek_private
as $$
declare
  v_channel text;
  v_candidate boolean;
  v_external text;
begin
  if new.matter_id is null then return new; end if;
  v_channel := case lower(coalesce(new.interaction_type,''))
    when 'email' then 'email'
    when 'whatsapp' then 'whatsapp'
    when 'sms' then 'sms'
    when 'call' then 'call'
    when 'phone' then 'call'
    when 'meeting' then 'meeting'
    when 'portal' then 'portal'
    when 'internal' then 'internal'
    else 'other'
  end;
  v_candidate := coalesce(new.direction,'') = 'inbound' and v_channel in ('email','whatsapp','sms','call','meeting','portal');
  v_external := coalesce(nullif(new.source_reference,''), 'interaction:' || new.id::text);
  insert into public.matter_communication_ingest(
    firm_id,matter_id,channel,direction,external_id,sender,subject,body_text,occurred_at,
    instruction_candidate,evidence_candidate,processing_status,metadata
  ) values (
    new.firm_id,new.matter_id,v_channel,
    case when new.direction in ('inbound','outbound','internal') then new.direction else 'internal' end,
    v_external,null,new.subject,new.raw_note,new.occurred_at,
    v_candidate,v_candidate,case when v_candidate then 'review_required' else 'recorded' end,
    jsonb_build_object('legalInteractionId',new.id,'source','legal_interactions_bridge')
  ) on conflict (matter_id,channel,external_id) where external_id is not null do nothing;
  return new;
end $$;

drop trigger if exists trg_bridge_legal_interaction_to_matter_intelligence on public.legal_interactions;
create trigger trg_bridge_legal_interaction_to_matter_intelligence
after insert on public.legal_interactions
for each row execute function tsidek_private.bridge_legal_interaction_to_matter_intelligence();

drop policy if exists firm_knowledge_entries_access on public.firm_knowledge_entries;
create policy firm_knowledge_entries_read on public.firm_knowledge_entries
for select to authenticated
using (
  firm_id=tsidek_private.current_firm_id()
  and (
    confidentiality <> 'restricted'
    or (source_matter_id is not null and tsidek_private.can_access_matter(source_matter_id))
  )
);
create policy firm_knowledge_entries_write on public.firm_knowledge_entries
for all to authenticated
using (
  firm_id=tsidek_private.current_firm_id()
  and (source_matter_id is null or tsidek_private.can_access_matter(source_matter_id))
)
with check (
  firm_id=tsidek_private.current_firm_id()
  and (source_matter_id is null or tsidek_private.can_access_matter(source_matter_id))
);
