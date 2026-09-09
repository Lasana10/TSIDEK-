-- TSIDEK governed multi-firm core, synced from live Supabase production.
-- Edanate is a tenant; firm identity, roles and matter access remain data-driven.

create schema if not exists tsidek_private;
revoke all on schema tsidek_private from public, anon;
grant usage on schema tsidek_private to authenticated;

create table if not exists public.firm_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null check (role_key in ('owner','partner','lawyer','paralegal','intern','administrator','finance','clerk','knowledge_manager')),
  title text,
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id,user_id)
);

create table if not exists public.user_firm_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_firm_id uuid not null references public.firms(id) on delete cascade,
  updated_at timestamptz not null default now()
);

insert into public.firm_memberships(firm_id,user_id,role_key,title,status,is_primary)
select l.firm_id,l.id,
  case l.role when 'Partner' then 'partner' when 'Paralegal' then 'paralegal' when 'Intern' then 'intern' when 'Project Manager' then 'administrator' else 'lawyer' end,
  l.role,'active',true
from public.lawyers l on conflict (firm_id,user_id) do nothing;

create or replace function tsidek_private.is_active_member(target_firm_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and (
  exists(select 1 from public.firm_memberships fm where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid()) and fm.status='active')
  or exists(select 1 from public.lawyers l where l.firm_id=target_firm_id and l.id=(select auth.uid()))
) $$;

create or replace function tsidek_private.current_firm_id()
returns uuid language sql stable security definer set search_path=''
as $$ select coalesce(
  (select ufc.active_firm_id from public.user_firm_context ufc where ufc.user_id=(select auth.uid()) and tsidek_private.is_active_member(ufc.active_firm_id) limit 1),
  (select fm.firm_id from public.firm_memberships fm where fm.user_id=(select auth.uid()) and fm.status='active' order by fm.is_primary desc,fm.created_at asc limit 1),
  (select l.firm_id from public.lawyers l where l.id=(select auth.uid()) limit 1)
) $$;

create or replace function tsidek_private.is_firm_governor(target_firm_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and (
  exists(select 1 from public.firm_memberships fm where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid()) and fm.status='active' and fm.role_key in ('owner','partner','administrator'))
  or exists(select 1 from public.lawyers l where l.firm_id=target_firm_id and l.id=(select auth.uid()) and l.role='Partner')
) $$;

create or replace function tsidek_private.can_access_matter(target_matter_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
  select 1 from public.matters m
  where m.id=target_matter_id and tsidek_private.is_active_member(m.firm_id)
    and not exists(select 1 from public.matter_access_overrides d where d.matter_id=m.id and d.lawyer_id=(select auth.uid()) and d.access_type='deny' and (d.expires_at is null or d.expires_at>now()))
    and (m.lead_lawyer_id=(select auth.uid())
      or exists(select 1 from public.matter_members mm where mm.matter_id=m.id and mm.lawyer_id=(select auth.uid()))
      or exists(select 1 from public.matter_access_overrides a where a.matter_id=m.id and a.lawyer_id=(select auth.uid()) and a.access_type='allow' and (a.expires_at is null or a.expires_at>now())))
) $$;

revoke all on all functions in schema tsidek_private from public, anon;
grant execute on function tsidek_private.is_active_member(uuid) to authenticated;
grant execute on function tsidek_private.current_firm_id() to authenticated;
grant execute on function tsidek_private.is_firm_governor(uuid) to authenticated;
grant execute on function tsidek_private.can_access_matter(uuid) to authenticated;

create or replace function public.current_firm_id() returns uuid language sql stable security invoker set search_path='' as $$ select tsidek_private.current_firm_id() $$;
create or replace function public.can_access_matter(target_matter_id uuid) returns boolean language sql stable security invoker set search_path='' as $$ select tsidek_private.can_access_matter(target_matter_id) $$;
revoke all on function public.current_firm_id() from anon;
revoke all on function public.can_access_matter(uuid) from anon;
grant execute on function public.current_firm_id() to authenticated;
grant execute on function public.can_access_matter(uuid) to authenticated;

alter table public.firm_memberships enable row level security;
alter table public.user_firm_context enable row level security;
revoke all on public.firm_memberships,public.user_firm_context from anon,authenticated;
grant select,insert,update,delete on public.firm_memberships,public.user_firm_context to authenticated;

create policy "members read active firm membership" on public.firm_memberships for select to authenticated using (user_id=(select auth.uid()) or tsidek_private.current_firm_id()=firm_id);
create policy "governors add firm members" on public.firm_memberships for insert to authenticated with check (tsidek_private.is_firm_governor(firm_id));
create policy "governors update firm members" on public.firm_memberships for update to authenticated using (tsidek_private.is_firm_governor(firm_id)) with check (tsidek_private.is_firm_governor(firm_id));
create policy "governors remove firm members" on public.firm_memberships for delete to authenticated using (tsidek_private.is_firm_governor(firm_id) and user_id<>(select auth.uid()));
create policy "users read own firm context" on public.user_firm_context for select to authenticated using (user_id=(select auth.uid()));
create policy "users choose active member firm" on public.user_firm_context for insert to authenticated with check (user_id=(select auth.uid()) and tsidek_private.is_active_member(active_firm_id));
create policy "users switch active member firm" on public.user_firm_context for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and tsidek_private.is_active_member(active_firm_id));
create policy "users clear own firm context" on public.user_firm_context for delete to authenticated using (user_id=(select auth.uid()));

