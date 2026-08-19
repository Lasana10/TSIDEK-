# Safe apply order

1. Create a branch from latest `main`.
2. Apply the Supabase migration in this bundle to a staging/dev TSIDEK database first.
3. Add new `src/lib`, API route and component files.
4. Apply the intake + matter-room integration patches.
5. Apply the matter-page composition patch.
6. Run:
   - `npm ci`
   - `npm run lint`
   - `npm run build`
   - `git diff --check`
7. Smoke test:
   - auth/onboarding
   - intake -> conflict -> engagement -> open matter
   - matter lifecycle GET/POST
   - command-center GET
   - controls GET/POST
   - existing matter-room document/task/finance actions
8. Only then migrate/deploy production.

Do not expose Supabase service-role, SMTP, Microsoft, WhatsApp, payment or AI secrets.
