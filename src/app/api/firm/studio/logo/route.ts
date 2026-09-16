import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { persistUploadedFile, readVaultFile } from "@/lib/file-vault";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxBytes = 5 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_brand_profiles")
      .select("logo_asset_path,logo_mime_type").eq("firm_id", scope.firmId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.logo_asset_path) return new NextResponse(null, { status: 404 });
    const bytes = await readVaultFile(result.data.logo_asset_path);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": result.data.logo_mime_type || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load logo." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "Choose a logo image." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ success: false, error: "Use a PNG, JPEG, WebP or GIF logo." }, { status: 415 });
    if (file.size < 1 || file.size > maxBytes) return NextResponse.json({ success: false, error: "Logo must be smaller than 5 MB." }, { status: 413 });

    const stored = await persistUploadedFile({
      file,
      relativeDirectory: `storage/firms/${scope.firmId}/branding`,
      fileName: `logo-${file.name}`,
    });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const result = await supabase.from("firm_brand_profiles").update({
      logo_asset_path: stored.relativePath,
      logo_mime_type: stored.mimeType,
      logo_url: null,
      updated_by: scope.actorLawyerId,
      updated_at: new Date().toISOString(),
    }).eq("firm_id", scope.firmId).select("updated_at").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, logo_display_url: `/api/firm/studio/logo?v=${encodeURIComponent(result.data.updated_at)}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to upload logo." }, { status: 403 });
  }
}
