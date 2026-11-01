-- Role-native firm governance, solely from ACTIVE membership; no legacy lawyers.role.
create or replace function tsidek_private.is_firm_governor(target_firm_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.firm_memberships fm
  where fm.firm_id=target_firm_id and fm.user_id=(select auth.uid())
    and fm.status='active'
    and (
      fm.role_key in ('owner','managing_partner','partner','administrator')
      or fm.governance_role_key in ('founder','firm_head','managing_partner','administrator')
    )
 );
$$;
