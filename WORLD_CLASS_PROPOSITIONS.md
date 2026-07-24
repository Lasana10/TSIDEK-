# TSIDEK World-Class Product Propositions

This document records the next-level considerations that should guide TSIDEK beyond a visual prototype.

## 1. Trust Foundation Before Feature Expansion

TSIDEK should treat identity, permissions, audit trails, and encrypted document access as the product foundation. Legal users will not trust advanced AI, automations, or client portals unless the system first proves that every action is tied to a real user, firm, matter, and permission.

Essential implementation direction:
- Supabase Auth with email OTP for the first release.
- Strict server-side authorization on every matter, document, communication, and automation route.
- No production demo fallback, no trusted client headers, no first-user impersonation.
- Audit logs for sensitive reads, writes, exports, AI usage, and external dispatch.

## 2. Matter Room as the Operating Core

The matter room should remain the central cockpit. QR codes, document vaults, jurisprudence, compliance, chat, templates, billing, and automations should all orbit around a matter, not appear as disconnected modules.

Essential implementation direction:
- Every file, message, deadline, register entry, template, and AI summary belongs to a matter.
- Cross-matter views should aggregate matter-level data, not duplicate workflows.
- The homepage should launch active work quickly: create matter, search matter, continue urgent matter, review alerts.

## 3. Real Document Vault and Scanning Pipeline

TSIDEK becomes materially valuable when legal files can be uploaded, signed, scanned, versioned, searched, and safely shared.

Essential implementation direction:
- Supabase Storage or Cloudflare R2 for first document storage.
- Signed URLs and role checks for every download.
- OneDrive as the shared office source shelf for prepared RAG documents across machines.
- Supabase as the system of record for users, matters, metadata, permissions, and future vector indexes.
- OCR pipeline for scanned books, hard-copy cases, registers, and court documents.
- Version history and chain-of-custody records for evidence and drafts.

## 4. Source-Grounded Legal Intelligence

TSIDEK should not sell fake case outcome prediction in OHADA/Cameroon contexts where structured datasets are thin. The stronger feature is evidence-grounded retrieval, drafting, and risk review.

Essential implementation direction:
- Similar-matter retrieval from the firm's private database.
- Jurisprudence and law search with citations and source links.
- Deadline and limitation risk scoring where rules are deterministic.
- AI drafting that preserves firm document form while inserting matter context.
- Human approval gates before client-facing or court-facing output.
- A local RAG source inbox for prepared legal documents before OCR, chunking, embeddings, and retrieval are enabled.

## 5. Communications and Client Transparency

Email and WhatsApp should become durable communication workflows, not one-off send attempts.

Essential implementation direction:
- Outbound message queue with retry state.
- Matter-linked communication history.
- Client update templates with lawyer approval.
- Notification preferences per client and matter.
- Delivery status, failure reason, and follow-up reminders.

## 6. Automations With Memory

Automations should not only remind users. They should remember context, connect tasks to matter state, and create accountable follow-up.

Essential implementation direction:
- Scheduled matter reviews.
- Deadline escalation ladders.
- Client update reminders.
- Compliance checklist follow-up.
- Matter context snapshots that can be recalled by AI and humans.

## 7. Cooperation and Human Empowerment

The product should strengthen legal teams rather than replace them. It should make delegation, mentoring, and accountability visible.

Essential implementation direction:
- Role-based task ownership.
- Mentorship notes and review rituals.
- Junior workspaces with guided checklists.
- Quality questionnaires that adjust client communication tone and guidance.
- Internal knowledge capture from completed matters.

## Priority Order

1. Production auth and authorization hardening.
2. Real file upload, storage, signed access, and document metadata.
3. Matter-centered document templates and personalized drafting.
4. Durable notifications and client update dispatch.
5. Real conflict check against clients, parties, opposing counsel, and matter history.
6. Source-grounded legal research and private knowledge retrieval.
7. Automation worker for reminders, compliance, and memory snapshots.
