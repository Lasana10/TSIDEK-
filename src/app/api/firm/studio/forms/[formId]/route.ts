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


export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const { formId } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "new_version");
    if (!["new_version","duplicate"].includes(action)) {
      return NextResponse.json({ success:false, error:"Unsupported form copy action." }, { status:400 });
    }
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const current = await supabase.from("firm_form_definitions").select("*").eq("id",formId).eq("firm_id",scope.firmId).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) return NextResponse.json({ success:false,error:"Form not found." },{status:404});
    const source = current.data;
    let formKey = source.form_key;
    let version = Number(source.version ?? 1) + 1;
    let name = source.name;
    if (action === "duplicate") {
      formKey = `${source.form_key}_copy_${Date.now().toString(36)}`;
      version = 1;
      name = `${source.name} — Copy`;
    } else {
      const latest = await supabase.from("firm_form_definitions").select("version").eq("firm_id",scope.firmId).eq("form_key",source.form_key).order("version",{ascending:false}).limit(1).maybeSingle();
      if (latest.error) throw new Error(latest.error.message);
      version = Number(latest.data?.version ?? source.version ?? 0) + 1;
    }
    const created = await supabase.from("firm_form_definitions").insert({
      firm_id:scope.firmId,
      form_key:formKey,
      name,
      description:source.description,
      module:source.module,
      version,
      status:"draft",
      schema:source.schema,
      ui_schema:{...(source.ui_schema||{}),copied_from_form_id:source.id},
      workflow:{...(source.workflow||{}),version_parent_id:source.id,requires_human_review:true},
      access_roles:source.access_roles||[],
      created_by:scope.actorLawyerId,
      updated_by:scope.actorLawyerId
    }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    return NextResponse.json({ success:true, form:created.data }, { status:201 });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error?error.message:"Unable to create editable form copy." }, { status:403 });
  }
}
