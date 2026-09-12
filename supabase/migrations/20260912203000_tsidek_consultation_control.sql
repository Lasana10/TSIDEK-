alter table public.legal_interactions add column if not exists client_cycle_stage text not null default 'enquiry' check(client_cycle_stage in ('enquiry','intake','preliminary_discussion','consultation','engagement','matter'));
alter table public.legal_interactions add column if not exists substantive_advice_detected boolean not null default false;
alter table public.legal_interactions add column if not exists consultation_status text not null default 'not_required' check(consultation_status in ('not_required','suggested','scheduled','paid','waived','credited','completed'));
alter table public.legal_interactions add column if not exists consultation_fee_xaf bigint;
alter table public.legal_interactions add column if not exists consultation_conversion_reason text;
create index if not exists legal_interactions_cycle_stage_idx on public.legal_interactions(firm_id,client_cycle_stage,occurred_at desc);
