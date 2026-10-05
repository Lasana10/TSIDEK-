drop policy if exists matter_execution_actions_access on public.matter_execution_actions;
create policy matter_execution_actions_read on public.matter_execution_actions for select to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_outcomes_access on public.matter_outcomes;
create policy matter_outcomes_read on public.matter_outcomes for select to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_legal_claims_access on public.matter_legal_claims;
create policy matter_legal_claims_read on public.matter_legal_claims for select to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_communication_ingest_access on public.matter_communication_ingest;
create policy matter_communication_ingest_read on public.matter_communication_ingest for select to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists firm_knowledge_entries_write on public.firm_knowledge_entries;
drop policy if exists jurisdiction_packs_firm_write on public.jurisdiction_packs;
