-- Production-synced TSIDEK multi-firm / matter access foundation.
-- Edanate is a tenant, never a hard-coded product boundary.

create or replace function public.current_lawyer_id()
returns uuid language sql stable security invoker set search_path = public
as $$ select l.id from public.lawyers l where l.id = (select auth.uid()) $$;

create or replace function public.can_access_matter(target_matter_id uuid)
returns boolean language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from public.matters m
    where m.id = target_matter_id
      and m.firm_id = public.current_firm_id()
      and (
        m.lead_lawyer_id = (select auth.uid())
        or exists (select 1 from public.matter_members mm where mm.matter_id=m.id and mm.lawyer_id=(select auth.uid()))
        or exists (select 1 from public.matter_access_overrides mao where mao.matter_id=m.id and mao.lawyer_id=(select auth.uid()) and mao.access_type='allow' and (mao.expires_at is null or mao.expires_at > now()))
      )
      and not exists (select 1 from public.matter_access_overrides mad where mad.matter_id=m.id and mad.lawyer_id=(select auth.uid()) and mad.access_type='deny' and (mad.expires_at is null or mad.expires_at > now()))
  )
$$;

revoke all on function public.current_lawyer_id() from public, anon;
revoke all on function public.can_access_matter(uuid) from public, anon;
grant execute on function public.current_lawyer_id() to authenticated;
grant execute on function public.can_access_matter(uuid) to authenticated;

alter table public.matters enable row level security;
alter table public.matter_members enable row level security;
drop policy if exists "firm members can manage their own matters" on public.matters;
drop policy if exists "firm members can read matter membership" on public.matter_members;

create policy "matter participants can read matters" on public.matters for select to authenticated using (public.can_access_matter(id));
create policy "firm lawyers can create matters" on public.matters for insert to authenticated with check (firm_id=public.current_firm_id() and (lead_lawyer_id is null or lead_lawyer_id in (select l.id from public.lawyers l where l.firm_id=public.current_firm_id())));
create policy "matter leads can update matters" on public.matters for update to authenticated using (firm_id=public.current_firm_id() and lead_lawyer_id=(select auth.uid()) and public.can_access_matter(id)) with check (firm_id=public.current_firm_id() and lead_lawyer_id=(select auth.uid()));
create policy "matter participants can read membership" on public.matter_members for select to authenticated using (public.can_access_matter(matter_id));
create policy "matter leads can add membership" on public.matter_members for insert to authenticated with check (exists(select 1 from public.matters m where m.id=matter_id and m.firm_id=public.current_firm_id() and m.lead_lawyer_id=(select auth.uid())) and exists(select 1 from public.lawyers l where l.id=lawyer_id and l.firm_id=public.current_firm_id()));
create policy "matter leads can update membership" on public.matter_members for update to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and m.firm_id=public.current_firm_id() and m.lead_lawyer_id=(select auth.uid()))) with check (exists(select 1 from public.matters m where m.id=matter_id and m.firm_id=public.current_firm_id() and m.lead_lawyer_id=(select auth.uid())) and exists(select 1 from public.lawyers l where l.id=lawyer_id and l.firm_id=public.current_firm_id()));
create policy "matter leads can remove membership" on public.matter_members for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and m.firm_id=public.current_firm_id() and m.lead_lawyer_id=(select auth.uid())));

create index if not exists idx_matter_members_lawyer_matter on public.matter_members(lawyer_id,matter_id);
create index if not exists idx_matter_access_overrides_lawyer_matter on public.matter_access_overrides(lawyer_id,matter_id);
create index if not exists idx_matter_access_overrides_active on public.matter_access_overrides(matter_id,lawyer_id,access_type,expires_at);
