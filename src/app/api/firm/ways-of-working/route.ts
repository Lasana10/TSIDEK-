import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildOperatingRecommendations, type FirmOperatingProfile } from "@/lib/firm-operating-intelligence";

function normalizeProfile(input: Record<string, unknown>): FirmOperatingProfile {
  const strings = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  return {
    practice_model: String(input.practice_model ?? "general_practice"),
    professional_count_band: String(input.professional_count_band ?? "1_4"),
    practice_areas: strings(input.practice_areas),
    office_count: Math.max(1, Number(input.office_count ?? 1)),
    approval_model: String(input.approval_model ?? "partner_review"),
    billing_models: strings(input.billing_models),
    client_types: strings(input.client_types),
    litigation_mix: String(input.litigation_mix ?? "mixed"),
    support_staff_model: String(input.support_staff_model ?? "mixed"),
    confidentiality_mode: String(input.confidentiality_mode ?? "standard"),
    profile_notes: input.profile_notes ? String(input.profile_notes) : null,
    configuration: input.configuration && typeof input.configuration === "object" ? input.configuration as Record<string, unknown> : {},
  };
}

async function loadState(firmId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const [profileResult, recommendationResult, ruleResult] = await Promise.all([
    supabase.from("firm_operating_profiles").select("*").eq("firm_id", firmId).maybeSingle(),
    supabase.from("firm_operating_recommendations").select("*").eq("firm_id", firmId).order("category").order("title"),
    supabase.from("firm_operating_rules").select("*").eq("firm_id", firmId).order("category").order("title"),
  ]);
  for (const result of [profileResult, recommendationResult, ruleResult]) if (result.error) throw new Error(result.error.message);
  return {
    profile: profileResult.data,
    recommendations: recommendationResult.data ?? [],
    rules: ruleResult.data ?? [],
  };
}

async function refreshRecommendations(firmId: string, actorLawyerId: string, profile: FirmOperatingProfile) {
  const supabase = createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase server configuration is required.");
  const generated = buildOperatingRecommendations(profile);
  for (const item of generated) {
    const existing = await supabase.from("firm_operating_recommendations")
      .select("id,status").eq("firm_id", firmId).eq("recommendation_key", item.recommendation_key).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.status && ["applied","modified","dismissed"].includes(existing.data.status)) continue;
    const upsert = await supabase.from("firm_operating_recommendations").upsert({
      firm_id: firmId,
      ...item,
      status: "suggested",
      last_suggested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "firm_id,recommendation_key" });
    if (upsert.error) throw new Error(upsert.error.message);
  }
  return actorLawyerId;
}

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const state = await loadState(scope.firmId);
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load ways of working." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const profile = normalizeProfile(body);
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_operating_profiles").upsert({
      firm_id: scope.firmId,
      ...profile,
      updated_by: scope.actorLawyerId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "firm_id" }).select("*").single();
    if (result.error) throw new Error(result.error.message);
    await refreshRecommendations(scope.firmId, scope.actorLawyerId, profile);
    return NextResponse.json({ success: true, ...(await loadState(scope.firmId)) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update firm profile." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const action = String(body.action ?? "");
    const recommendationId = String(body.recommendationId ?? "");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const recommendation = await supabase.from("firm_operating_recommendations").select("*")
      .eq("id", recommendationId).eq("firm_id", scope.firmId).maybeSingle();
    if (recommendation.error) throw new Error(recommendation.error.message);
    if (!recommendation.data) return NextResponse.json({ success: false, error: "Recommendation not found." }, { status: 404 });

    if (action === "dismiss") {
      const update = await supabase.from("firm_operating_recommendations").update({
        status: "dismissed", acted_at: new Date().toISOString(), acted_by: scope.actorLawyerId, updated_at: new Date().toISOString(),
      }).eq("id", recommendationId).eq("firm_id", scope.firmId);
      if (update.error) throw new Error(update.error.message);
    } else if (action === "apply" || action === "modify") {
      const configuration = action === "modify" && body.configuration && typeof body.configuration === "object"
        ? body.configuration
        : recommendation.data.suggested_configuration;
      const description = action === "modify" && body.description ? String(body.description) : recommendation.data.description;
      const rule = await supabase.from("firm_operating_rules").upsert({
        firm_id: scope.firmId,
        rule_key: recommendation.data.recommendation_key,
        category: recommendation.data.category,
        title: recommendation.data.title,
        description,
        configuration,
        source_recommendation_id: recommendation.data.id,
        status: "active",
        updated_by: scope.actorLawyerId,
        created_by: scope.actorLawyerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "firm_id,rule_key" });
      if (rule.error) throw new Error(rule.error.message);
      const update = await supabase.from("firm_operating_recommendations").update({
        status: action === "modify" ? "modified" : "applied",
        acted_at: new Date().toISOString(),
        acted_by: scope.actorLawyerId,
        updated_at: new Date().toISOString(),
      }).eq("id", recommendationId).eq("firm_id", scope.firmId);
      if (update.error) throw new Error(update.error.message);
    } else {
      return NextResponse.json({ success: false, error: "Unknown recommendation action." }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await loadState(scope.firmId)) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update recommendation." }, { status: 403 });
  }
}
