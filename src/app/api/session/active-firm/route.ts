import { NextResponse } from "next/server";
import { getAuthenticatedUser, setActiveFirmForUser } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  try {
    const identity = await getAuthenticatedUser();
    if (!identity?.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const firmId = String(body.firmId ?? "").trim();
    if (!firmId) {
      return NextResponse.json({ success: false, error: "firmId is required." }, { status: 400 });
    }

    await setActiveFirmForUser(identity.user.id, firmId);
    return NextResponse.json({ success: true, activeFirmId: firmId });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to switch firm." },
      { status: 400 }
    );
  }
}
