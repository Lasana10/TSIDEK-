create or replace function tsidek_private.current_firm_role(target_firm_id uuid)
returns text language sql stable security definer set search_path=''
as $$ select fm.role_key from public.firm_memberships fm where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid()) and fm.status='active' limit 1 $$;
revoke all on function tsidek_private.current_firm_role(uuid) from public, anon;
grant execute on function tsidek_private.current_firm_role(uuid) to authenticated;

create or replace function tsidek_private.can_manage_firm_member(target_firm_id uuid,target_role text)
returns boolean language sql stable security definer set search_path=''
as $$ select case tsidek_private.current_firm_role(target_firm_id)
  when 'owner' then true
  when 'partner' then target_role not in ('owner')
  when 'administrator' then target_role in ('lawyer','paralegal','intern','finance','clerk','knowledge_manager')
  else false end $$;
revoke all on function tsidek_private.can_manage_firm_member(uuid,text) from public, anon;
grant execute on function tsidek_private.can_manage_firm_member(uuid,text) to authenticated;

drop policy if exists "governors add firm members" on public.firm_memberships;
drop policy if exists "governors update firm members" on public.firm_memberships;
drop policy if exists "governors remove firm members" on public.firm_memberships;
create policy "governed roles add firm members" on public.firm_memberships for insert to authenticated with check (tsidek_private.can_manage_firm_member(firm_id,role_key));
create policy "governed roles update firm members" on public.firm_memberships for update to authenticated using (tsidek_private.can_manage_firm_member(firm_id,role_key)) with check (tsidek_private.can_manage_firm_member(firm_id,role_key));
create policy "governed roles remove firm members" on public.firm_memberships for delete to authenticated using (user_id<>(select auth.uid()) and tsidek_private.can_manage_firm_member(firm_id,role_key) and not (role_key='owner' and (select count(*) from public.firm_memberships x where x.firm_id=firm_memberships.firm_id and x.status='active' and x.role_key='owner')<=1));

drop policy if exists "matter governors create overrides" on public.matter_access_overrides;
create policy "matter governors create overrides" on public.matter_access_overrides for insert to authenticated
with check (tsidek_private.is_firm_governor(matter_access_overrides.firm_id) and matter_access_overrides.created_by=(select auth.uid()) and exists(select 1 from public.matters m where m.id=matter_access_overrides.matter_id and m.firm_id=matter_access_overrides.firm_id) and exists(select 1 from public.lawyers l where l.id=matter_access_overrides.lawyer_id and l.firm_id=matter_access_overrides.firm_id));

create or replace function tsidek_private.guard_override_integrity()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if tg_op='UPDATE' and (new.firm_id<>old.firm_id or new.matter_id<>old.matter_id or new.lawyer_id<>old.lawyer_id or new.created_by is distinct from old.created_by or new.created_at<>old.created_at) then
    raise exception 'Immutable matter access override identity fields cannot be changed';
  end if;
  return new;
end $$;
revoke all on function tsidek_private.guard_override_integrity() from public,anon,authenticated;
drop trigger if exists trg_guard_matter_access_override_integrity on public.matter_access_overrides;
create trigger trg_guard_matter_access_override_integrity before update on public.matter_access_overrides for each row execute function tsidek_private.guard_override_integrity();
