# TSIDEK World-Class Core — consolidated scope

This consolidated overlay combines the earlier Firm Backbone, event ledger,
frontend lifecycle and matter command-center slices and adds the operational
control API for obligations, approvals, authoritative legal documents and
communications.

It is designed to be additive to the current TSIDEK repository.

## Core invariants

- Matter remains the operating centre.
- Existing authentication and matter authorization remain authoritative.
- Existing `matters.status` remains available for legacy/display compatibility.
- Canonical lifecycle is separate and guarded.
- Sensitive legal content is not duplicated into event metadata.
- Server-side Supabase service-role access never replaces application authorization.
- Browser access to new governance tables is not opened by default.
- Consequential actions emit matter events.

## Included now

1. Matter lifecycle + atomic transition RPC.
2. Matter event ledger.
3. Obligations/deadlines foundation.
4. Authoritative legal document register.
5. Approval records.
6. Communication evidence chain.
7. Matter command-center aggregation.
8. Frontend lifecycle bar.
9. Frontend command center.
10. Operational controls API.
11. Operational control desk.
12. Integration guidance for current intake and matter-room APIs.

## Still requires live environment validation

- Apply migration to the intended Supabase project.
- Confirm exact existing `invoices` and `payments` schema in that environment.
- Run lint/build after applying patches to the latest checkout.
- Live-test SMTP/WhatsApp/Microsoft Graph/payment provider delivery separately.
- Add provider-specific webhook verification only after credentials/endpoints are confirmed.
