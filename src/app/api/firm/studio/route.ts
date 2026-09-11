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

    const [{ data: brand, error: brandError }, { data: forms, error: formsError }] = await Promise.all([
      supabase.from("firm_brand_profiles").select("*").eq("firm_id", scope.firmId).maybeSingle(),
      supabase.from("firm_form_definitions").select("id,form_key,name,description,module,version,status,schema,ui_schema,workflow,access_roles,updated_at").eq("firm_id", scope.firmId).order("module").order("name"),
    ]);
    if (brandError) throw new Error(brandError.message);
    if (formsError) throw new Error(formsError.message);
    return NextResponse.json({ success: true, brand, forms: forms ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load studio." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const allowed = [
      "display_name","legal_name","short_name","motto","logo_url","logo_mark_url","favicon_url",
      "primary_color","secondary_color","accent_color","background_color","surface_color","text_color",
      "font_heading","font_body","document_header_html","document_footer_html","letterhead_asset_url",
      "email_signature_html","default_language","locale","timezone","date_format","currency","configuration"
    ];
    const patch: Record<string, unknown> = { updated_by: scope.actorLawyerId, updated_at: new Date().toISOString() };
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];

    const { data, error } = await supabase.from("firm_brand_profiles")
      .update(patch).eq("firm_id", scope.firmId).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, brand: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update studio." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const formKey = String(body.formKey ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!name || !formKey) return NextResponse.json({ success: false, error: "Form name and key are required." }, { status: 400 });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase.from("firm_form_definitions").insert({
      firm_id: scope.firmId,
      form_key: formKey,
      name,
      description: body.description ? String(body.description) : null,
      module: body.module ? String(body.module) : "general",
      status: body.status === "published" ? "published" : "draft",
      schema: body.schema && typeof body.schema === "object" ? body.schema : { fields: [] },
      ui_schema: body.uiSchema && typeof body.uiSchema === "object" ? body.uiSchema : {},
      workflow: body.workflow && typeof body.workflow === "object" ? body.workflow : {},
      access_roles: Array.isArray(body.accessRoles) ? body.accessRoles.map(String) : [],
      created_by: scope.actorLawyerId,
      updated_by: scope.actorLawyerId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, form: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create form." }, { status: 403 });
  }
}
