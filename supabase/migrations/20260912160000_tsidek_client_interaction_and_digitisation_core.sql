-- TSIDKENU client interaction, privacy, digitisation and operational intelligence core

create table if not exists public.firm_interaction_policies (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  whatsapp_enabled boolean not null default false,
  call_logging_enabled boolean not null default true,
  call_recording_enabled boolean not null default false,
  transcription_enabled boolean not null default false,
  walk_in_enabled boolean not null default true,
  email_ingestion_enabled boolean not null default true,
  ai_extraction_enabled boolean not null default true,
  automatic_matter_matching boolean not null default false,
  default_ai_mode text not null default 'standard' check (default_ai_mode in ('standard','high_accuracy','private','local')),
  recording_retention_days integer not null default 90 check (recording_retention_days between 0 and 3650),
  transcript_retention_days integer not null default 365 check (transcript_retention_days between 0 and 3650),
  policy jsonb not null default '{}'::jsonb,
  updated_by uuid references public.lawyers(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.firm_legal_parameters (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  parameter_type text not null,
  parameter_key text not null,
  label_en text not null,
  label_fr text,
  description text,
  sort_order integer not null default 100,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, parameter_type, parameter_key)
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  party_type text not null default 'individual' check (party_type in ('individual','organisation')),
  display_name text not null,
  first_name text,
  last_name text,
  organisation_name text,
  phone text,
  email text,
  address text,
  client_status text not null default 'contact' check (client_status in ('contact','prospective_client','client','former_client','other')),
  preferred_language text not null default 'en' check (preferred_language in ('en','fr','bilingual','other')),
  communication_preferences jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.lawyers(id),
  updated_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists parties_firm_phone_unique on public.parties(firm_id, phone) where phone is not null and phone <> '';
create index if not exists parties_firm_name_idx on public.parties(firm_id, display_name);

create table if not exists public.matter_parties (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  relationship_type text not null default 'client',
  relationship_detail text,
  is_primary boolean not null default false,
  confidentiality_notes text,
  created_at timestamptz not null default now(),
  unique(matter_id, party_id, relationship_type)
);

create table if not exists public.legal_interactions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  primary_party_id uuid references public.parties(id) on delete set null,
  interaction_type text not null check (interaction_type in ('walk_in','office_meeting','phone_call','whatsapp','email','portal','referral','court_encounter','other')),
  direction text not null default 'inbound' check(direction in ('inbound','outbound','internal')),
  occurred_at timestamptz not null default now(),
  subject text,
  raw_note text,
  source_reference text,
  confidentiality_level text not null default 'firm' check(confidentiality_level in ('firm','restricted','highly_confidential')),
  consent_recording boolean,
  recording_storage_ref text,
  transcript_text text,
  transcript_status text not null default 'not_requested' check(transcript_status in ('not_requested','queued','processing','completed','failed','redacted')),
  ai_analysis_status text not null default 'not_requested' check(ai_analysis_status in ('not_requested','queued','processing','completed','failed','review_required')),
  ai_suggestions jsonb not null default '{}'::jsonb,
  verification_status text not null default 'unreviewed' check(verification_status in ('unreviewed','reviewed','partially_confirmed','confirmed','rejected')),
  assigned_to uuid references public.lawyers(id),
  created_by uuid references public.lawyers(id),
  reviewed_by uuid references public.lawyers(id),
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists legal_interactions_firm_occurred_idx on public.legal_interactions(firm_id, occurred_at desc);
create index if not exists legal_interactions_matter_idx on public.legal_interactions(matter_id, occurred_at desc);

create table if not exists public.interaction_extractions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  interaction_id uuid not null references public.legal_interactions(id) on delete cascade,
  extraction_type text not null check(extraction_type in ('fact','changed_fact','contradiction','instruction','commitment','deadline','document','person','organisation','risk','research_question','task','payment','conflict_name','client_update')),
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  source_start_ms integer,
  source_end_ms integer,
  confidence numeric(5,4),
  status text not null default 'suggested' check(status in ('suggested','confirmed','edited','rejected','superseded')),
  confirmed_by uuid references public.lawyers(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists interaction_extractions_interaction_idx on public.interaction_extractions(interaction_id, created_at);

create table if not exists public.matter_commitments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  interaction_id uuid references public.legal_interactions(id) on delete set null,
  party_id uuid references public.parties(id) on delete set null,
  owner_lawyer_id uuid references public.lawyers(id),
  commitment_by text not null,
  commitment_to text,
  description text not null,
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','completed','overdue','cancelled','disputed')),
  completed_at timestamptz,
  source text not null default 'manual' check(source in ('manual','interaction','ai_confirmed','workflow')),
  created_by uuid references public.lawyers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digitisation_batches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  title text not null,
  source_type text not null check(source_type in ('scanner','folder_import','phone_scan','storage_connector','manual_upload','legacy_archive')),
  source_location text,
  matter_id uuid references public.matters(id) on delete set null,
  status text not null default 'created' check(status in ('created','ingesting','review_required','approved','completed','failed')),
  total_files integer not null default 0,
  classified_files integer not null default 0,
  review_required_files integer not null default 0,
  approved_files integer not null default 0,
  created_by uuid references public.lawyers(id),
  approved_by uuid references public.lawyers(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digitisation_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  batch_id uuid not null references public.digitisation_batches(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  party_id uuid references public.parties(id) on delete set null,
  original_name text not null,
  storage_ref text not null,
  checksum_sha256 text,
  mime_type text,
  file_size_bytes bigint,
  extracted_text text,
  proposed_document_type text,
  proposed_document_date date,
  proposed_title text,
  classification_confidence numeric(5,4),
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  review_status text not null default 'pending' check(review_status in ('pending','accepted','corrected','rejected','duplicate')),
  reviewed_by uuid references public.lawyers(id),
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists digitisation_items_batch_idx on public.digitisation_items(batch_id, review_status);
create index if not exists digitisation_items_checksum_idx on public.digitisation_items(firm_id, checksum_sha256) where checksum_sha256 is not null;

create table if not exists public.firm_ai_policies (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  user_facing_mode text not null default 'standard' check(user_facing_mode in ('standard','high_accuracy','private','local')),
  standard_route jsonb not null default '{}'::jsonb,
  high_accuracy_route jsonb not null default '{}'::jsonb,
  private_route jsonb not null default '{}'::jsonb,
  local_route jsonb not null default '{}'::jsonb,
  highly_confidential_mode text not null default 'local' check(highly_confidential_mode in ('disabled','private','local')),
  allow_personal_provider_keys boolean not null default false,
  store_prompt_text boolean not null default false,
  prompt_retention_days integer not null default 0 check(prompt_retention_days between 0 and 3650),
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references public.lawyers(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_activity_ledger (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  actor_lawyer_id uuid references public.lawyers(id) on delete set null,
  interaction_id uuid references public.legal_interactions(id) on delete set null,
  mode text not null,
  provider_route text,
  model_name text,
  task_type text not null,
  source_document_ids uuid[] not null default '{}',
  input_hash text,
  output_hash text,
  citation_count integer not null default 0,
  outcome_status text not null default 'generated' check(outcome_status in ('generated','accepted','edited','rejected','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.firm_interaction_policies enable row level security;
alter table public.firm_legal_parameters enable row level security;
alter table public.parties enable row level security;
alter table public.matter_parties enable row level security;
alter table public.legal_interactions enable row level security;
alter table public.interaction_extractions enable row level security;
alter table public.matter_commitments enable row level security;
alter table public.digitisation_batches enable row level security;
alter table public.digitisation_items enable row level security;
alter table public.firm_ai_policies enable row level security;
alter table public.ai_activity_ledger enable row level security;

revoke all on table public.firm_interaction_policies, public.firm_legal_parameters, public.parties, public.matter_parties, public.legal_interactions, public.interaction_extractions, public.matter_commitments, public.digitisation_batches, public.digitisation_items, public.firm_ai_policies, public.ai_activity_ledger from anon;
grant select, insert, update on table public.parties, public.matter_parties, public.legal_interactions, public.interaction_extractions, public.matter_commitments, public.digitisation_batches, public.digitisation_items to authenticated;
grant select on table public.firm_legal_parameters, public.firm_interaction_policies, public.firm_ai_policies, public.ai_activity_ledger to authenticated;

create policy firm_interaction_policies_member_select on public.firm_interaction_policies for select to authenticated using (firm_id = public.current_firm_id());
create policy firm_legal_parameters_member_select on public.firm_legal_parameters for select to authenticated using (firm_id = public.current_firm_id());
create policy parties_member_access on public.parties for all to authenticated using (firm_id = public.current_firm_id()) with check (firm_id = public.current_firm_id());
create policy matter_parties_member_access on public.matter_parties for all to authenticated using (firm_id = public.current_firm_id() and public.can_access_matter(matter_id)) with check (firm_id = public.current_firm_id() and public.can_access_matter(matter_id));
create policy legal_interactions_member_access on public.legal_interactions for all to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id))) with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy interaction_extractions_member_access on public.interaction_extractions for all to authenticated using (firm_id = public.current_firm_id()) with check (firm_id = public.current_firm_id());
create policy matter_commitments_member_access on public.matter_commitments for all to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id))) with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy digitisation_batches_member_access on public.digitisation_batches for all to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id))) with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy digitisation_items_member_access on public.digitisation_items for all to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id))) with check (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));
create policy firm_ai_policies_member_select on public.firm_ai_policies for select to authenticated using (firm_id = public.current_firm_id());
create policy ai_activity_member_select on public.ai_activity_ledger for select to authenticated using (firm_id = public.current_firm_id() and (matter_id is null or public.can_access_matter(matter_id)));

