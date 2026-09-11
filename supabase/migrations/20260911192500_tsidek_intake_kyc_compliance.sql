create table if not exists public.prospect_kyc_reviews (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  subject_type text not null default 'individual' check (subject_type in ('individual','company','association','public_body','other')),
  legal_name text not null,
  trading_name text,
  registration_number text,
  tax_identifier text,
  nationality_or_country text,
  date_of_birth_or_incorporation date,
  address text,
  beneficial_owners jsonb not null default '[]'::jsonb,
  identity_evidence jsonb not null default '[]'::jsonb,
  source_of_funds text,
  source_of_wealth text,
  pep_status text not null default 'unchecked' check (pep_status in ('unchecked','clear','potential_match','confirmed')),
  sanctions_status text not null default 'unchecked' check (sanctions_status in ('unchecked','clear','potential_match','confirmed')),
  adverse_media_status text not null default 'unchecked' check (adverse_media_status in ('unchecked','clear','potential_match','confirmed')),
  risk_rating text not null default 'medium' check (risk_rating in ('low','medium','high','prohibited')),
  risk_reason text,
  status text not null default 'draft' check (status in ('draft','under_review','cleared','enhanced_due_diligence','rejected','expired')),
  reviewed_by uuid references public.lawyers(id), reviewed_at timestamptz, expires_at timestamptz,
  created_by uuid references public.lawyers(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.kyc_evidence_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  kyc_review_id uuid not null references public.prospect_kyc_reviews(id) on delete cascade,
  evidence_type text not null, title text not null, storage_path text, external_file_id text, checksum text, issuer text,
  issued_at date, expires_at date,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','expired')),
  verified_by uuid references public.lawyers(id), verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.prospect_kyc_reviews enable row level security;
alter table public.kyc_evidence_items enable row level security;
revoke all on public.prospect_kyc_reviews, public.kyc_evidence_items from anon;
grant select,insert,update on public.prospect_kyc_reviews, public.kyc_evidence_items to authenticated;
create policy "kyc_review_select_member" on public.prospect_kyc_reviews for select to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create policy "kyc_review_insert_member" on public.prospect_kyc_reviews for insert to authenticated with check (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create policy "kyc_review_update_member" on public.prospect_kyc_reviews for update to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id)) with check (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create policy "kyc_evidence_select_member" on public.kyc_evidence_items for select to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create policy "kyc_evidence_insert_member" on public.kyc_evidence_items for insert to authenticated with check (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create policy "kyc_evidence_update_member" on public.kyc_evidence_items for update to authenticated using (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id)) with check (firm_id=public.current_firm_id() and tsidek_private.is_active_member(firm_id));
create index if not exists idx_kyc_reviews_prospect on public.prospect_kyc_reviews(prospect_id,created_at desc);
create index if not exists idx_kyc_reviews_firm_status on public.prospect_kyc_reviews(firm_id,status,risk_rating);
create index if not exists idx_kyc_evidence_review on public.kyc_evidence_items(kyc_review_id,created_at desc);
