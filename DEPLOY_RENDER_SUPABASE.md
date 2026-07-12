## TSIDEK Deploy Runbook

### 1. GitHub source

This workspace is now initialized as a local Git repository.

Recommended next commands once you have the GitHub repository URL:

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git add .
git commit -m "Deploy-ready TSIDEK foundation"
git push -u origin main
```

### 2. Supabase auth settings

In Supabase Auth settings, configure:

- Site URL:
  - `https://<your-render-service>.onrender.com`
- Redirect URLs:
  - `http://127.0.0.1:3000/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `https://<your-render-service>.onrender.com/auth/callback`

Email OTP should be enabled for the project.

### 3. Render environment variables

Set these in Render before the first deploy:

```text
NODE_VERSION=22
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SECRET_KEY=<your-rotated-supabase-secret-key>
SUPABASE_JWKS_URL=<your-supabase-jwks-url>
```

Compatibility note:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is optional if `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is set.
- `SUPABASE_SERVICE_ROLE_KEY` is optional if `SUPABASE_SECRET_KEY` is set.

Optional integrations:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_VERSION=v20.0
GEMINI_API_KEY=
ONEDRIVE_TENANT_ID=
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
ONEDRIVE_DRIVE_ID=
```

### 4. Render service settings

The repo already contains [render.yaml](C:/Users/MEDION/Documents/Codex/2026-05-13/what-do-you-think-of-this/tsidkenu-work/render.yaml).

Expected service behavior:

- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/auth`

### 5. First live smoke test

After deploy:

1. Open `/auth`
2. Request an email OTP
3. Confirm redirect back to `/auth/callback`
4. Confirm first login creates a `lawyers` row
5. Confirm `/` loads
6. Confirm a matter can be created
7. Confirm a matter page opens

### 6. Important security note

If the previous Supabase secret key was ever pasted into chat or exposed outside a private secret manager, rotate it before production deploy.
