-- Separate professional/work role from governance authority.
-- role_key remains the professional/operational role for backward compatibility.

alter table public.firm_memberships
  add column if not exists governance_role_key text not null default 'member',
  add column if not exists governance_title text;

alter table public.firm_invitations
  add column if not exists governance_role_key text not null default 'member',
  add column if not exists governance_title text;

-- Preserve existing owner authority as Founder. Existing managing partners keep
-- their professional role but are not silently promoted to Firm Head.
update public.firm_memberships
set governance_role_key = 'founder',
    governance_title = coalesce(nullif(governance_title,''), 'Founder')
where role_key = 'owner'
  and governance_role_key = 'member';

do $$ begin
  alter table public.firm_memberships
    add constraint firm_memberships_governance_role_key_check
    check (governance_role_key in ('founder','firm_head','managing_partner','administrator','member'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.firm_invitations
    add constraint firm_invitations_governance_role_key_check
    check (governance_role_key in ('firm_head','managing_partner','administrator','member'));
exception when duplicate_object then null; end $$;

create index if not exists idx_firm_memberships_governance_role
  on public.firm_memberships(firm_id, governance_role_key, status);

create or replace function public.accept_firm_invitation_service(invitation_token_hash text,accepting_user_id uuid)
returns table(firm_id uuid,role_key text)
language plpgsql security definer set search_path=''
as $$
declare
  v_inv public.firm_invitations%rowtype;
  v_email text;
  v_name text;
  v_legacy_role text;
begin
  select lower(email),coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),split_part(email,'@',1))
    into v_email,v_name from auth.users where id=accepting_user_id;
  if v_email is null then raise exception 'Authenticated user not found'; end if;

  select * into v_inv from public.firm_invitations i where i.token_hash=invitation_token_hash for update;
  if not found then raise exception 'Invitation not found'; end if;
  if v_inv.status<>'pending' then raise exception 'Invitation is not pending'; end if;
  if v_inv.expires_at<=now() then
    update public.firm_invitations set status='expired',updated_at=now() where id=v_inv.id;
    raise exception 'Invitation has expired';
  end if;
  if lower(v_inv.email)<>v_email then raise exception 'Invitation email does not match the authenticated account'; end if;

  v_legacy_role:=case v_inv.role_key
    when 'managing_partner' then 'Managing Partner'
    when 'partner' then 'Partner'
    when 'senior_associate' then 'Senior Associate'
    when 'junior_associate' then 'Junior Associate'
    when 'lawyer' then 'Lawyer'
    when 'paralegal' then 'Paralegal'
    when 'intern' then 'Intern'
    when 'administrator' then 'Project Manager'
    when 'finance' then 'Finance'
    when 'clerk' then 'Clerk'
    when 'knowledge_manager' then 'Knowledge Manager'
    else 'Junior Associate' end;

  if not exists(select 1 from public.lawyers l where l.id=accepting_user_id) then
    insert into public.lawyers(id,firm_id,full_name,role) values(accepting_user_id,v_inv.firm_id,v_name,v_legacy_role);
  end if;

  insert into public.firm_memberships(firm_id,user_id,role_key,governance_role_key,governance_title,title,status,is_primary)
  values(v_inv.firm_id,accepting_user_id,v_inv.role_key,v_inv.governance_role_key,v_inv.governance_title,v_legacy_role,'active',not exists(select 1 from public.firm_memberships fm where fm.user_id=accepting_user_id and fm.status='active'))
  on conflict(firm_id,user_id) do update set
    role_key=excluded.role_key,
    governance_role_key=excluded.governance_role_key,
    governance_title=excluded.governance_title,
    title=excluded.title,
    status='active',
    updated_at=now();

  insert into public.user_firm_context(user_id,active_firm_id,updated_at)
  values(accepting_user_id,v_inv.firm_id,now())
  on conflict(user_id) do update set active_firm_id=excluded.active_firm_id,updated_at=excluded.updated_at;

  update public.firm_invitations set status='accepted',accepted_by=accepting_user_id,accepted_at=now(),updated_at=now() where id=v_inv.id;
  return query select v_inv.firm_id,v_inv.role_key;
end $$;

revoke all on function public.accept_firm_invitation_service(text,uuid) from public,anon,authenticated;
grant execute on function public.accept_firm_invitation_service(text,uuid) to service_role;
