-- Canonical client communication proof: publishing is not delivery.
-- A verified client must explicitly acknowledge a published update.
create table if not exists public.tsidek_client_update_publications (
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 update_id uuid not null references public.matter_client_updates(id) on delete cascade,
 grant_id uuid not null references public.client_portal_grants(id) on delete restrict,
 client_email text not null,
 published_by uuid references public.lawyers(id) on delete set null,
 published_at timestamptz not null default now(),
 unique(update_id,grant_id)
);
create index if not exists tsidek_client_update_publications_grant_idx
 on public.tsidek_client_update_publications(grant_id,published_at desc);
create table if not exists public.tsidek_client_update_acknowledgements (
 id uuid primary key default gen_random_uuid(),
 publication_id uuid not null unique references public.tsidek_client_update_publications(id) on delete restrict,
 firm_id uuid not null references public.firms(id) on delete cascade,
 matter_id uuid not null references public.matters(id) on delete cascade,
 update_id uuid not null references public.matter_client_updates(id) on delete restrict,
 client_auth_user_id uuid not null references auth.users(id) on delete restrict,
 client_email text not null,
 acknowledged_at timestamptz not null default now()
);
create index if not exists tsidek_client_update_ack_matter_idx
 on public.tsidek_client_update_acknowledgements(firm_id,matter_id,acknowledged_at desc);
alter table public.tsidek_client_update_publications enable row level security;
alter table public.tsidek_client_update_acknowledgements enable row level security;
revoke all on public.tsidek_client_update_publications from public,anon,authenticated;
revoke all on public.tsidek_client_update_acknowledgements from public,anon,authenticated;
grant select,insert,update on public.tsidek_client_update_publications to service_role;
grant select,insert,update on public.tsidek_client_update_acknowledgements to service_role;

