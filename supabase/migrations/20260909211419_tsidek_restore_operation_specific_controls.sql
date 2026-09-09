-- Guardrail: no matter-linked table may retain broad FOR ALL/public-role policies.
do $$
begin
  if exists (
    select 1
    from pg_policies p
    where p.schemaname='public'
      and p.tablename in (
        select distinct c.table_name
        from information_schema.columns c
        where c.table_schema='public' and c.column_name='matter_id'
      )
      and (p.cmd='ALL' or p.roles @> array['public']::name[])
  ) then
    raise exception 'Matter authorization invariant failed: broad ALL/public policy remains';
  end if;
end $$;
