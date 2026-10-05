-- Adaptive legal-work model: one matter can carry different legal approaches without being forced into litigation.
alter table public.matters add column if not exists engagement_nature text not null default 'custom';
alter table public.matters add column if not exists practice_area text;
alter table public.matters add column if not exists service_type text;
alter table public.matters add column if not exists client_objective text;
alter table public.matters add column if not exists plan_label text not null default 'Matter plan';

alter table public.matters drop constraint if exists matters_engagement_nature_check;
alter table public.matters add constraint matters_engagement_nature_check check (engagement_nature in ('contentious','transactional','registration','advisory','diligence','compliance','custom'));

create table if not exists public.matter_workstreams (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  name text not null,
  workstream_type text not null default 'general',
  status text not null default 'active' check (status in ('planned','active','blocked','completed','cancelled')),
  sequence_no integer not null default 0,
  objective text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_milestones (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  workstream_id uuid references public.matter_workstreams(id) on delete cascade,
  title text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','waived')),
  due_at timestamptz,
  source_kind text not null default 'matter_plan' check (source_kind in ('matter_plan','law','court','authority','contract','client','internal','ai_proposal')),
  source_detail text,
  sequence_no integer not null default 0,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matter_workstreams_matter on public.matter_workstreams(matter_id,status,sequence_no);
create index if not exists idx_matter_milestones_matter on public.matter_milestones(matter_id,status,sequence_no);

alter table public.matter_workstreams enable row level security;
alter table public.matter_milestones enable row level security;
revoke all on public.matter_workstreams, public.matter_milestones from anon;
grant select,insert,update,delete on public.matter_workstreams, public.matter_milestones to authenticated;

drop policy if exists matter_workstreams_access on public.matter_workstreams;
create policy matter_workstreams_access on public.matter_workstreams for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));

drop policy if exists matter_milestones_access on public.matter_milestones;
create policy matter_milestones_access on public.matter_milestones for all to authenticated
using (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id))
with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.can_access_matter(matter_id));
