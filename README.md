# TSIDEK OS

TSIDEK OS is a matter-first legal operating system for African law practice. This build currently includes:

- Supabase-backed authentication with email OTP
- firm-scoped matter APIs
- controlled intake workflow with related-party capture, conflict review, engagement approval, and gated matter opening
- role and permission enforcement at the API layer
- matter workspace operations for tasks, comments, documents, custody, knowledge, compliance, and client updates
- matter finance controls for invoices, payment requests, client funds, and disbursements
- local prototype persistence when Supabase is not configured

## Core stack

- Next.js 16 App Router
- TypeScript
- Supabase Auth + Postgres
- Supabase SSR for session handling
- Render blueprint for first production deployment

## Local development

1. Install dependencies:

```bash
npm ci
```

2. Copy environment values from `.env.example`.

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Required environment variables

See [.env.example](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\.env.example).

Minimum production auth/database values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`

Optional integrations:

- SMTP values for email client updates
- WhatsApp Cloud API values
- Gemini API key
- PawaPay values for real mobile-money prompts
- OneDrive credentials plus `ONEDRIVE_RAG_FOLDER_PATH` for the shared office RAG source library

## Supabase setup

1. Create a new Supabase project.
2. Apply [supabase_schema.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_schema.sql).
3. Apply [supabase_intake_workflow.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_intake_workflow.sql).
4. Apply [supabase_intake_governance.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_intake_governance.sql) on existing projects.
5. Apply [supabase_client_updates.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_client_updates.sql).
6. Apply [supabase_document_control.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_document_control.sql).
7. Apply [supabase_document_security.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_document_security.sql).
8. Apply [supabase_matter_security.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_matter_security.sql).
9. Apply [supabase_finance_controls.sql](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\supabase_finance_controls.sql).
10. Enable email auth / OTP in Supabase Auth.
11. Set your site URL and redirect URL:

```text
https://your-render-domain.onrender.com
https://your-render-domain.onrender.com/auth/callback
```

12. Copy the project URL, anon key, and service role key into Render env vars.

If any secret key was pasted into chat or shared outside your private secret store, rotate it before using it in production. Treat exposed service or secret keys as compromised.

## Render deployment

The repo includes [render.yaml](C:\Users\MEDION\Documents\Codex\2026-05-13\what-do-you-think-of-this\tsidkenu-work\render.yaml) for a first production deployment.

Suggested flow:

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Set the environment variables from `.env.example`.
4. Deploy.

The first safe health path is `/auth`, since the main app routes are protected when auth is configured.

## Current auth model

- When Supabase auth is configured, `/`, `/matters/*`, `/api/matters/*`, `/api/operations/*`, and `/api/session` require authentication.
- Users sign in with email OTP at `/auth`.
- On first sign-in, the app creates a `lawyers` profile automatically if one does not exist yet.
- Permission enforcement is server-side and tied to matter membership and role capability checks.

## What is still next

- firm invite flow
- role onboarding flow
- stricter RLS-first data access with less service-role reliance
- production file upload/storage flow