alter table public.matter_access_overrides add constraint matter_access_overrides_access_type_check check (access_type in ('allow','deny')) not valid;
alter table public.matter_access_overrides validate constraint matter_access_overrides_access_type_check;

drop policy if exists "firm members can access matter access overrides" on public.matter_access_overrides;
create policy "matter governors read overrides" on public.matter_access_overrides for select to authenticated using (tsidek_private.is_firm_governor(firm_id));
create policy "matter governors create overrides" on public.matter_access_overrides for insert to authenticated with check (tsidek_private.is_firm_governor(firm_id) and created_by=(select auth.uid()) and exists(select 1 from public.matters m where m.id=matter_id and m.firm_id=firm_id) and exists(select 1 from public.lawyers l where l.id=lawyer_id and l.firm_id=firm_id));
create policy "matter governors update overrides" on public.matter_access_overrides for update to authenticated using (tsidek_private.is_firm_governor(firm_id)) with check (tsidek_private.is_firm_governor(firm_id));
create policy "matter governors delete overrides" on public.matter_access_overrides for delete to authenticated using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "matter participants can read matters" on public.matters;
drop policy if exists "firm lawyers can create matters" on public.matters;
drop policy if exists "matter leads can update matters" on public.matters;
create policy "matter participants can read matters" on public.matters for select to authenticated using (tsidek_private.can_access_matter(id));
create policy "active members can create matters" on public.matters for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_active_member(firm_id) and (lead_lawyer_id=(select auth.uid()) or (lead_lawyer_id is not null and tsidek_private.is_firm_governor(firm_id))));
create policy "matter leads or governors update matters" on public.matters for update to authenticated using (tsidek_private.can_access_matter(id) and (lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(firm_id))) with check (firm_id=tsidek_private.current_firm_id());

drop policy if exists "matter participants can read membership" on public.matter_members;
drop policy if exists "matter leads can add membership" on public.matter_members;
drop policy if exists "matter leads can update membership" on public.matter_members;
drop policy if exists "matter leads can remove membership" on public.matter_members;
create policy "matter participants can read membership" on public.matter_members for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter leads or governors add membership" on public.matter_members for insert to authenticated with check (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id)) and exists(select 1 from public.lawyers l where l.id=lawyer_id and l.firm_id=m.firm_id)));
create policy "matter leads or governors update membership" on public.matter_members for update to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id)))) with check (exists(select 1 from public.matters m where m.id=matter_id and exists(select 1 from public.lawyers l where l.id=lawyer_id and l.firm_id=m.firm_id)));
create policy "matter leads or governors remove membership" on public.matter_members for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

drop policy if exists "firm members can access documents" on public.documents;
revoke all on public.documents from anon,authenticated;
grant select,insert,update,delete on public.documents to authenticated;
create policy "matter participants read documents" on public.documents for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter participants add documents" on public.documents for insert to authenticated with check (tsidek_private.can_access_matter(matter_id) and (uploaded_by is null or uploaded_by=(select auth.uid())));
create policy "matter participants update documents" on public.documents for update to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (tsidek_private.can_access_matter(matter_id));
create policy "matter leads or governors delete documents" on public.documents for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and tsidek_private.can_access_matter(m.id) and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

drop policy if exists "firm members can access finance ledger" on public.finance_ledger_entries;
revoke all on public.finance_ledger_entries from anon,authenticated;
grant select,insert on public.finance_ledger_entries to authenticated;
create policy "authorized matter users read finance" on public.finance_ledger_entries for select to authenticated using ((matter_id is not null and tsidek_private.can_access_matter(matter_id)) or (matter_id is null and tsidek_private.is_firm_governor(firm_id)));
create policy "authorized users append finance" on public.finance_ledger_entries for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and created_by=(select auth.uid()) and ((matter_id is not null and tsidek_private.can_access_matter(matter_id)) or (matter_id is null and tsidek_private.is_firm_governor(firm_id))));

drop policy if exists "firm members can access client portal grants" on public.client_portal_grants;
revoke all on public.client_portal_grants from anon,authenticated;
grant select,insert,update,delete on public.client_portal_grants to authenticated;
create policy "matter participants read client grants" on public.client_portal_grants for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter leads or governors create client grants" on public.client_portal_grants for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and granted_by=(select auth.uid()) and exists(select 1 from public.matters m where m.id=matter_id and tsidek_private.can_access_matter(m.id) and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));
create policy "matter leads or governors update client grants" on public.client_portal_grants for update to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and tsidek_private.can_access_matter(m.id) and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id)))) with check (firm_id=tsidek_private.current_firm_id());
create policy "matter leads or governors remove client grants" on public.client_portal_grants for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

