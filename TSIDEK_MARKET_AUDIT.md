# TSIDEK Market Audit

Date: July 21, 2026

This document records the current reality of TSIDEK based on direct inspection of the codebase and a current market scan of legal practice software.

## Product Position Today

TSIDEK is no longer only a visual prototype. It is now a serious functional prototype with a real matter-first backend direction.

The strongest implemented idea is correct:

- Every serious action should belong to a matter.
- Intake should be controlled before a matter becomes active.
- Drafting should preserve firm form while injecting matter-specific context.
- Legal intelligence should be source-grounded rather than fake predictive scoring.

The project is still behind strong legal-tech products in operational completeness, deployment maturity, and commercial polish.

## Current Status Table

| Area | Status | What is Really There | Main Weakness |
|---|---|---|---|
| Authentication | Done/Partial | Supabase-backed auth structure, email OTP flow, protected routes, server-side permission checks | Production setup still needs final Supabase wiring and live rollout |
| Firm scope and permissions | Partial | Firm-scoped APIs, matter permission checks, role-aware server authorization | More RLS-first enforcement and less service-role dependence are still needed |
| Matter workspace | Partial/Strong | Matter route, tasks, comments, documents, custody, knowledge, compliance, team membership, digital case files, case fields | Not all flows are fully polished end-to-end in production mode |
| Intake and matter opening | Strong prototype | Prospect capture, related parties, conflict review, engagement approval, gated matter opening | Conflict logic is still basic and not yet enterprise-grade |
| Document personalization | Strong prototype | Template storage, preserved-form note, personalized draft generation, archive into matter record | No full production document upload/version workflow yet |
| Digital case file store | Partial | Registration of digital case files, storage metadata, matter linkage | File upload, signed delivery, versioning, and OneDrive synchronization are incomplete |
| Physical file linkage | Partial | Physical file registry, custody events, QR-ready structure | Not yet a full scanning/QR operational loop with device-tested flow |
| Compliance operations | Partial | Checklist items, status updates, compliance-oriented matter actions | Compliance logic is generic and not yet jurisdiction-rich |
| Jurisprudence and registers | Partial | Jurisprudence entries, council/register entries, matter-linked legal records | No mature legal search, source verification, or public/private ingestion workflow yet |
| Client communication | Partial | Matter-linked notifications, guidance profiles, client update dispatch structure | No mature client portal, delivery assurance, acknowledgement trail, or reliable external messaging pipeline |
| Memory and recall | Partial | Matter memory snapshots and guidance records exist | Still early, not yet a true institutional memory layer across closed matters |
| RAG / legal intelligence | Early | RAG source shelf direction exists, local inbox exists, legal intelligence panels exist | OCR, chunking, embeddings, retrieval, and citation-grounded output are not finished |
| Billing and finance | Weak | Some direction exists in the broader vision | Not yet competitive with market expectations |
| Deployment readiness | Weak/Partial | Render blueprint exists, README explains deployment path | Production build and deployment path are not yet proven cleanly enough |

## What Has Really Been Done

### 1. Matter-first operational core

TSIDEK has moved beyond disconnected feature panels. There is now a real matter route and a backend structure around the matter room.

Implemented direction includes:

- matter tasks
- matter comments
- matter documents
- physical file registry
- custody tracking
- compliance entries
- knowledge entries
- case fields
- digital case files
- document templates
- personalized matter drafts

### 2. Controlled intake workflow

The system now has a stronger legal intake path than many generic prototypes:

- prospect creation
- related-party capture
- conflict review step
- engagement approval step
- gated matter opening

This is one of the most strategically important improvements in the product because it shifts TSIDEK closer to a legal operating system rather than a generic dashboard.

### 3. Local prototype persistence

The product no longer needs Supabase to feel completely fake. Some matter-room actions can now persist through the local prototype layer instead of being presented as dead-end UI.

This is important for internal testing, demos, and rapid product shaping.

### 4. Personalized drafting path

TSIDEK already supports a very promising flow:

- store structured matter facts
- store a template profile
- preserve the expected document form
- generate a personalized matter-specific draft
- archive that draft into the case record

This is commercially meaningful and closer to genuine user value than decorative AI features.

## Biggest Weaknesses

### 1. Too much capability is still prototype-grade

The codebase contains meaningful backend structures, but many modules are still closer to an advanced prototype than a fully trusted production system. The difference matters in legal work.

