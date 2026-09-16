import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadTenantCredentials, type TenantCredentialBundle } from "@/lib/tenant-credentials.server";
import { verifyNextcloud } from "@/lib/integrations/nextcloud.server";
import { verifyFirebaseCredentials } from "@/lib/integrations/firebase.server";
import { verifyWhatsAppCredentials } from "@/lib/integrations/meta-whatsapp.server";
import { verifyOpenRouter } from "@/lib/integrations/openrouter.server";
import { verifyPawaPay } from "@/lib/integrations/pawapay.server";
import { verifyOneDrive } from "@/lib/integrations/onedrive.server";

export type TenantProvider = "nextcloud" | "onedrive" | "firebase" | "meta_whatsapp" | "openrouter" | "pawapay";

export async function getFirmIntegrationConnection(firmId: string, provider: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const result = await supabase.from("firm_integration_connections")
    .select("id,provider,status,credential_mode,credential_ref,configuration,last_verified_at,last_error")
    .eq("firm_id", firmId).eq("provider", provider).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function resolveFirmProviderCredentials(firmId: string, provider: string): Promise<TenantCredentialBundle | null> {
  const connection = await getFirmIntegrationConnection(firmId, provider);
  if (connection?.credential_mode === "firm_secret_ref") return loadTenantCredentials(firmId, provider);
  return null;
}

export async function verifyFirmProvider(firmId: string, provider: TenantProvider) {
  const credentials = await resolveFirmProviderCredentials(firmId, provider);
  switch (provider) {
    case "nextcloud":
      return verifyNextcloud(credentials ? { baseUrl: credentials.baseUrl, username: credentials.username, appPassword: credentials.appPassword } : undefined);
    case "onedrive":
      return verifyOneDrive(credentials ? {
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        driveId: credentials.driveId,
        userId: credentials.userId,
        userPrincipalName: credentials.userPrincipalName,
      } : undefined);
    case "firebase":
      return verifyFirebaseCredentials(credentials ? { projectId: credentials.projectId, clientEmail: credentials.clientEmail, privateKey: credentials.privateKey } : undefined);
    case "meta_whatsapp":
      return verifyWhatsAppCredentials(credentials ? { accessToken: credentials.accessToken, phoneNumberId: credentials.phoneNumberId, verifyToken: credentials.verifyToken, appSecret: credentials.appSecret, graphVersion: credentials.graphVersion } : undefined);
    case "openrouter":
      return verifyOpenRouter(credentials ? { apiKey: credentials.apiKey } : undefined);
    case "pawapay":
      return verifyPawaPay(credentials ? { apiToken: credentials.apiToken, apiKey: credentials.apiKey, environment: credentials.environment, apiUrl: credentials.apiUrl } : undefined);
  }
}
