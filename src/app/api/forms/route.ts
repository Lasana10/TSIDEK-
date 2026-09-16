import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const { data, error } = await supabase
      .from("firm_form_definitions")
      .select("id,form_key,name,description,module,version,status,schema,access_roles,updated_at")
      .eq("firm_id", scope.firmId)
      .order("module")
      .order("name");
    if (error) throw new Error(error.message);
    const role = String(scope.actorRole ?? "").toLowerCase();
    const forms = (data ?? []).filter((form) => {
      const roles = Array.isArray(form.access_roles) ? form.access_roles.map((item: string) => item.toLowerCase()) : [];
      return !roles.length || !role || roles.includes(role);
    });
    return NextResponse.json({ success: true, forms });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load controlled forms." }, { status: 403 });
  }
}