drop policy if exists "firm members can access ai work products" on public.ai_work_products;
revoke all on public.ai_work_products from anon,authenticated;
grant select,insert,update,delete on public.ai_work_products to authenticated;
create policy "authorized users read ai work" on public.ai_work_products for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users create ai work" on public.ai_work_products for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and generated_by=(select auth.uid()) and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized reviewers update ai work" on public.ai_work_products for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (generated_by=(select auth.uid()) or reviewed_by=(select auth.uid()) or approved_by=(select auth.uid()) or tsidek_private.is_firm_governor(firm_id)) and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id());
create policy "governors delete ai work" on public.ai_work_products for delete to authenticated using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "firm members can access matter authority links" on public.matter_authority_links;
revoke all on public.matter_authority_links from anon,authenticated;
grant select,insert,update,delete on public.matter_authority_links to authenticated;
create policy "matter participants read authority links" on public.matter_authority_links for select to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
create policy "matter participants add authority links" on public.matter_authority_links for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and added_by=(select auth.uid()) and tsidek_private.can_access_matter(matter_id));
create policy "matter participants update authority links" on public.matter_authority_links for update to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
create policy "matter leads or governors remove authority links" on public.matter_authority_links for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

drop policy if exists "firm members can access legal authorities" on public.legal_authorities;
revoke all on public.legal_authorities from anon,authenticated;
grant select,insert,update,delete on public.legal_authorities to authenticated;
create policy "firm members read legal authorities" on public.legal_authorities for select to authenticated using (firm_id=tsidek_private.current_firm_id());
create policy "firm members add legal authorities" on public.legal_authorities for insert to authenticated with check (firm_id=tsidek_private.current_firm_id());
create policy "firm members update legal authorities" on public.legal_authorities for update to authenticated using (firm_id=tsidek_private.current_firm_id()) with check (firm_id=tsidek_private.current_firm_id());
create policy "governors delete legal authorities" on public.legal_authorities for delete to authenticated using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "firm members can access institutional memory" on public.institutional_memory_entries;
revoke all on public.institutional_memory_entries from anon,authenticated;
grant select,insert,update,delete on public.institutional_memory_entries to authenticated;
create policy "authorized users read institutional memory" on public.institutional_memory_entries for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "authorized users propose institutional memory" on public.institutional_memory_entries for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and proposed_by=(select auth.uid()) and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "proposers or governors update institutional memory" on public.institutional_memory_entries for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (proposed_by=(select auth.uid()) or tsidek_private.is_firm_governor(firm_id)) and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id());
create policy "governors delete institutional memory" on public.institutional_memory_entries for delete to authenticated using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "firm members can access closure reviews" on public.matter_closure_reviews;
revoke all on public.matter_closure_reviews from anon,authenticated;
grant select,insert,update,delete on public.matter_closure_reviews to authenticated;
create policy "matter participants read closure reviews" on public.matter_closure_reviews for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter leads or governors create closure reviews" on public.matter_closure_reviews for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));
create policy "matter leads or governors update closure reviews" on public.matter_closure_reviews for update to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id)))) with check (firm_id=tsidek_private.current_firm_id());
create policy "governors delete closure reviews" on public.matter_closure_reviews for delete to authenticated using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "firm members can access audit logs" on public.audit_logs;
revoke all on public.audit_logs from anon,authenticated;
grant select,insert on public.audit_logs to authenticated;
create policy "authorized users read audit logs" on public.audit_logs for select to authenticated using (firm_id=tsidek_private.current_firm_id() and ((matter_id is not null and tsidek_private.can_access_matter(matter_id)) or (matter_id is null and tsidek_private.is_firm_governor(firm_id))));
create policy "authorized users append own audit logs" on public.audit_logs for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and actor_id=(select auth.uid()) and (matter_id is null or tsidek_private.can_access_matter(matter_id)));

create index if not exists idx_firm_memberships_user_status on public.firm_memberships(user_id,status);
create index if not exists idx_firm_memberships_firm_status on public.firm_memberships(firm_id,status);
create index if not exists idx_user_firm_context_active_firm on public.user_firm_context(active_firm_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_finance_ledger_created_by on public.finance_ledger_entries(created_by);
create index if not exists idx_ai_work_generated_by on public.ai_work_products(generated_by);
create index if not exists idx_ai_work_reviewed_by on public.ai_work_products(reviewed_by);
create index if not exists idx_ai_work_approved_by on public.ai_work_products(approved_by);
create index if not exists idx_client_portal_grants_granted_by on public.client_portal_grants(granted_by);
create index if not exists idx_legal_authorities_verified_by on public.legal_authorities(verified_by);
create index if not exists idx_matter_authority_links_added_by on public.matter_authority_links(added_by);
create index if not exists idx_matter_closure_reviews_approved_by on public.matter_closure_reviews(approved_by);
create index if not exists idx_memory_proposed_by on public.institutional_memory_entries(proposed_by);
create index if not exists idx_memory_approved_by on public.institutional_memory_entries(approved_by);
