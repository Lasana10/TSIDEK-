create or replace function public.bootstrap_firm_workspace(
  p_full_name text,
  p_firm_name text,
  p_country text default 'Cameroon',
  p_role text default 'Junior Associate'
)
returns table(firm_id uuid, role_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_firm_id uuid;
  v_role_key text;
  v_legacy_role text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(trim(p_full_name), '') is null or nullif(trim(p_firm_name), '') is null then
    raise exception 'Full name and firm name are required.';
  end if;

  select fm.firm_id, fm.role_key
    into v_firm_id, v_role_key
  from public.firm_memberships fm
  where fm.user_id = v_user_id and fm.status = 'active'
  order by fm.is_primary desc, fm.created_at asc
  limit 1;

  if v_firm_id is null then
    select l.firm_id into v_firm_id
    from public.lawyers l
    where l.id = v_user_id;
  end if;

  v_legacy_role := case
    when p_role in ('Partner','Senior Associate','Junior Associate','Paralegal','Intern','Project Manager') then p_role
    else 'Junior Associate'
  end;
  v_role_key := coalesce(v_role_key, case v_legacy_role
    when 'Partner' then 'partner'
    when 'Paralegal' then 'paralegal'
    when 'Intern' then 'intern'
    when 'Project Manager' then 'administrator'
    else 'lawyer'
  end);

  if v_firm_id is null then
    insert into public.firms(name, country)
    values(trim(p_firm_name), coalesce(nullif(trim(p_country), ''), 'Cameroon'))
    returning id into v_firm_id;
    v_role_key := 'owner';
  end if;

  insert into public.lawyers(id, firm_id, full_name, role)
  values(v_user_id, v_firm_id, trim(p_full_name), v_legacy_role)
  on conflict (id) do update
    set full_name = excluded.full_name;

  insert into public.firm_memberships(firm_id, user_id, role_key, title, status, is_primary)
  values(v_firm_id, v_user_id, v_role_key, v_legacy_role, 'active', true)
  on conflict (firm_id, user_id) do update
    set status = 'active', is_primary = true, updated_at = now();

  insert into public.user_firm_context(user_id, active_firm_id, updated_at)
  values(v_user_id, v_firm_id, now())
  on conflict (user_id) do update
    set active_firm_id = excluded.active_firm_id, updated_at = excluded.updated_at;

  return query select v_firm_id, v_role_key;
end;
$$;

revoke all on function public.bootstrap_firm_workspace(text,text,text,text) from public, anon;
grant execute on function public.bootstrap_firm_workspace(text,text,text,text) to authenticated;
