# Legal Life Account: implementation and remaining acceptance

## Integrated implementation
- auth.users remains the permanent individual identity.
- Existing firm_memberships, user_firm_context, matter security and ethical walls are unchanged.
- /me functions independently of a lawyers row and firm membership.
- Personal self-declared profession is never official verification or professional authorization.
- Personal RLS tables contain owner-scoped notes, tasks and research; no matter_id, firm_id, client_id or access to privileged firm records.
- /api/personal-workspace GET, POST, PATCH and DELETE use a cookie-authenticated Supabase client, not the service-role client.
- The personal interface supports identity, firm memberships, and owner-scoped work.

## Still required
- Apply SQL migration only to the correct TSIDEK project and inspect policies.
- Run authenticated browser tests with two independent accounts, including direct forbidden read/write tests.
- Verify all firm access behavior and session switching remain unchanged.
- Verify production deploy, backups, storage retention and data rights.
- Profession verification, Academy, cross-professional cooperation and client portals remain separate unfinished journeys.

No live credentials, real matters or professional authority were fabricated.
