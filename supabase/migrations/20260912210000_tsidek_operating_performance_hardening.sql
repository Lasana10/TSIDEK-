-- Cover high-traffic TSIDKENU foreign keys used by current operating surfaces.
create index if not exists idx_client_financial_statements_firm on public.client_financial_statements(firm_id);
create index if not exists idx_client_financial_statements_generated_by on public.client_financial_statements(generated_by) where generated_by is not null;
create index if not exists idx_invoices_created_by on public.invoices(created_by) where created_by is not null;
create index if not exists idx_matter_payments_invoice on public.matter_payments(invoice_id) where invoice_id is not null;
create index if not exists idx_matter_payments_confirmed_by on public.matter_payments(confirmed_by) where confirmed_by is not null;
create index if not exists idx_matter_payments_created_by on public.matter_payments(created_by) where created_by is not null;
create index if not exists idx_matter_disbursements_firm on public.matter_disbursements(firm_id);
create index if not exists idx_matter_disbursements_proof_document on public.matter_disbursements(proof_document_id) where proof_document_id is not null;
create index if not exists idx_matter_disbursements_approved_by on public.matter_disbursements(approved_by) where approved_by is not null;
create index if not exists idx_matter_disbursements_created_by on public.matter_disbursements(created_by) where created_by is not null;
create index if not exists idx_payment_receipts_matter on public.payment_receipts(matter_id);
create index if not exists idx_payment_receipts_issued_by on public.payment_receipts(issued_by) where issued_by is not null;
create index if not exists idx_performance_reviews_lawyer on public.performance_reviews(lawyer_id);
create index if not exists idx_performance_reviews_reviewed_by on public.performance_reviews(reviewed_by) where reviewed_by is not null;
create index if not exists idx_workflow_action_runs_stage_action on public.matter_workflow_action_runs(stage_action_id);
create index if not exists idx_workflow_action_runs_executed_by on public.matter_workflow_action_runs(executed_by) where executed_by is not null;
create index if not exists idx_workflow_transition_requests_transition on public.workflow_transition_requests(transition_id);
create index if not exists idx_finance_reconciliation_matter on public.finance_reconciliation_reviews(matter_id) where matter_id is not null;
create index if not exists idx_finance_reconciliation_prepared_by on public.finance_reconciliation_reviews(prepared_by) where prepared_by is not null;
create index if not exists idx_finance_reconciliation_reviewed_by on public.finance_reconciliation_reviews(reviewed_by) where reviewed_by is not null;
create index if not exists idx_document_review_events_firm on public.document_review_events(firm_id);
create index if not exists idx_document_review_events_matter on public.document_review_events(matter_id);
create index if not exists idx_document_review_events_actor on public.document_review_events(actor_lawyer_id) where actor_lawyer_id is not null;
create index if not exists idx_time_entries_firm on public.matter_time_entries(firm_id);
create index if not exists idx_time_entries_invoice on public.matter_time_entries(invoice_id) where invoice_id is not null;
create index if not exists idx_time_entries_approved_by on public.matter_time_entries(approved_by) where approved_by is not null;
create index if not exists idx_kyc_reviews_created_by on public.prospect_kyc_reviews(created_by) where created_by is not null;
create index if not exists idx_kyc_reviews_reviewed_by on public.prospect_kyc_reviews(reviewed_by) where reviewed_by is not null;
create index if not exists idx_kyc_evidence_firm on public.kyc_evidence_items(firm_id);
create index if not exists idx_kyc_evidence_verified_by on public.kyc_evidence_items(verified_by) where verified_by is not null;
create index if not exists idx_prospects_created_by on public.prospects(created_by) where created_by is not null;
create index if not exists idx_prospects_responsible_lawyer on public.prospects(responsible_lawyer_id) where responsible_lawyer_id is not null;
create index if not exists idx_engagements_firm on public.engagements(firm_id);
create index if not exists idx_engagements_approved_by on public.engagements(approved_by) where approved_by is not null;
create index if not exists idx_conflict_checks_firm on public.conflict_checks(firm_id);
create index if not exists idx_conflict_checks_checked_by on public.conflict_checks(checked_by) where checked_by is not null;

-- Avoid duplicate permissive SELECT policies on the new finance surfaces.
drop policy if exists matter_payments_write on public.matter_payments;
create policy matter_payments_insert on public.matter_payments for insert to authenticated
with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_payments_update on public.matter_payments for update to authenticated
using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id))
with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_payments_delete on public.matter_payments for delete to authenticated
using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));

drop policy if exists matter_disbursements_write on public.matter_disbursements;
create policy matter_disbursements_insert on public.matter_disbursements for insert to authenticated
with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_disbursements_update on public.matter_disbursements for update to authenticated
using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id))
with check (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
create policy matter_disbursements_delete on public.matter_disbursements for delete to authenticated
using (firm_id=public.current_firm_id() and public.can_access_matter(matter_id));
