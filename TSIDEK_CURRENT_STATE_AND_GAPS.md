# TSIDEK Current State And Gaps

Updated: July 28, 2026

This document separates what is already working, what is partially implemented,
and what still needs to be built before TSIDEK can be presented as a true
production-grade legal operating system.

## 1. What is real today

These parts are implemented in the current codebase and build successfully:

- Supabase-backed authentication and onboarding flow
- Matter creation and matter route pages
- Intake workflow route and API
- Matter room shell with document, governance, intelligence, and collaboration surfaces
- File-vault upload routes for matter documents and RAG staging
- RAG inbox route and ingestion staging workflow
- Controlled client-update records and delivery plumbing
- Render deployment configuration
- Production build that passes locally with `next build --webpack`
- Production guardrails that prevent seeded/prototype data from replacing live
  Supabase data in the main matter and operations paths

## 2. What is only partial

These areas exist, but are not yet strong enough to describe as fully live:

- Matter room persistence still includes seeded and fallback branches for local
  demo mode, but production now fails closed instead of presenting seeded room data
- Operational dashboard areas still contain seeded notifications, chat, guidance,
  automations, and memory snapshots for local demo mode, but production now shows
  live records or empty states
- Several components are visually present but still behave like prototype helpers
  rather than audited legal workflows
- SMTP is wired and hardened for STARTTLS, but not live-verified end-to-end
- OneDrive integration shape exists, but depends on Microsoft Graph credentials
  that have not yet been fully confirmed in a live office setup

## 3. What is still missing for world-class level

These are the major remaining gaps:

- Finish replacing demo-only fallback branches with explicit empty states and
  setup guidance across all user-facing screens
- Expand live Supabase-backed operational records until dashboard modules no
  longer need seeded local data even in demo mode
- Complete ethical walls and matter-level restricted access controls
- Build real client portal boundaries separate from staff workspaces
- Build reliable billing, payment confirmation, and financial ledger flows
- Add durable audit trails for sensitive document access, export, and approvals
- Move legal intelligence from staged knowledge entry toward source-grounded retrieval
- Add proper document versioning, approval chain, and filing-status discipline
- Add production observability, runtime alerts, and backup/recovery playbooks
- Finish deployment transfer to the exact GitHub repository Render is watching

## 4. Highest-priority build order

If we want the strongest path from prototype to serious product, this should be
the immediate implementation order:

1. Replace demo-only seeded dashboard modules with live records and empty states
2. Harden permissions, matter assignment, and restricted-access rules
3. Complete client-update delivery verification with real SMTP and WhatsApp config
4. Finish document-control lifecycle: draft, review, approval, filed, retention
5. Wire billing and payment records to server-side truth
6. Complete client portal visibility rules
7. Add source-grounded legal intelligence and citation-backed retrieval

## 5. Honest product status

TSIDEK is not yet a world-class legal operating system.

It is now a meaningful working prototype with a real backend spine, deployable
build, live-intent matter workflows, and a stronger production posture than a
mock dashboard. The biggest risk is not lack of vision; it is the remaining gap
between the live workflow story and the fallback or seeded logic still present in
parts of the codebase.

That means the next milestone is not "more surface area." The next milestone is
"make the current legal workflow fully trustworthy end to end."
