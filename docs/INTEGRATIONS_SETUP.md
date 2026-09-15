# TSIDKENU integration setup

This branch adds provider-neutral foundations for Nextcloud, OneDrive/Microsoft Graph, Meta WhatsApp, Firebase Cloud Messaging, and Resend.

## Nextcloud

Required server environment variables:

- `NEXTCLOUD_BASE_URL`
- `NEXTCLOUD_USERNAME`
- `NEXTCLOUD_APP_PASSWORD`

Use a dedicated service account/app password where possible. The connector uses WebDAV and keeps credentials server-side.

## Microsoft OneDrive / Graph

Required server environment variables:

- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

The current connector foundation supports application-token acquisition and Microsoft Graph requests. Tenant-specific delegated OAuth/consent should be added before multi-firm production rollout.

## Meta WhatsApp Cloud API

Required server environment variables:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- optional `WHATSAPP_GRAPH_VERSION`

Inbound webhook route already exists at `/api/integrations/whatsapp/webhook`. This branch adds an outbound server connector.

## Firebase Cloud Messaging

Required server environment variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

The connector uses OAuth service-account JWT exchange and FCM HTTP v1. Keep the private key server-side.

## Resend

Required server environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

The connector uses Resend's HTTP API for transactional email.

## Health endpoint

`GET /api/integrations/health`

Returns which integrations are configured and which environment variables are still missing. It does not return secret values.

## Security rules

- Never expose provider secrets through `NEXT_PUBLIC_*` variables.
- Never commit secrets to GitHub.
- Prefer separate credentials per environment and, for customer-owned integrations, per tenant/provider connection.
- Use firm-level policy to decide whether cloud or local/private providers are allowed for a matter.
