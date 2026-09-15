import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type TenantCredentialBundle = Record<string, string>;

function masterKey() {
  const raw = process.env.TSIDEK_CREDENTIALS_MASTER_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TSIDEK_CREDENTIALS_MASTER_KEY must be a 32-byte base64 key.");
  return key;
}

function encrypt(payload: TenantCredentialBundle) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

function decrypt(row: { ciphertext: string; iv: string; auth_tag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Stored tenant credentials are invalid.");
  return parsed as TenantCredentialBundle;
}

export async function saveTenantCredentials(input: {
  firmId: string;
  provider: string;
  credentials: TenantCredentialBundle;
  actorLawyerId: string;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const clean = Object.fromEntries(Object.entries(input.credentials).filter(([, value]) => typeof value === "string" && value.trim()));
  if (!Object.keys(clean).length) throw new Error("At least one provider credential is required.");
  const sealed = encrypt(clean);
  const now = new Date().toISOString();
  const result = await supabase.from("firm_integration_secrets").upsert({
    firm_id: input.firmId,
    provider: input.provider,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    auth_tag: sealed.authTag,
    updated_by: input.actorLawyerId,
    created_by: input.actorLawyerId,
    updated_at: now,
  }, { onConflict: "firm_id,provider" }).select("id,provider,updated_at").single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function loadTenantCredentials(firmId: string, provider: string): Promise<TenantCredentialBundle | null> {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const result = await supabase.from("firm_integration_secrets")
    .select("ciphertext,iv,auth_tag")
    .eq("firm_id", firmId)
    .eq("provider", provider)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ? decrypt(result.data) : null;
}

export async function deleteTenantCredentials(firmId: string, provider: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const result = await supabase.from("firm_integration_secrets").delete().eq("firm_id", firmId).eq("provider", provider);
  if (result.error) throw new Error(result.error.message);
}
