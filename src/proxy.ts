import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseBrowserConfigReady } from "@/lib/supabase-config";

function isSupabaseAuthConfigured() {
  return isSupabaseBrowserConfigReady();
}

async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error("Supabase auth configuration is incomplete.");
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

export async function proxy(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isProtectedPage =
    pathname === "/" ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/matters") ||
    pathname.startsWith("/rag-inbox") ||
    pathname.startsWith("/intake") ||
    pathname.startsWith("/interactions") ||
    pathname.startsWith("/digitisation") ||
    pathname.startsWith("/law-bank") ||
    pathname.startsWith("/people") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/system");
  const isProtectedApi =
    pathname.startsWith("/api/workspace") ||
    pathname.startsWith("/api/matters") ||
    pathname.startsWith("/api/intake") ||
    pathname.startsWith("/api/operations") ||
    pathname.startsWith("/api/session");
  const isOnboardingApi = pathname.startsWith("/api/onboarding");

  const { response, user } = await updateSession(request);

  if (!user && (isProtectedApi || isOnboardingApi)) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  if (!user && (isProtectedPage || isOnboardingRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    if (pathname !== "/") url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Do not redirect an authenticated user away from /auth here. The auth page
  // resolves the complete session + membership + active-firm context first and
  // then replaces the route. This avoids a transient cookie refresh racing the
  // application context and leaving the login page mounted behind the workspace.
  return response;
}

export const config = {
  matcher: [
    "/",
    "/workspace/:path*",
    "/matters/:path*",
    "/rag-inbox/:path*",
    "/intake/:path*",
    "/interactions/:path*",
    "/digitisation/:path*",
    "/law-bank/:path*",
    "/people/:path*",
    "/studio/:path*",
    "/system/:path*",
    "/auth/:path*",
    "/onboarding/:path*",
    "/api/workspace/:path*",
    "/api/matters/:path*",
    "/api/intake/:path*",
    "/api/operations/:path*",
    "/api/onboarding/:path*",
    "/api/session/:path*",
  ],
};
