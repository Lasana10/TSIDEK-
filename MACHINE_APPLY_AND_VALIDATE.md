# Apply to existing TSIDEK

1. Apply World-Class Core v1 first.
2. Overlay this v2 package.
3. Apply migrations to staging/dev Supabase.
4. Run `npm ci`, `npm run lint`, `npm run build`, `git diff --check`.
5. Verify real table/column names for existing invoice/payment records before wiring automatic finance mirroring.
6. Smoke-test authenticated flows:
   - legal authority add
   - finance ledger post
   - AI work-product register
   - approved communication dispatch
   - closure review
   - client portal grant/revoke
7. Do not expose service-role keys or provider secrets.
8. Do not merge until build and smoke tests pass.
