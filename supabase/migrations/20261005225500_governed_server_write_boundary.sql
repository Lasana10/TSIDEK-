-- Convergence records are mutation-controlled by TSID server routes, which enforce
-- professional permissions before using the service-role database client.
-- Authenticated users retain RLS-filtered read access but cannot bypass those APIs
-- with direct Data API writes.

revoke insert, update, delete on public.matter_execution_actions from authenticated;
revoke insert, update, delete on public.matter_outcomes from authenticated;
revoke insert, update, delete on public.matter_legal_claims from authenticated;
revoke insert, update, delete on public.matter_communication_ingest from authenticated;
revoke insert, update, delete on public.firm_knowledge_entries from authenticated;
revoke insert, update, delete on public.jurisdiction_packs from authenticated;

-- Keep reads explicitly available; row-level security remains authoritative for scope.
grant select on public.matter_execution_actions to authenticated;
grant select on public.matter_outcomes to authenticated;
grant select on public.matter_legal_claims to authenticated;
grant select on public.matter_communication_ingest to authenticated;
grant select on public.firm_knowledge_entries to authenticated;
grant select on public.jurisdiction_packs to authenticated;
