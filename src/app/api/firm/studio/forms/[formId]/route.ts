import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ formId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const { formId } = await context.params;
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase.from("firm_form_definitions").select("*").eq("id", formId).eq("firm_id", scope.firmId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ success: false, error: "Form not found." }, { status: 404 });
    return NextResponse.json({ success: true, form: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load form." }, { status: 403 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const { formId } = await context.params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updated_by: scope.actorLawyerId, updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
    if (body.module !== undefined) patch.module = String(body.module);
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["draft", "published", "archived"].includes(status)) return NextResponse.json({ success: false, error: "Invalid form status." }, { status: 400 });
      patch.status = status;
    }
    if (body.schema !== undefined) {
      if (!body.schema || typeof body.schema !== "object" || Array.isArray(body.schema)) return NextResponse.json({ success: false, error: "Form schema must be an object." }, { status: 400 });
      patch.schema = body.schema;
    }
    if (body.uiSchema !== undefined) patch.ui_schema = body.uiSchema && typeof body.uiSchema === "object" && !Array.isArray(body.uiSchema) ? body.uiSchema : {};
    if (body.workflow !== undefined) patch.workflow = body.workflow && typeof body.workflow === "object" && !Array.isArray(body.workflow) ? body.workflow : {};
    if (body.accessRoles !== undefined) patch.access_roles = Array.isArray(body.accessRoles) ? body.accessRoles.map(String) : [];

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase.from("firm_form_definitions").update(patch).eq("id", formId).eq("firm_id", scope.firmId).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, form: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update form." }, { status: 403 });
  }
}
