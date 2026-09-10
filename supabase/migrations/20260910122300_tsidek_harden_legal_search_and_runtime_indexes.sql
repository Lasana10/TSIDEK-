alter function public.search_legal_source_chunks(text, uuid, integer) security invoker;

create index if not exists idx_ai_provider_runs_actor on public.ai_provider_runs(actor_id);
create index if not exists idx_ai_quality_evaluations_firm on public.ai_quality_evaluations(firm_id);
create index if not exists idx_ai_quality_evaluations_matter on public.ai_quality_evaluations(matter_id) where matter_id is not null;
create index if not exists idx_ai_quality_evaluations_work_product on public.ai_quality_evaluations(ai_work_product_id) where ai_work_product_id is not null;
create index if not exists idx_domain_outbox_firm on public.domain_outbox_events(firm_id);
create index if not exists idx_firm_runtime_profiles_updated_by on public.firm_runtime_profiles(updated_by) where updated_by is not null;
create index if not exists idx_legal_authorities_supersedes on public.legal_authorities(supersedes_authority_id) where supersedes_authority_id is not null;
create index if not exists idx_legal_source_chunks_authority on public.legal_source_chunks(authority_id) where authority_id is not null;
create index if not exists idx_legal_source_documents_created_by on public.legal_source_documents(created_by) where created_by is not null;
