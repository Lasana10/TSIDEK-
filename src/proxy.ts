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

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
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
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth");
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isProtectedPage = pathname === "/" || pathname.startsWith("/matters") || pathname.startsWith("/rag-inbox") || pathname.startsWith("/intake");
  const isProtectedApi =
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
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/matters/:path*",
    "/rag-inbox",
    "/rag-inbox/:path*",
    "/auth/:path*",
    "/onboarding/:path*",
    "/api/matters/:path*",
    "/api/intake/:path*",
    "/api/operations/:path*",
    "/api/onboarding/:path*",
    "/api/session",
  ],
};
