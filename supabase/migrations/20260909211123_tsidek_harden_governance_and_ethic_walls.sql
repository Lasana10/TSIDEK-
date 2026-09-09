-- Compatibility marker for the live production migration recorded under this version.
-- The effective governance and ethical-wall state is fully reproduced by:
--   20260909210935_tsidek_harden_governance_and_override_integrity.sql
--   20260909211130_tsidek_propagate_matter_authorization.sql
-- Keep this migration intentionally idempotent/no-op so repository migration ordering
-- matches the live Supabase migration ledger without duplicating policy creation.
select 1;
