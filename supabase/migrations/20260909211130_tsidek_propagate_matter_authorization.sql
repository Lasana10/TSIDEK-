-- Propagate the governed matter/ethical-wall boundary to remaining matter-linked surfaces.

do $$ declare t text; begin
  foreach t in array array['case_preparation_items','compliance_checklists','council_register_entries','digital_case_files','matter_case_fields','matter_client_updates','matter_comments','matter_context_snapshots','physical_files','quality_questionnaires','tasks','template_generations','invoices'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists "firm members can access case preparation items" on public.case_preparation_items;
drop policy if exists "firm members can access compliance checklists" on public.compliance_checklists;
drop policy if exists "firm members can access council register entries" on public.council_register_entries;
drop policy if exists "firm members can access digital case files" on public.digital_case_files;
drop policy if exists "firm members can access matter case fields" on public.matter_case_fields;
drop policy if exists "firm members can access matter client updates" on public.matter_client_updates;
drop policy if exists "firm members can access comments" on public.matter_comments;
drop policy if exists "firm members can access matter context snapshots" on public.matter_context_snapshots;
drop policy if exists "firm members can access physical files" on public.physical_files;
drop policy if exists "firm members can access quality questionnaires" on public.quality_questionnaires;
drop policy if exists "firm members can access tasks" on public.tasks;
drop policy if exists "firm members can access template generations" on public.template_generations;
drop policy if exists "firm members can access invoices" on public.invoices;

do $$ declare t text; begin
  foreach t in array array['case_preparation_items','compliance_checklists','council_register_entries','digital_case_files','matter_case_fields','matter_client_updates','matter_context_snapshots','quality_questionnaires','template_generations'] loop
    execute format('create policy %I on public.%I for select to authenticated using (tsidek_private.can_access_matter(matter_id))',t||' matter read',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (tsidek_private.can_access_matter(matter_id))',t||' matter insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (tsidek_private.can_access_matter(matter_id))',t||' matter update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and tsidek_private.can_access_matter(m.id) and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))))',t||' governed delete',t);
  end loop;
end $$;

create policy "matter comments read" on public.matter_comments for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter comments insert" on public.matter_comments for insert to authenticated with check (tsidek_private.can_access_matter(matter_id) and (author_id is null or author_id=(select auth.uid())));
create policy "matter comments update own" on public.matter_comments for update to authenticated using (tsidek_private.can_access_matter(matter_id) and author_id=(select auth.uid())) with check (tsidek_private.can_access_matter(matter_id) and author_id=(select auth.uid()));
create policy "matter comments governed delete" on public.matter_comments for delete to authenticated using (tsidek_private.can_access_matter(matter_id) and (author_id=(select auth.uid()) or exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id)))));

create policy "matter tasks read" on public.tasks for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "matter tasks insert" on public.tasks for insert to authenticated with check (tsidek_private.can_access_matter(matter_id) and exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));
create policy "matter tasks update" on public.tasks for update to authenticated using (tsidek_private.can_access_matter(matter_id) and (assigned_to=(select auth.uid()) or exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))))) with check (tsidek_private.can_access_matter(matter_id));
create policy "matter tasks delete" on public.tasks for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

create policy "physical files read" on public.physical_files for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "physical files insert" on public.physical_files for insert to authenticated with check (tsidek_private.can_access_matter(matter_id));
create policy "physical files update" on public.physical_files for update to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (tsidek_private.can_access_matter(matter_id));
create policy "physical files delete" on public.physical_files for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))));

create policy "invoices read" on public.invoices for select to authenticated using (tsidek_private.can_access_matter(matter_id));
create policy "invoices insert" on public.invoices for insert to authenticated with check (tsidek_private.can_access_matter(matter_id));
create policy "invoices update" on public.invoices for update to authenticated using (tsidek_private.can_access_matter(matter_id)) with check (tsidek_private.can_access_matter(matter_id));
create policy "invoices delete" on public.invoices for delete to authenticated using (exists(select 1 from public.matters m where m.id=matter_id and tsidek_private.is_firm_governor(m.firm_id)));

