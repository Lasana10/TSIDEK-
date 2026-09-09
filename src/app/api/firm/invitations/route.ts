import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerAuthClient } from "@/lib/supabase-auth";

const inviteRoles = new Set([
  "partner",
  "lawyer",
  "paralegal",
  "intern",
  "administrator",
  "finance",
  "clerk",
  "knowledge_manager",
]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId) throw new Error("Active firm is required.");

    const supabase = await createServerAuthClient();
    if (!supabase) throw new Error("Supabase Auth is unavailable.");
    const result = await supabase
      .from("firm_invitations")
      .select("id,email,role_key,status,expires_at,accepted_at,created_at")
      .eq("firm_id", scope.firmId)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, invitations: result.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to list invitations." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Active firm and authenticated actor are required.");

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const roleKey = String(body.roleKey ?? "lawyer").trim();
    const lifetimeHours = Math.min(Math.max(Number(body.lifetimeHours ?? 168), 1), 720);
    if (!email || !email.includes("@")) throw new Error("A valid email is required.");
    if (!inviteRoles.has(roleKey)) throw new Error("Unsupported firm role.");

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + lifetimeHours * 60 * 60 * 1000).toISOString();

    const supabase = await createServerAuthClient();
    if (!supabase) throw new Error("Supabase Auth is unavailable.");

    const existing = await supabase
      .from("firm_invitations")
      .select("id")
      .eq("firm_id", scope.firmId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const revoked = await supabase.from("firm_invitations").update({ status: "revoked" }).eq("id", existing.data.id);
      if (revoked.error) throw new Error(revoked.error.message);
    }

    const inserted = await supabase
      .from("firm_invitations")
      .insert({ firm_id: scope.firmId, email, role_key: roleKey, token_hash: tokenHash, status: "pending", expires_at: expiresAt, invited_by: scope.actorLawyerId })
      .select("id,email,role_key,status,expires_at,created_at")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      success: true,
      invitation: inserted.data,
      inviteUrl: `${origin}/join?token=${encodeURIComponent(rawToken)}`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create invitation." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "manageFirm" });
    if (!scope.firmId) throw new Error("Active firm is required.");

    const body = await request.json();
    const invitationId = String(body.invitationId ?? "").trim();
    if (!invitationId) throw new Error("invitationId is required.");

    const supabase = await createServerAuthClient();
    if (!supabase) throw new Error("Supabase Auth is unavailable.");
    const updated = await supabase
      .from("firm_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("firm_id", scope.firmId)
      .eq("status", "pending")
      .select("id,status")
      .maybeSingle();
    if (updated.error) throw new Error(updated.error.message);
    if (!updated.data) throw new Error("Pending invitation not found.");
    return NextResponse.json({ success: true, invitation: updated.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to revoke invitation." }, { status: 400 });
  }
}
