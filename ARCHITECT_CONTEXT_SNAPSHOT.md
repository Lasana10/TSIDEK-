# TSIDEK Context Snapshot

## Product Direction

TSIDEK should be built as a matter-first legal operating system, not as a collection of independent legal-tech panels.

The center of gravity is:
- matter
- matter membership
- tasks
- comments
- documents
- physical file registry
- custody events
- notifications
- client guidance
- memory snapshots
- audit trail

Everything else should orbit this core.

## What Is Real Now

- App shell and dynamic tab loading are implemented.
- Matter routes exist at `/matters/[matterId]`.
- Matter room backend now supports:
  - loading live matter room data
  - matter comments
  - matter tasks
  - task status updates
  - matter member assignment and removal
  - physical file registry upsert
  - physical custody event recording
  - matter document registration
  - audit log writes for core room events
- Operations API supports:
  - notifications
  - chat messages
  - guidance profile refresh
  - memory snapshot creation

## Important Reality Check

The system is still not world-class yet.

The biggest remaining weaknesses are:
- auth and permission enforcement are not yet hard enough
- seeded fallback still exists in important flows
- OneDrive is not yet a fully integrated matter document workflow
- QR is not yet a full scan-to-open operational loop
- automations are modeled but not yet a real execution engine
- several older modules remain presentation-first

## Current Architectural Truth

Supabase is the primary backbone.
OneDrive should be a document adapter layered on top of matter records, not the core database.

Current key files:
- `src/lib/matter-room.ts`
- `src/app/api/matters/[matterId]/route.ts`
- `src/components/MatterWorkspace.tsx`
- `src/lib/operations.ts`
- `src/app/api/operations/route.ts`
- `supabase_schema.sql`

## Highest-Priority Next Steps

1. Replace more seeded fallback in flagship matter flows.
2. Harden auth and authorization around matter routes.
3. Build real matter creation / onboarding flow.
4. Make OneDrive-backed document linkage operational.
5. Add approval-chain persistence.
6. Add QR payload generation and scan routing.

## Build Philosophy

- Prefer fewer things that are truly real over many impressive but thin surfaces.
- Avoid dashboard theater.
- Matter execution quality is more important than feature count.
- Human-led accountability must remain visible in every AI-assisted flow.
