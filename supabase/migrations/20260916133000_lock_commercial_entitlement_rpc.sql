-- Entitlements are enforced by authenticated server routes. Keep the helper unavailable
-- through the public REST/RPC surface so firms cannot probe arbitrary tenant IDs.
revoke execute on function public.firm_has_module(uuid,text) from authenticated;
