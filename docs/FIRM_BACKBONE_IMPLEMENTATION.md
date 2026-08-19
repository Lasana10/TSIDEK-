# TSIDEK Firm Backbone — Implementation Slice 1

This slice makes TSIDEK's matter model governable without deleting or renaming
the existing prototype/display fields.

## Added

- canonical matter lifecycle independent of the legacy `status` display field
- atomic lifecycle transitions with optimistic concurrency protection
- immutable matter event ledger
- obligations/deadline-control foundation
- governed legal-document record foundation
- communications evidence-chain foundation
- approvals foundation
- API endpoint:
  - `GET /api/matters/:matterId/lifecycle`
  - `POST /api/matters/:matterId/lifecycle`

## Security assumptions

The current TSIDEK API uses a server-side Supabase service-role client.
Therefore direct browser access to the new tables is not granted. RLS is enabled
without permissive browser policies. Existing request-scope, matter-membership,
ethical-wall and role authorization gates remain authoritative at the API layer.

## Why lifecycle_state is additive

The existing product currently uses `matters.status` for UI/product semantics.
Replacing it directly would create unnecessary regression risk. The new
`lifecycle_state` is the canonical governed workflow state. Existing screens can
be migrated progressively.

## Next slices

1. Wire matter opening from intake into lifecycle events.
2. Replace free-form deadline mutations with `matter_obligations`.
3. Bind existing matter documents to `legal_document_records`.
4. Route outbound email/WhatsApp through review/approval/send evidence.
5. Introduce dedicated `manageLifecycle`, `approveCommunication`,
   `approveDocument`, and `manageEthicalWall` permissions.
6. Add event-driven command center notifications.
7. Add closure checklist and post-matter institutional-memory extraction.
8. Add source-grounded legal authority graph and human-approved AI work-product
   pipeline.