create or replace function public.tsidek_client_update_author_action(
 p_firm_id uuid,p_matter_id uuid,p_actor_id uuid,
 p_action text,p_update_id uuid,p_grant_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_update public.matter_client_updates%rowtype;v_grant public.client_portal_grants%rowtype;
 v_pub public.tsidek_client_update_publications%rowtype;v_actor text;v_role text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 select l.full_name,fm.role_key into v_actor,v_role
 from public.lawyers l join public.firm_memberships fm
  on fm.user_id=l.id and fm.firm_id=p_firm_id and fm.status='active'
 where l.id=p_actor_id;
 if not found then raise exception 'Active professional membership required';end if;
 perform 1 from public.matters m where m.id=p_matter_id and m.firm_id=p_firm_id
  and m.status<>'Closed' for update;
 if not found then raise exception 'Active matter required';end if;
 select * into v_update from public.matter_client_updates
  where id=p_update_id and firm_id=p_firm_id and matter_id=p_matter_id for update;
 if not found then raise exception 'Client update not found in matter';end if;
 if p_action='approve' then
  if v_update.status='Approved' then
   return jsonb_build_object('update_id',v_update.id,'status',v_update.status,'created',false);
  end if;
  if v_update.status<>'Draft' then raise exception 'Only draft updates can be approved';end if;
  if length(trim(v_update.body))<10 then raise exception 'Client update content is too short';end if;
  update public.matter_client_updates set status='Approved',
   approved_by=p_actor_id,approved_at=now(),updated_at=now(),delivery_note='Approved for controlled portal publication.'
   where id=v_update.id;
  insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
   values(p_firm_id,p_matter_id,'CLIENT_UPDATE_APPROVED','Client update approved',
   'Professional review completed before portal release',v_actor,v_role,
   jsonb_build_object('update_id',v_update.id));
  return jsonb_build_object('update_id',v_update.id,'status','Approved','created',true);
 elsif p_action='publish' then
  if p_grant_id is null then raise exception 'Client grant required';end if;
  select * into v_grant from public.client_portal_grants
  where id=p_grant_id and firm_id=p_firm_id and matter_id=p_matter_id
   and grant_status='ACTIVE' and revoked_at is null and can_view_updates=true for share;
  if not found then raise exception 'Active authorized client update grant required';end if;
  if v_update.status not in ('Approved','Published') then
   raise exception 'Professional approval required before publication';end if;
  insert into public.tsidek_client_update_publications(
   firm_id,matter_id,update_id,grant_id,client_email,published_by)
   values(p_firm_id,p_matter_id,p_update_id,p_grant_id,lower(v_grant.client_email),p_actor_id)
   on conflict(update_id,grant_id) do nothing
   returning * into v_pub;
  if not found then
   select * into v_pub from public.tsidek_client_update_publications
    where update_id=p_update_id and grant_id=p_grant_id;
   return jsonb_build_object('publication_id',v_pub.id,'update_id',v_update.id,'created',false);
  end if;
  update public.matter_client_updates set status='Published',
   delivery_status='Available in portal',delivery_note='Published to an authorized client portal; client acknowledgement pending.',
   updated_at=now() where id=v_update.id;
  insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
   values(p_firm_id,p_matter_id,'CLIENT_UPDATE_PUBLISHED','Client update available in portal',
   'Portal publication recorded; receipt is not yet acknowledged',v_actor,v_role,
   jsonb_build_object('update_id',v_update.id,'publication_id',v_pub.id,'grant_id',p_grant_id));
  return jsonb_build_object('publication_id',v_pub.id,'update_id',v_update.id,'created',true);
 end if;
 raise exception 'Unsupported client update action';
end $$;
revoke all on function public.tsidek_client_update_author_action(uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tsidek_client_update_author_action(uuid,uuid,uuid,text,uuid,uuid) to service_role;

create or replace function public.tsidek_acknowledge_client_publication(
 p_publication_id uuid,p_client_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pub public.tsidek_client_update_publications%rowtype;
 v_email text;v_ack public.tsidek_client_update_acknowledgements%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
 select lower(email) into v_email from auth.users where id=p_client_user_id;
 if v_email is null then raise exception 'Verified client session is required';end if;
 select * into v_pub from public.tsidek_client_update_publications
  where id=p_publication_id for share;
 if not found then raise exception 'Publication not found';end if;
 if lower(v_pub.client_email)<>v_email then raise exception 'Client identity does not match this publication';end if;
 if not exists (select 1 from public.client_portal_grants g
  where g.id=v_pub.grant_id and g.firm_id=v_pub.firm_id and g.matter_id=v_pub.matter_id
   and g.grant_status='ACTIVE' and g.revoked_at is null and g.can_view_updates=true
   and lower(g.client_email)=v_email)
 then raise exception 'Client portal grant is not active';end if;
 insert into public.tsidek_client_update_acknowledgements(
  publication_id,firm_id,matter_id,update_id,client_auth_user_id,client_email)
 values(v_pub.id,v_pub.firm_id,v_pub.matter_id,v_pub.update_id,p_client_user_id,v_email)
 on conflict(publication_id) do nothing returning * into v_ack;
 if not found then
  select * into v_ack from public.tsidek_client_update_acknowledgements
   where publication_id=v_pub.id;
  if v_ack.client_auth_user_id<>p_client_user_id then raise exception 'Publication already acknowledged by another identity';end if;
  return jsonb_build_object('acknowledgement_id',v_ack.id,'created',false);
 end if;
 update public.matter_client_updates set client_acknowledged_at=coalesce(client_acknowledged_at,now()),
  acknowledged_at=coalesce(acknowledged_at,now()),updated_at=now()
 where id=v_pub.update_id and firm_id=v_pub.firm_id and matter_id=v_pub.matter_id;
 insert into public.matter_events(firm_id,matter_id,event_type,title,details,actor_name,actor_role,metadata)
 values(v_pub.firm_id,v_pub.matter_id,'CLIENT_UPDATE_ACKNOWLEDGED',
 'Client acknowledged published update','Recorded from authenticated client portal session',
 'Authenticated client','Client',jsonb_build_object('publication_id',v_pub.id,'update_id',v_pub.update_id));
 return jsonb_build_object('acknowledgement_id',v_ack.id,'created',true);
end $$;
revoke all on function public.tsidek_acknowledge_client_publication(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tsidek_acknowledge_client_publication(uuid,uuid) to service_role;
