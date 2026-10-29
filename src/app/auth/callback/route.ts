import { NextResponse } from "next/server";
import { createServerAuthClient, getLawyerProfileByUserId } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/auth") && !next.includes("\\") ? next : "/workspace";

  if (!code) {
    return NextResponse.redirect(new URL("/auth?error=missing_code", url.origin));
  }

  const supabase = await createServerAuthClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?error=auth_not_configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const lawyer = await getLawyerProfileByUserId(user.id);
    if (!lawyer && redirectTo !== "/me") {
      return NextResponse.redirect(new URL("/onboarding", url.origin));
    }
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
