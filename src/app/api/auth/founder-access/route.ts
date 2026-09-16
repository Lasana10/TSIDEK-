import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
  });
}

function safeEqual(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    const founderEmail = process.env.TSIDKENU_FOUNDER_EMAIL?.trim().toLowerCase();
    const founderSecret = process.env.TSIDKENU_FOUNDER_ACCESS_SECRET?.trim();
    if (!founderEmail || !founderSecret) {
      return json({ success: false, error: "Founder direct access is not configured." }, 503);
    }

    const key = requestKey(request);
    const now = Date.now();
    const current = attempts.get(key);
    if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
      return json({ success: false, error: "Too many access attempts. Try again later." }, 429);
    }
    if (!current || current.resetAt <= now) attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });

    const body = (await request.json()) as { accessCode?: string };
    const accessCode = String(body.accessCode ?? "").trim();
    if (!accessCode || !safeEqual(accessCode, founderSecret)) {
      const state = attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
      attempts.set(key, { ...state, count: state.count + 1 });
      return json({ success: false, error: "Founder access code is invalid." }, 403);
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) return json({ success: false, error: "Supabase server access is unavailable." }, 503);

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: founderEmail,
    });
    if (error) throw error;

    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new Error("Supabase did not return a founder verification token.");

    attempts.delete(key);
    return json({ success: true, tokenHash });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Unable to establish founder access." }, 500);
  }
}
