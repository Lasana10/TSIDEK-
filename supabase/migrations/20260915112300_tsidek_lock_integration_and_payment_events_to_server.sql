-- Lock integration metadata and payment-provider event payloads to the trusted server layer.
-- Application routes use the Supabase service role after firm-level authorization.

alter table public.firm_integration_connections enable row level security;
alter table public.payment_provider_events enable row level security;

revoke all on table public.firm_integration_connections from anon, authenticated;
revoke all on table public.payment_provider_events from anon, authenticated;
