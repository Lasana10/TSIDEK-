-- Restore matter security columns expected by the live matter creation and access code.
-- This migration closes drift from the older standalone supabase_matter_security.sql.

alter table public.matters
  add column if not exists security_classification text not null default 'Standard',
  add column if not exists ethical_wall_enabled boolean not null default false;

do $$ begin
  alter table public.matters
    add constraint matters_security_classification_check
    check (security_classification in ('Standard','Confidential','Partner-only'));
exception when duplicate_object then null; end $$;
