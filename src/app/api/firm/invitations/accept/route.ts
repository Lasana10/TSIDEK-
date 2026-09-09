import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ success: false, error: "Invitation token is required." }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server client is unavailable.");

    const result = await supabase.rpc("accept_firm_invitation_service", {
      invitation_token_hash: tokenHash,
      accepting_user_id: identity.user.id,
    });
    if (result.error) throw new Error(result.error.message);

    const accepted = Array.isArray(result.data) ? result.data[0] : result.data;
    return NextResponse.json({ success: true, membership: accepted ?? null });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to accept invitation." },
      { status: 400 }
    );
  }
}
