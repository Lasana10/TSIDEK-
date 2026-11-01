-- Legal Life: active membership is the sole organizational authority.
-- Legacy single-home-firm lawyer rows never authorize read, role or membership.
create or replace function tsidek_private.is_active_member(target_firm_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.firm_memberships fm
   where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid()) and fm.status='active'
 );
$$;
create or replace function tsidek_private.current_firm_role(target_firm_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select fm.role_key from public.firm_memberships fm
 where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid()) and fm.status='active'
 limit 1;
$$;
create or replace function tsidek_private.current_firm_id()
returns uuid language sql stable security definer set search_path='' as $$
 select coalesce(
  (select ufc.active_firm_id from public.user_firm_context ufc
   where ufc.user_id=(select auth.uid())
    and tsidek_private.is_active_member(ufc.active_firm_id) limit 1),
  (select fm.firm_id from public.firm_memberships fm
   where fm.user_id=(select auth.uid()) and fm.status='active'
   order by fm.is_primary desc,fm.created_at asc limit 1)
 );
$$;
create or replace function tsidek_private.is_firm_governor(target_firm_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.firm_memberships fm
  where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid())
   and fm.status='active' and fm.role_key in ('owner','partner','administrator')
 );
$$;
