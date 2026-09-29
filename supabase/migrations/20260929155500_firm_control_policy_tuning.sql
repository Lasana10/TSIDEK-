-- Remove overlapping permissive SELECT policies on Firm Control tables.
-- Active-member SELECT remains the sole read policy; governors receive operation-specific writes.

drop policy if exists "operating profile write governor" on public.firm_operating_profiles;
create policy "operating profile insert governor"
on public.firm_operating_profiles for insert to authenticated
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating profile update governor"
on public.firm_operating_profiles for update to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating profile delete governor"
on public.firm_operating_profiles for delete to authenticated
using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "operating recommendations write governor" on public.firm_operating_recommendations;
create policy "operating recommendations insert governor"
on public.firm_operating_recommendations for insert to authenticated
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating recommendations update governor"
on public.firm_operating_recommendations for update to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating recommendations delete governor"
on public.firm_operating_recommendations for delete to authenticated
using (tsidek_private.is_firm_governor(firm_id));

drop policy if exists "operating rules write governor" on public.firm_operating_rules;
create policy "operating rules insert governor"
on public.firm_operating_rules for insert to authenticated
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating rules update governor"
on public.firm_operating_rules for update to authenticated
using (tsidek_private.is_firm_governor(firm_id))
with check (tsidek_private.is_firm_governor(firm_id));
create policy "operating rules delete governor"
on public.firm_operating_rules for delete to authenticated
using (tsidek_private.is_firm_governor(firm_id));

create index if not exists idx_operating_recommendations_acted_by
  on public.firm_operating_recommendations(acted_by) where acted_by is not null;
create index if not exists idx_operating_rules_source_recommendation
  on public.firm_operating_rules(source_recommendation_id) where source_recommendation_id is not null;
