-- Compatibility marker for the production hardening pass.
-- Remaining matter-linked surfaces are explicitly governed by
-- 20260909211130_tsidek_propagate_matter_authorization.sql.
-- This ledger-alignment migration is intentionally idempotent.
select 1;
