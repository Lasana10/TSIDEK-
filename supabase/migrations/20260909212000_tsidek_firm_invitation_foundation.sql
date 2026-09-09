create table if not exists public.firm_invitations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  email text not null,
  role_key text not null check (role_key in ('partner','lawyer','paralegal','intern','administrator','finance','clerk','knowledge_manager')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firm_invitations_email_normalized check (email=lower(btrim(email)))
);
create unique index if not exists idx_firm_invitation_pending_email on public.firm_invitations(firm_id,email) where status='pending';
create index if not exists idx_firm_invitations_firm_status on public.firm_invitations(firm_id,status);
create index if not exists idx_firm_invitations_expiry on public.firm_invitations(expires_at) where status='pending';
alter table public.firm_invitations enable row level security;
revoke all on public.firm_invitations from anon,authenticated;
grant select,insert,update on public.firm_invitations to authenticated;
create policy "governors read firm invitations" on public.firm_invitations for select to authenticated using (tsidek_private.is_firm_governor(firm_id));
create policy "governed roles create firm invitations" on public.firm_invitations for insert to authenticated with check (invited_by=(select auth.uid()) and status='pending' and tsidek_private.can_manage_firm_member(firm_id,role_key));
create policy "governed roles update firm invitations" on public.firm_invitations for update to authenticated using (tsidek_private.is_firm_governor(firm_id)) with check (tsidek_private.can_manage_firm_member(firm_id,role_key));
create or replace function tsidek_private.guard_firm_invitation_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.email:=lower(btrim(new.email)); new.updated_at:=now();
  if tg_op='UPDATE' and (new.firm_id<>old.firm_id or new.email<>old.email or new.token_hash<>old.token_hash or new.invited_by<>old.invited_by or new.created_at<>old.created_at) then raise exception 'Immutable invitation identity fields cannot be changed'; end if;
  if new.status='accepted' and (new.accepted_by is null or new.accepted_at is null) then raise exception 'Accepted invitations require accepted_by and accepted_at'; end if;
  return new;
end $$;
revoke all on function tsidek_private.guard_firm_invitation_integrity() from public,anon,authenticated;
drop trigger if exists trg_guard_firm_invitation_integrity on public.firm_invitations;
create trigger trg_guard_firm_invitation_integrity before insert or update on public.firm_invitations for each row execute function tsidek_private.guard_firm_invitation_integrity();
