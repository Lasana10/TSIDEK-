import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const storageModes = new Set(["supabase", "onedrive", "nextcloud", "local"]);
const privacyModes = new Set(["local_only", "hybrid", "cloud_allowed"]);
const cloudProviders = new Set(["gemini", "openrouter", "none"]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase.from("firm_runtime_profiles")
      .select("firm_id,storage_mode,ai_privacy_mode,primary_cloud_provider,local_ai_base_url,nextcloud_base_url,external_storage_enabled,legal_research_public_corpus_enabled,configuration,updated_at")
      .eq("firm_id", scope.firmId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, runtime: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load firm runtime profile." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageTeam" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const patch: Record<string, unknown> = { updated_by: scope.actorLawyerId, updated_at: new Date().toISOString() };

    if (body.storageMode !== undefined) {
      const value = String(body.storageMode);
      if (!storageModes.has(value)) return NextResponse.json({ success: false, error: "Invalid storage mode." }, { status: 400 });
      patch.storage_mode = value;
    }
    if (body.aiPrivacyMode !== undefined) {
      const value = String(body.aiPrivacyMode);
      if (!privacyModes.has(value)) return NextResponse.json({ success: false, error: "Invalid AI privacy mode." }, { status: 400 });
      patch.ai_privacy_mode = value;
    }
    if (body.primaryCloudProvider !== undefined) {
      const value = String(body.primaryCloudProvider);
      if (!cloudProviders.has(value)) return NextResponse.json({ success: false, error: "Invalid cloud AI provider." }, { status: 400 });
      patch.primary_cloud_provider = value;
    }
    if (body.localAiBaseUrl !== undefined) patch.local_ai_base_url = body.localAiBaseUrl ? String(body.localAiBaseUrl) : null;
    if (body.nextcloudBaseUrl !== undefined) patch.nextcloud_base_url = body.nextcloudBaseUrl ? String(body.nextcloudBaseUrl) : null;
    if (body.externalStorageEnabled !== undefined) patch.external_storage_enabled = Boolean(body.externalStorageEnabled);
    if (body.publicLegalCorpusEnabled !== undefined) patch.legal_research_public_corpus_enabled = Boolean(body.publicLegalCorpusEnabled);
    if (body.configuration !== undefined) {
      if (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration)) {
        return NextResponse.json({ success: false, error: "Runtime configuration must be an object." }, { status: 400 });
      }
      patch.configuration = body.configuration;
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase.from("firm_runtime_profiles").update(patch).eq("firm_id", scope.firmId)
      .select("firm_id,storage_mode,ai_privacy_mode,primary_cloud_provider,local_ai_base_url,nextcloud_base_url,external_storage_enabled,legal_research_public_corpus_enabled,configuration,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, runtime: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update firm runtime profile." }, { status: 403 });
  }
}
