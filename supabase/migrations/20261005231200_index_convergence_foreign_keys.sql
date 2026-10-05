create index if not exists idx_matter_execution_actions_firm on public.matter_execution_actions(firm_id);
create index if not exists idx_matter_execution_actions_responsible on public.matter_execution_actions(responsible_lawyer_id) where responsible_lawyer_id is not null;

create index if not exists idx_matter_outcomes_firm on public.matter_outcomes(firm_id);
create index if not exists idx_matter_outcomes_reviewed_by on public.matter_outcomes(reviewed_by) where reviewed_by is not null;

create index if not exists idx_matter_legal_claims_firm on public.matter_legal_claims(firm_id);
create index if not exists idx_matter_legal_claims_verified_by on public.matter_legal_claims(verified_by) where verified_by is not null;

create index if not exists idx_matter_communication_ingest_firm on public.matter_communication_ingest(firm_id);

create index if not exists idx_firm_knowledge_source_matter on public.firm_knowledge_entries(source_matter_id) where source_matter_id is not null;
create index if not exists idx_firm_knowledge_source_outcome on public.firm_knowledge_entries(source_outcome_id) where source_outcome_id is not null;
create index if not exists idx_firm_knowledge_approved_by on public.firm_knowledge_entries(approved_by) where approved_by is not null;

create index if not exists idx_jurisdiction_packs_reviewed_by on public.jurisdiction_packs(reviewed_by) where reviewed_by is not null;
