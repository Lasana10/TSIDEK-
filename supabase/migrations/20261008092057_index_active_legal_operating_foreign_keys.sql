-- Foreign-key indexes for the active matter, Workroom, approval, and communication paths.
-- These are intentionally scoped to TSIDKENU hot paths; unrelated schemas in the shared
-- Supabase project are not modified by this migration.
create index if not exists idx_firm_work_comments_firm_id on public.firm_work_comments (firm_id);
create index if not exists idx_firm_work_comments_work_item_id on public.firm_work_comments (work_item_id);
create index if not exists idx_firm_work_comments_author_id on public.firm_work_comments (author_id);

create index if not exists idx_firm_work_items_matter_id on public.firm_work_items (matter_id);
create index if not exists idx_firm_work_items_party_id on public.firm_work_items (party_id);
create index if not exists idx_firm_work_items_created_by on public.firm_work_items (created_by);

create index if not exists idx_workroom_messages_firm_id on public.workroom_messages (firm_id);
create index if not exists idx_workroom_messages_matter_id on public.workroom_messages (matter_id);
create index if not exists idx_workroom_messages_created_by on public.workroom_messages (created_by);
create index if not exists idx_workroom_messages_reply_to on public.workroom_messages (reply_to);
create index if not exists idx_workroom_threads_matter_id on public.workroom_threads (matter_id);
create index if not exists idx_workroom_threads_created_by on public.workroom_threads (created_by);

create index if not exists idx_matter_approvals_firm_id on public.matter_approvals (firm_id);
create index if not exists idx_matter_approvals_requested_by on public.matter_approvals (requested_by);
create index if not exists idx_matter_approvals_decided_by on public.matter_approvals (decided_by);

create index if not exists idx_matter_communications_firm_id on public.matter_communications (firm_id);
create index if not exists idx_matter_communications_drafted_by on public.matter_communications (drafted_by);
create index if not exists idx_matter_communications_reviewed_by on public.matter_communications (reviewed_by);
create index if not exists idx_matter_communications_approved_by on public.matter_communications (approved_by);

create index if not exists idx_matter_obligations_firm_id on public.matter_obligations (firm_id);
create index if not exists idx_matter_obligations_responsible_lawyer_id on public.matter_obligations (responsible_lawyer_id);
create index if not exists idx_matter_obligations_created_by on public.matter_obligations (created_by);

create index if not exists idx_matters_client_party_id on public.matters (client_party_id);
create index if not exists idx_matters_record_state_by on public.matters (record_state_by);
