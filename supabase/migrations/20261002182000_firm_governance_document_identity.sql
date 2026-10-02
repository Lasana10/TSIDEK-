alter table public.firm_memberships drop constraint if exists firm_memberships_role_key_check;
alter table public.firm_memberships add constraint firm_memberships_role_key_check check (role_key = any (array['owner','managing_partner','partner','lawyer','senior_associate','junior_associate','paralegal','intern','administrator','intake','finance','compliance','records','clerk','knowledge_manager']::text[]));

alter table public.firm_brand_profiles
  add column if not exists document_identity jsonb not null default '{}'::jsonb,
  add column if not exists ui_theme jsonb not null default '{}'::jsonb;

create table if not exists public.matter_record_change_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  request_type text not null default 'remove' check (request_type in ('remove')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reason text not null,
  requested_by uuid not null references public.lawyers(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.lawyers(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists ux_matter_record_change_pending_remove on public.matter_record_change_requests(matter_id,request_type) where status='pending';
create index if not exists idx_matter_record_change_requests_firm_status on public.matter_record_change_requests(firm_id,status,requested_at desc);
alter table public.matter_record_change_requests enable row level security;
revoke all on table public.matter_record_change_requests from anon;
revoke insert,update,delete on table public.matter_record_change_requests from authenticated;
grant select on table public.matter_record_change_requests to authenticated;
grant select,insert,update,delete on table public.matter_record_change_requests to service_role;
drop policy if exists matter_record_change_member_read on public.matter_record_change_requests;
create policy matter_record_change_member_read on public.matter_record_change_requests for select to authenticated using ((select tsidek_private.is_active_member(firm_id)));

create table if not exists public.firm_document_styles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  document_kind text not null,
  label text not null,
  header_mode text not null default 'full' check (header_mode in ('full','compact','none')),
  footer_mode text not null default 'legal' check (footer_mode in ('legal','compact','none')),
  show_logo boolean not null default true,
  show_matter_reference boolean not null default true,
  show_confidentiality boolean not null default true,
  signature_mode text not null default 'lawyer' check (signature_mode in ('lawyer','firm','none')),
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references public.lawyers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id,document_kind)
);
alter table public.firm_document_styles enable row level security;
revoke all on table public.firm_document_styles from anon;
grant select on table public.firm_document_styles to authenticated;
grant select,insert,update,delete on table public.firm_document_styles to service_role;
drop policy if exists firm_document_styles_member_read on public.firm_document_styles;
create policy firm_document_styles_member_read on public.firm_document_styles for select to authenticated using ((select tsidek_private.is_active_member(firm_id)));
drop policy if exists firm_document_styles_governor_insert on public.firm_document_styles;
create policy firm_document_styles_governor_insert on public.firm_document_styles for insert to authenticated with check ((select tsidek_private.is_firm_governor(firm_id)));
drop policy if exists firm_document_styles_governor_update on public.firm_document_styles;
create policy firm_document_styles_governor_update on public.firm_document_styles for update to authenticated using ((select tsidek_private.is_firm_governor(firm_id))) with check ((select tsidek_private.is_firm_governor(firm_id)));
drop policy if exists firm_document_styles_governor_delete on public.firm_document_styles;
create policy firm_document_styles_governor_delete on public.firm_document_styles for delete to authenticated using ((select tsidek_private.is_firm_governor(firm_id)));

insert into public.firm_document_styles (firm_id,document_kind,label,header_mode,footer_mode,show_logo,show_matter_reference,show_confidentiality,signature_mode,configuration)
select f.id, v.document_kind, v.label, v.header_mode, v.footer_mode, v.show_logo, v.show_matter_reference, v.show_confidentiality, v.signature_mode, '{}'::jsonb
from public.firms f
cross join (values
 ('formal_correspondence','Formal legal correspondence','full','legal',true,true,true,'lawyer'),
 ('court_document','Court document','compact','compact',true,true,true,'lawyer'),
 ('client_report','Client report / Compte Rendu','full','legal',true,true,true,'lawyer'),
 ('invoice','Invoice','full','legal',true,true,false,'firm'),
 ('receipt','Receipt','compact','legal',true,true,false,'firm'),
 ('internal_memo','Internal memo','compact','none',true,true,true,'lawyer'),
 ('external_review','External review','compact','compact',true,true,true,'lawyer'),
 ('case_label','Physical case label','compact','none',true,true,true,'none')
) as v(document_kind,label,header_mode,footer_mode,show_logo,show_matter_reference,show_confidentiality,signature_mode)
on conflict (firm_id,document_kind) do nothing;