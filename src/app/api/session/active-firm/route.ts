import { NextResponse } from "next/server";
import { getAuthenticatedUser, setActiveFirmForUser } from "@/lib/supabase-auth";

const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers: HEADERS });
    }

    const body = await request.json();
    const firmId = String(body.firmId ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firmId)) {
      return NextResponse.json({ success: false, error: "A valid firm identifier is required." }, { status: 400, headers: HEADERS });
    }

    await setActiveFirmForUser(identity.user.id, firmId);
    return NextResponse.json({ success: true, activeFirmId: firmId }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to switch firm." },
      { status: 400, headers: HEADERS }
    );
  }
}