Examples:

- document storage is not yet production-grade
- client communication is not yet durable enough
- billing is not yet real enough
- legal intelligence is not yet source-grounded enough
- deployment is not yet fully proven

### 2. Competitive gaps in finance and client-facing workflows

Most mature legal-tech competitors already treat the following as core:

- billing
- timekeeping
- invoicing
- payment handling
- client portals
- matter messaging
- audit trails around communications

TSIDEK still trails the market here.

### 3. The legal intelligence promise is ahead of the implementation

TSIDEK has the right philosophy for African legal AI, but the actual RAG and source-grounded research stack is still early. That means the product idea is stronger than the currently finished intelligence engine.

### 4. Conflict and permissions are not yet world-class

The current conflict step is good as a first gate, but not yet strong enough for a true legal operating backbone.

Missing depth includes:

- alias handling
- director and beneficial-owner relationships
- related corporate entities
- former client history
- deeper ethical wall logic

## Market Position

TSIDEK is not strongest as a general global law-firm operating system today. It is strongest as a potential Africa-first legal operations platform.

Its natural differentiation is:

- African legal workflow fit
- OHADA and jurisdiction-aware legal operations
- physical file plus digital file realities
- matter-first institutional memory
- preserved-form document personalization
- source-grounded legal intelligence for firms building their own private legal brain

That positioning is commercially stronger than trying to copy a mature US-first practice manager feature-for-feature.

## Competitor Pressure

### Clio

Clio is strong on:

- intake
- client journey
- billing
- document automation
- client portal
- embedded AI assistant workflows

TSIDEK is weaker than Clio today in operational completeness and commercial maturity.
TSIDEK is more interesting where African workflow fit and jurisdiction-specific reality matter more than generic global polish.

### Filevine

Filevine is strong on:

- case-centric work
- documents embedded into matters
- client portal
- team collaboration
- reporting
- custom case management structure

TSIDEK is philosophically aligned with Filevine's matter-centric approach, but still behind in polish, depth, and ecosystem maturity.

### Smokeball

Smokeball is strong on:

- automatic time capture
- billing
- legal document automation
- AI inside operational flow

TSIDEK is not yet close to Smokeball on monetizable operational depth.

### African competitors

Products such as LegalSphere, LawPavilion CaseManager, AV Guidance, LegalStacks, and similar regional systems increase the pressure on TSIDEK because they are already emphasizing:

- local compliance
- matters and workflows
- billing
- portals
- document control
- jurisdiction-aware practice support

TSIDEK cannot rely on "African focus" alone. It needs superior execution on a narrower but more powerful wedge.

## Honest Commercial Verdict

If evaluated today:

- Vision quality: strong
- Product direction: strong
- Prototype credibility: meaningful
- Production maturity: weak to moderate
- Competitive readiness: not yet enough to beat established practice management products head-on

TSIDEK is most credible if positioned as:

"A matter-first African legal operations and intelligence platform for firms that want stronger institutional memory, stronger intake governance, better document personalization, and a path toward private firm legal intelligence."

## What Must Be Built Next

Priority should not be "more screens." Priority should be stronger completion of the operational lane.

### Tier 1

- Finish Supabase-backed live persistence for the main matter room path
- Apply migrations cleanly and remove ambiguity between live, prototype, and seeded states
- Make document registration, digital case file storage, and template drafting a polished end-to-end lane
- Harden intake, conflict review, engagement approval, and matter opening

### Tier 2

- Build durable client communication and follow-up workflow
- Add stronger compliance and task accountability logic
- Add real matter timeline and deadline discipline
- Improve party relationships and ethical wall controls

### Tier 3

- Build source-grounded legal research and private knowledge retrieval
- Add OCR, scan ingestion, chunking, embeddings, and citation-aware retrieval
- Turn memory snapshots into firm-level institutional recall

### Tier 4

- Build billing, fee capture, and revenue visibility
- Build a serious client portal
- Expand OneDrive and external communication integrations

## Strategic Recommendation

TSIDEK should resist trying to become "everything at once." The better route is:

1. become excellent at intake-to-matter opening
2. become excellent at matter work and document personalization
3. become excellent at legal memory and source-grounded intelligence
4. then expand into full client-facing and financial operations

That path gives TSIDEK a better chance of becoming genuinely distinctive instead of becoming a weaker copy of broader legal practice managers.
