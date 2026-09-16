alter table public.firm_brand_profiles
  add column if not exists logo_asset_path text,
  add column if not exists logo_mime_type text;

create table if not exists public.product_plans (
  plan_key text primary key,
  name text not null,
  description text not null,
  deployment_mode text not null default 'saas' check (deployment_mode in ('saas','private_cloud','dedicated','hybrid')),
  sort_order integer not null default 100,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_modules (
  module_key text primary key,
  name text not null,
  category text not null,
  description text not null,
  core_security boolean not null default false,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_modules (
  plan_key text not null references public.product_plans(plan_key) on delete cascade,
  module_key text not null references public.product_modules(module_key) on delete cascade,
  primary key (plan_key,module_key)
);

create table if not exists public.firm_subscriptions (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  plan_key text not null references public.product_plans(plan_key) on delete restrict default 'start',
  status text not null default 'active' check (status in ('trial','active','past_due','suspended','cancelled')),
  deployment_mode text not null default 'saas' check (deployment_mode in ('saas','private_cloud','dedicated','hybrid')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firm_module_overrides (
  firm_id uuid not null references public.firms(id) on delete cascade,
  module_key text not null references public.product_modules(module_key) on delete cascade,
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firm_id,module_key)
);

alter table public.product_plans enable row level security;
alter table public.product_modules enable row level security;
alter table public.plan_modules enable row level security;
alter table public.firm_subscriptions enable row level security;
alter table public.firm_module_overrides enable row level security;

revoke all on public.product_plans, public.product_modules, public.plan_modules, public.firm_subscriptions, public.firm_module_overrides from anon;
revoke insert, update, delete on public.product_plans, public.product_modules, public.plan_modules, public.firm_subscriptions, public.firm_module_overrides from authenticated;
grant select on public.product_plans, public.product_modules, public.plan_modules, public.firm_subscriptions, public.firm_module_overrides to authenticated;

create policy "plans_read_authenticated" on public.product_plans for select to authenticated using (active);
create policy "modules_read_authenticated" on public.product_modules for select to authenticated using (active);
create policy "plan_modules_read_authenticated" on public.plan_modules for select to authenticated using (true);
create policy "subscriptions_read_member" on public.firm_subscriptions for select to authenticated using (tsidek_private.is_active_member(firm_id));
create policy "module_overrides_read_member" on public.firm_module_overrides for select to authenticated using (tsidek_private.is_active_member(firm_id));

insert into public.product_plans (plan_key,name,description,deployment_mode,sort_order) values
  ('start','TSIDK Start','Core legal operations for solo lawyers and new practices.','saas',10),
  ('practice','TSIDK Practice','Complete daily operating system for boutique and small firms.','saas',20),
  ('firm_os','TSIDK Firm OS','Full operating platform for established firms.','saas',30),
  ('enterprise','TSIDK Enterprise','Multi-office governance, reporting and integration controls.','private_cloud',40),
  ('private','TSIDK Private','Dedicated infrastructure, storage and private AI options.','dedicated',50),
  ('sovereign','TSIDK Sovereign','Hybrid or local deployment with controlled cloud synchronization.','hybrid',60)
on conflict (plan_key) do update set name=excluded.name,description=excluded.description,deployment_mode=excluded.deployment_mode,sort_order=excluded.sort_order,updated_at=now();

insert into public.product_modules (module_key,name,category,description,core_security,sort_order) values
  ('identity_security','Identity & security','Core','Authentication, firm membership, roles and security controls.',true,10),
  ('matters','Matters','Core','Matter lifecycle, teams and ethical walls.',true,20),
  ('documents','OneFile & documents','Core','Governed files, evidence and document controls.',true,30),
  ('tasks_audit','Tasks & audit','Core','Assignments, deadlines, events and immutable accountability.',true,40),
  ('firm_studio','Firm Studio','Administration','Brand, taxonomy, forms and operating configuration.',false,50),
  ('intake','Intake & KYC','Operations','Prospects, conflicts, engagement and KYC.',false,60),
  ('finance','Finance','Operations','Fees, receipts, disbursements and reconciliation.',false,70),
  ('workflows','Workflow engine','Operations','Editable stages, gates, approvals and action packs.',false,80),
  ('interactions','Client interactions','Operations','Consultations, communications, commitments and controlled recordings.',false,90),
  ('law_bank','Law Bank','Knowledge','Source documents, authorities and verified legal research.',false,100),
  ('people','People & performance','Management','Real-work performance, review and development.',false,110),
  ('client_portal','Client portal','Experience','Client access, updates and financial transparency.',false,120),
  ('digitisation','Digitisation','Documents','Physical-to-digital intake, OCR and chain of custody.',false,130),
  ('institutional_ai','Institutional AI','Intelligence','Governed AI grounded in firm and authoritative sources.',false,140),
  ('integrations','Integrations & API','Platform','Provider connections, webhooks and external APIs.',false,150),
  ('advanced_reporting','Advanced reporting','Management','Cross-practice and executive operational reporting.',false,160),
  ('multi_office','Multi-office','Enterprise','Delegated administration across offices and entities.',false,170),
  ('private_runtime','Private runtime','Deployment','Dedicated storage, private AI and sovereign runtime controls.',false,180)
on conflict (module_key) do update set name=excluded.name,category=excluded.category,description=excluded.description,core_security=excluded.core_security,sort_order=excluded.sort_order,updated_at=now();

insert into public.plan_modules (plan_key,module_key)
select p.plan_key,m.module_key
from public.product_plans p cross join public.product_modules m
where m.core_security
   or (p.plan_key='start' and m.module_key in ('firm_studio','intake','finance'))
   or (p.plan_key='practice' and m.module_key in ('firm_studio','intake','finance','workflows','interactions','law_bank','people','client_portal'))
   or (p.plan_key='firm_os' and m.module_key not in ('multi_office','private_runtime'))
   or (p.plan_key='enterprise')
   or (p.plan_key in ('private','sovereign'))
on conflict do nothing;

insert into public.firm_subscriptions (firm_id,plan_key,status,deployment_mode,configuration)
select id,'firm_os','active','saas','{"founding_tenant":true}'::jsonb from public.firms
on conflict (firm_id) do nothing;

create or replace function tsidek_private.create_default_firm_subscription()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.firm_subscriptions (firm_id,plan_key,status,deployment_mode)
  values (new.id,'start','active','saas') on conflict (firm_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_default_firm_subscription on public.firms;
create trigger create_default_firm_subscription after insert on public.firms
for each row execute function tsidek_private.create_default_firm_subscription();

create or replace function public.firm_has_module(p_firm_id uuid,p_module_key text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when not tsidek_private.is_active_member(p_firm_id) then false
    else coalesce(
      (select o.enabled from public.firm_module_overrides o
       where o.firm_id=p_firm_id and o.module_key=p_module_key
         and (o.expires_at is null or o.expires_at>now())),
      exists(
        select 1 from public.firm_subscriptions s
        join public.plan_modules pm on pm.plan_key=s.plan_key
        where s.firm_id=p_firm_id and s.status in ('trial','active') and pm.module_key=p_module_key
      ),
      false
    )
  end;
$$;

revoke all on function public.firm_has_module(uuid,text) from public,anon;
grant execute on function public.firm_has_module(uuid,text) to authenticated;

create index if not exists idx_plan_modules_module on public.plan_modules(module_key,plan_key);
create index if not exists idx_firm_subscriptions_plan_status on public.firm_subscriptions(plan_key,status);
create index if not exists idx_firm_module_overrides_active on public.firm_module_overrides(firm_id,module_key,expires_at);
