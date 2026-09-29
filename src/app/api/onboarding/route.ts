import { NextResponse } from "next/server";
import {
  completeUserOnboarding,
  getAuthenticatedUser,
} from "@/lib/supabase-auth";
import { firmRoleOptions, type FirmRole } from "@/lib/firm-identity";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildOperatingRecommendations, type FirmOperatingProfile } from "@/lib/firm-operating-intelligence";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function jsonNoStore(body: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: NO_STORE_HEADERS });
}

function isFirmRole(value: string): value is FirmRole {
  return (firmRoleOptions as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return jsonNoStore({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const firmName = String(body.firmName ?? "").trim();
    const country = String(body.country ?? "").trim();
    const roleValue = String(body.role ?? "").trim();

    if (!identity.lawyer && (!fullName || !firmName || !isFirmRole(roleValue))) {
      return jsonNoStore(
        { success: false, error: "Full name, firm name, and a valid role are required." },
        { status: 400 },
      );
    }

    const effectiveRole = isFirmRole(roleValue)
      ? roleValue
      : ((identity.lawyer?.role && isFirmRole(identity.lawyer.role)) ? identity.lawyer.role : "Junior Associate");

    await completeUserOnboarding({
      userId: identity.user.id,
      email: identity.user.email ?? null,
      fullName: fullName || identity.lawyer?.full_name || identity.user.email?.split("@")[0] || "Firm member",
      firmName: firmName || "Firm",
      country,
      role: effectiveRole,
    });

    // Do not re-run cookie/session authentication in the same activation request.
    // The user is already authenticated above; readiness is determined from the
    // persisted records that completeUserOnboarding just created or repaired.
    const refreshedIdentity = await getAuthenticatedUser();
    const lawyer = refreshedIdentity?.lawyer ?? null;
    const firmContext = {
      membership: refreshedIdentity?.membership ?? null,
      memberships: refreshedIdentity?.memberships ?? [],
      activeFirmId: refreshedIdentity?.activeFirmId ?? null,
    };

    const membership = firmContext.membership as {
      firm_id?: string | null;
      role_key?: string | null;
      title?: string | null;
      status?: string | null;
    } | null;
    const firmId = membership?.firm_id ?? lawyer?.firm_id ?? null;
    const actorRole = membership?.role_key ?? membership?.title ?? lawyer?.role ?? null;
    if (firmId && lawyer && body.operatingProfile && typeof body.operatingProfile === "object") {
      const supplied = body.operatingProfile as Record<string, unknown>;
      const profile: FirmOperatingProfile = {
        practice_model: String(supplied.practice_model ?? "general_practice"),
        professional_count_band: String(supplied.professional_count_band ?? "5_14"),
        practice_areas: Array.isArray(supplied.practice_areas) ? supplied.practice_areas.map(String) : [],
        office_count: Math.max(1, Number(supplied.office_count ?? 1)),
        approval_model: String(supplied.approval_model ?? "partner_review"),
        billing_models: Array.isArray(supplied.billing_models) ? supplied.billing_models.map(String) : [],
        client_types: Array.isArray(supplied.client_types) ? supplied.client_types.map(String) : [],
        litigation_mix: String(supplied.litigation_mix ?? "mixed"),
        support_staff_model: String(supplied.support_staff_model ?? "mixed"),
        confidentiality_mode: String(supplied.confidentiality_mode ?? "standard"),
        profile_notes: null,
        configuration: {},
      };
      const supabase = createServerSupabaseClient();
      if (supabase) {
        const saved = await supabase.from("firm_operating_profiles").upsert({
          firm_id: firmId,
          ...profile,
          updated_by: lawyer.id,
          created_by: lawyer.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "firm_id" });
        if (saved.error) throw new Error(saved.error.message);

        for (const recommendation of buildOperatingRecommendations(profile)) {
          const rec = await supabase.from("firm_operating_recommendations").upsert({
            firm_id: firmId,
            ...recommendation,
            status: "suggested",
            last_suggested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "firm_id,recommendation_key" });
          if (rec.error) throw new Error(rec.error.message);
        }
      }
    }

    const workspaceReady = Boolean(
      lawyer &&
      membership &&
      membership.status === "active" &&
      firmId &&
      firmContext.activeFirmId === firmId &&
      actorRole &&
      firmContext.memberships.length > 0,
    );

    return jsonNoStore({
      success: true,
      workspaceReady,
      alreadyOnboarded: Boolean(identity.lawyer),
      firmId,
      activeFirmId: firmContext.activeFirmId,
      actorRole,
    });
  } catch (error) {
    return jsonNoStore(
      { success: false, error: error instanceof Error ? error.message : "Unable to complete onboarding." },
      { status: 500 },
    );
  }
}