insert into public.firm_interaction_policies(firm_id) select id from public.firms on conflict(firm_id) do nothing;
insert into public.firm_ai_policies(firm_id) select id from public.firms on conflict(firm_id) do nothing;
insert into public.firm_legal_parameters(firm_id, parameter_type, parameter_key, label_en, label_fr, sort_order)
select f.id, v.t, v.k, v.en, v.fr, v.s
from public.firms f
cross join (values
  ('confidentiality_level','firm','Firm','Cabinet',10),
  ('confidentiality_level','restricted','Restricted','Restreint',20),
  ('confidentiality_level','highly_confidential','Highly confidential','Hautement confidentiel',30),
  ('interaction_type','walk_in','Walk-in / Office visit','Visite au cabinet',10),
  ('interaction_type','office_meeting','Office meeting','Réunion au cabinet',20),
  ('interaction_type','phone_call','Phone call','Appel téléphonique',30),
  ('interaction_type','whatsapp','WhatsApp','WhatsApp',40),
  ('interaction_type','email','Email','E-mail',50),
  ('interaction_type','portal','Client portal','Portail client',60),
  ('interaction_type','referral','Referral','Référence',70)
) as v(t,k,en,fr,s)
on conflict(firm_id, parameter_type, parameter_key) do nothing;
