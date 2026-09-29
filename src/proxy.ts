import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseBrowserConfigReady } from "@/lib/supabase-config";

function isSupabaseAuthConfigured() { return isSupabaseBrowserConfigReady(); }

async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl(); const key = getSupabasePublishableKey();
  if (!url || !key) throw new Error("Supabase auth configuration is incomplete.");
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request: { headers: request.headers } }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}

export async function proxy(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const protectedRoots = ["/workspace","/search","/clients","/matters","/workroom","/activity-reports","/business","/communications","/rag-inbox","/intake","/interactions","/whatsapp","/document-bank","/storage","/digitisation","/law-bank","/finance","/forms","/people","/studio","/system"];
  const isProtectedPage = pathname === "/" || protectedRoots.some((root) => pathname.startsWith(root));
  const protectedApis = ["/api/workspace","/api/ai","/api/search","/api/cases","/api/clients","/api/matters","/api/workroom","/api/activity-reports","/api/business","/api/communications","/api/intake","/api/interactions","/api/whatsapp","/api/document-bank","/api/firm/storage","/api/law-bank","/api/legal-sources","/api/finance","/api/forms","/api/operations","/api/session"];
  const isProtectedApi = protectedApis.some((root) => pathname.startsWith(root));
  const isOnboardingApi = pathname.startsWith("/api/onboarding");
  const { response, user } = await updateSession(request);
  if (!user && (isProtectedApi || isOnboardingApi)) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!user && (isProtectedPage || isOnboardingRoute)) {
    const url = request.nextUrl.clone(); url.pathname = "/auth";
    if (pathname !== "/") url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/","/workspace/:path*","/search/:path*","/clients/:path*","/matters/:path*","/workroom/:path*","/activity-reports/:path*","/business/:path*","/communications/:path*","/rag-inbox/:path*","/intake/:path*","/interactions/:path*","/whatsapp/:path*","/document-bank/:path*","/storage/:path*","/digitisation/:path*","/law-bank/:path*","/finance/:path*","/forms/:path*","/people/:path*","/studio/:path*","/system/:path*","/auth/:path*","/onboarding/:path*","/api/workspace/:path*","/api/ai/:path*","/api/search/:path*","/api/cases/:path*","/api/clients/:path*","/api/matters/:path*","/api/workroom/:path*","/api/activity-reports/:path*","/api/business/:path*","/api/communications/:path*","/api/intake/:path*","/api/interactions/:path*","/api/whatsapp/:path*","/api/document-bank/:path*","/api/firm/storage/:path*","/api/law-bank/:path*","/api/legal-sources/:path*","/api/finance/:path*","/api/forms/:path*","/api/operations/:path*","/api/onboarding/:path*","/api/session/:path*"] };
