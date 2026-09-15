export type IntegrationKind =
  | "storage"
  | "messaging"
  | "push"
  | "email"
  | "identity"
  | "ai"
  | "payments";

export type IntegrationProvider =
  | "nextcloud"
  | "onedrive"
  | "meta_whatsapp"
  | "firebase"
  | "resend"
  | "openrouter"
  | "pawapay";

export type IntegrationHealth = {
  provider: IntegrationProvider;
  kind: IntegrationKind;
  configured: boolean;
  missing: string[];
  mode?: "local" | "cloud" | "hybrid";
};

export function envHealth(
  provider: IntegrationProvider,
  kind: IntegrationKind,
  required: string[],
  mode?: IntegrationHealth["mode"],
): IntegrationHealth {
  const missing = required.filter((key) => !process.env[key]?.trim());
  return { provider, kind, configured: missing.length === 0, missing, mode };
}
