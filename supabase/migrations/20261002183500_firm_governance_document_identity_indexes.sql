create index if not exists idx_firm_document_styles_updated_by on public.firm_document_styles(updated_by) where updated_by is not null;
create index if not exists idx_matter_record_change_requests_requested_by on public.matter_record_change_requests(requested_by);
create index if not exists idx_matter_record_change_requests_decided_by on public.matter_record_change_requests(decided_by) where decided_by is not null;
