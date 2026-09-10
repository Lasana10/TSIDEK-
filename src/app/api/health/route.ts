import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseUrl, getSupabasePublishableKey, getSupabaseServiceKey } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = {
    supabaseUrl: Boolean(getSupabaseUrl()),
    publishableKey: Boolean(getSupabasePublishableKey()),
    serviceKey: Boolean(getSupabaseServiceKey()),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    localAi: Boolean(process.env.TSIDEK_LOCAL_AI_BASE_URL),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    pawapay: Boolean(process.env.PAWAPAY_API_KEY),
    onedrive: Boolean(process.env.ONEDRIVE_TENANT_ID && process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET),
  };

  let database = "unavailable";
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("firms").select("id", { head: true, count: "exact" }).limit(1);
    database = error ? "error" : "ready";
  }

  const coreReady = configured.supabaseUrl && configured.publishableKey && configured.serviceKey && database === "ready";
  return NextResponse.json({
    status: coreReady ? "ready" : "degraded",
    coreReady,
    database,
    configured,
    timestamp: new Date().toISOString(),
  }, { status: 200 });
}
