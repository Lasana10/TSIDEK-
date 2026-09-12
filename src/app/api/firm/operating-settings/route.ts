import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const [interaction, ai, parameters] = await Promise.all([
      supabase.from("firm_interaction_policies").select("*").eq("firm_id", scope.firmId).maybeSingle(),
      supabase.from("firm_ai_policies").select("firm_id,user_facing_mode,highly_confidential_mode,allow_personal_provider_keys,store_prompt_text,prompt_retention_days,configuration,updated_at").eq("firm_id", scope.firmId).maybeSingle(),
      supabase.from("firm_legal_parameters").select("id,parameter_type,parameter_key,label_en,label_fr,description,sort_order,active,configuration").eq("firm_id", scope.firmId).order("parameter_type").order("sort_order"),
    ]);
    if (interaction.error) throw new Error(interaction.error.message);
    if (ai.error) throw new Error(ai.error.message);
    if (parameters.error) throw new Error(parameters.error.message);
    return NextResponse.json({ success: true, interaction: interaction.data, ai: ai.data, parameters: parameters.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load operating settings." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const section = String(body.section ?? "interaction");

    if (section === "interaction") {
      const allowed = ["whatsapp_enabled","call_logging_enabled","call_recording_enabled","transcription_enabled","walk_in_enabled","email_ingestion_enabled","ai_extraction_enabled","automatic_matter_matching","default_ai_mode","recording_retention_days","transcript_retention_days","policy"];
      const update: Record<string, unknown> = { updated_by: scope.actorLawyerId, updated_at: new Date().toISOString() };
      for (const key of allowed) if (key in body) update[key] = body[key];
      const result = await supabase.from("firm_interaction_policies").upsert({ firm_id: scope.firmId, ...update }, { onConflict: "firm_id" }).select("*").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, interaction: result.data });
    }

    if (section === "ai") {
      const allowed = ["user_facing_mode","highly_confidential_mode","allow_personal_provider_keys","store_prompt_text","prompt_retention_days","configuration"];
      const update: Record<string, unknown> = { updated_by: scope.actorLawyerId, updated_at: new Date().toISOString() };
      for (const key of allowed) if (key in body) update[key] = body[key];
      const result = await supabase.from("firm_ai_policies").upsert({ firm_id: scope.firmId, ...update }, { onConflict: "firm_id" }).select("firm_id,user_facing_mode,highly_confidential_mode,allow_personal_provider_keys,store_prompt_text,prompt_retention_days,configuration,updated_at").single();
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ success: true, ai: result.data });
    }

    return NextResponse.json({ success: false, error: "Unknown settings section." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update operating settings." }, { status: 403 });
  }
}
