import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadTenantCredentials } from "@/lib/tenant-credentials.server";
import { nextcloudPut } from "@/lib/integrations/nextcloud.server";

export type FirmStorageProvider = "secure_vault" | "nextcloud" | "onedrive" | "local_private";

export async function getFirmStorageProfile(firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const result = await supabase.from("firm_storage_profiles")
    .select("firm_id,provider,configuration,status,last_verified_at,last_error")
    .eq("firm_id", firmId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? { firm_id: firmId, provider: "secure_vault", configuration: {}, status: "configured", last_verified_at: null, last_error: null };
}

export async function persistFirmExternalMirror(input: {
  firmId: string;
  relativePath: string;
  data: Buffer;
  contentType: string;
}) {
  const profile = await getFirmStorageProfile(input.firmId);
  if (profile.provider === "secure_vault") return { provider: "secure_vault" as const, mirrored: false };
  if (profile.provider === "nextcloud") {
    const credentials = await loadTenantCredentials(input.firmId, "nextcloud");
    const uploadBody = input.data.buffer.slice(input.data.byteOffset, input.data.byteOffset + input.data.byteLength) as ArrayBuffer;
    const result = await nextcloudPut(
      `/TSIDKENU/${input.relativePath.replace(/^\/+/, "")}`,
      uploadBody,
      input.contentType,
      credentials ? { baseUrl: credentials.baseUrl, username: credentials.username, appPassword: credentials.appPassword } : undefined,
    );
    return { provider: "nextcloud" as const, mirrored: true, path: result.path, status: result.status };
  }
  if (profile.provider === "onedrive") throw new Error("Microsoft OneDrive is not connected for this firm yet.");
  if (profile.provider === "local_private") throw new Error("Local-private storage requires a connected TSIDKENU local storage agent or mounted private node.");
  throw new Error("Unsupported firm storage provider.");
}