do $$ declare t text; begin
  foreach t in array array['chat_threads','client_guidance_profiles','jurisprudence_entries','knowledge_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;
drop policy if exists "firm members can access chat threads" on public.chat_threads;
drop policy if exists "firm members can access client guidance profiles" on public.client_guidance_profiles;
drop policy if exists "firm members can access jurisprudence entries" on public.jurisprudence_entries;
drop policy if exists "firm members can access knowledge entries" on public.knowledge_entries;

do $$ declare t text; begin
  foreach t in array array['chat_threads','client_guidance_profiles','jurisprudence_entries','knowledge_entries'] loop
    execute format('create policy %I on public.%I for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)))',t||' scoped read',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)))',t||' scoped insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)))',t||' scoped update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (firm_id=tsidek_private.current_firm_id() and ((matter_id is null and tsidek_private.is_firm_governor(firm_id)) or (matter_id is not null and exists(select 1 from public.matters m where m.id=matter_id and (m.lead_lawyer_id=(select auth.uid()) or tsidek_private.is_firm_governor(m.firm_id))))))',t||' governed delete',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['matter_events','intake_decision_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select,insert on public.%I to authenticated',t);
  end loop;
end $$;
drop policy if exists "firm members can access matter events" on public.matter_events;
drop policy if exists "firm members can access intake decision events" on public.intake_decision_events;
create policy "matter events scoped read" on public.matter_events for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "matter events append" on public.matter_events for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "intake events scoped read" on public.intake_decision_events for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "intake events append" on public.intake_decision_events for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));

alter table public.matter_opening_checklists enable row level security;
revoke all on public.matter_opening_checklists from anon,authenticated;
grant select,insert,update,delete on public.matter_opening_checklists to authenticated;
drop policy if exists "firm members can access opening checklists" on public.matter_opening_checklists;
create policy "opening checklist read" on public.matter_opening_checklists for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "opening checklist insert" on public.matter_opening_checklists for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_active_member(firm_id) and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "opening checklist update" on public.matter_opening_checklists for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "opening checklist governed delete" on public.matter_opening_checklists for delete to authenticated using (firm_id=tsidek_private.current_firm_id() and tsidek_private.is_firm_governor(firm_id));

alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select,insert,update on public.notifications to authenticated;
drop policy if exists "firm members can access notifications" on public.notifications;
create policy "notifications scoped read" on public.notifications for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "notifications scoped insert" on public.notifications for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "notifications scoped update" on public.notifications for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon,authenticated;
grant select,insert,update on public.chat_messages to authenticated;
drop policy if exists "firm members can access chat messages" on public.chat_messages;
create policy "chat messages scoped read" on public.chat_messages for select to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "chat messages scoped insert" on public.chat_messages for insert to authenticated with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));
create policy "chat messages scoped update" on public.chat_messages for update to authenticated using (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id))) with check (firm_id=tsidek_private.current_firm_id() and (matter_id is null or tsidek_private.can_access_matter(matter_id)));

create index if not exists idx_tasks_matter on public.tasks(matter_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_matter_comments_matter on public.matter_comments(matter_id);
create index if not exists idx_matter_comments_author on public.matter_comments(author_id);
create index if not exists idx_case_preparation_matter on public.case_preparation_items(matter_id);
create index if not exists idx_matter_events_firm on public.matter_events(firm_id);
create index if not exists idx_matter_client_updates_firm on public.matter_client_updates(firm_id);
create index if not exists idx_intake_events_firm on public.intake_decision_events(firm_id);
create index if not exists idx_jurisprudence_matter on public.jurisprudence_entries(matter_id);
create index if not exists idx_knowledge_matter on public.knowledge_entries(matter_id);
create index if not exists idx_template_generations_matter on public.template_generations(matter_id);
