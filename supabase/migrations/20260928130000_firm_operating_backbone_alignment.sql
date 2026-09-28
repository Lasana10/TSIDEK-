-- TSIDKENU firm operating backbone alignment.
-- Keep office/business ledger entries independent from client cases and broaden workflow families.

alter table public.finance_ledger_entries alter column matter_id drop not null;

alter table public.firm_workflow_definitions
  drop constraint if exists firm_workflow_definitions_subject_type_check;

alter table public.firm_workflow_definitions
  add constraint firm_workflow_definitions_subject_type_check
  check (subject_type in ('prospect','matter','engagement','client','billing','expense','document','office'));
