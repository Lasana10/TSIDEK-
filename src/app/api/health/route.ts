import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseUrl, getSupabasePublishableKey, getSupabaseServiceKey } from "@/lib/supabase-config";
import { getTranscriptionStatus } from "@/lib/transcription.server";
import { defaultVaultBucket, getVaultStorageProvider } from "@/lib/file-vault";

export const dynamic = "force-dynamic";

export async function GET() {
  const transcription = getTranscriptionStatus();
  const storageProvider = getVaultStorageProvider();
  const configured = {
    supabaseUrl: Boolean(getSupabaseUrl()),
    publishableKey: Boolean(getSupabasePublishableKey()),
    serviceKey: Boolean(getSupabaseServiceKey()),
    durableStorage: storageProvider === "supabase",
    storageProvider,
    storageBucket: defaultVaultBucket,
    transcription: transcription.configured,
    transcriptionLabel: transcription.providerLabel,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    localAi: Boolean(process.env.TSIDEK_LOCAL_AI_BASE_URL),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD),
    whatsappOutbound: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    whatsappInbound: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    pawapay: Boolean(process.env.PAWAPAY_API_KEY),
    onedrive: Boolean(process.env.ONEDRIVE_TENANT_ID && process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET),
  };

  let database = "unavailable";
  let vault = storageProvider === "local" ? "development-local" : "unavailable";
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("firms").select("id", { head: true, count: "exact" }).limit(1);
    database = error ? "error" : "ready";
    if (storageProvider === "supabase") {
      const bucket = await supabase.storage.getBucket(defaultVaultBucket);
      vault = bucket.error ? "error" : bucket.data.public ? "unsafe-public" : "ready-private";
    }
  }

  const coreReady = configured.supabaseUrl && configured.publishableKey && configured.serviceKey && database === "ready";
  const storageReady = storageProvider === "local" ? process.env.NODE_ENV !== "production" : vault === "ready-private";
  return NextResponse.json({
    status: coreReady && storageReady ? "ready" : "degraded",
    coreReady,
    storageReady,
    database,
    vault,
    configured,
    timestamp: new Date().toISOString(),
  }, { status: 200 });
}
