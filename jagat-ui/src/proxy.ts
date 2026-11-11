import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/cookie-signer";

// ── Path Classification ─────────────────────────────────────────────────────
// PUBLIC_PATHS:          Accessible without any session
// SOVEREIGN_ONLY_PATHS:  Require a valid session with tier === "SOVEREIGN"
// Everything else:       Require a valid session (any tier)

const PUBLIC_PATHS = ["/login", "/pricing", "/about", "/contact-analyst", "/platform", "/meet-g7", "/resources", "/solutions", "/api/auth", "/api/commercial", "/_next", "/favicon.ico"];

const SOVEREIGN_ONLY_PATHS = ["/colony", "/api/colony", "/api/orchestra-stats", "/api/orchestra-activity", "/g7-admin", "/api/admin"];

// ── Proxy Interceptor ────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Public paths — no auth required (exact match for root / and startsWith for prefixes)
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Read and verify signed session cookie (HMAC-SHA256)
  const sessionToken = request.cookies.get("jagat_g7_session")?.value;

  if (!sessionToken) {
    // No session at all — redirect to login (UI) or 401 (API)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized", message: "Session required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify HMAC-SHA256 signature
  const session = await verifySession(sessionToken);

  if (!session) {
    // Cookie exists but HMAC-SHA256 signature is invalid — tampered or forged
    console.warn(`[Proxy] Invalid/tampered session cookie detected for path: ${pathname}`);

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Session cookie tidak valid atau telah dimanipulasi." },
        { status: 401 },
      );
    }
    // Clear the bad cookie and redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    loginUrl.searchParams.set("reason", "invalid_session");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("jagat_g7_session");
    return response;
  }

  // 3. Sovereign-only paths — require tier === "SOVEREIGN"
  if (SOVEREIGN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (session.tier !== "SOVEREIGN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden", message: "Clearance SOVEREIGN diperlukan untuk Colony/Admin." },
          { status: 403 },
        );
      }
      // UI: redirect to login with a hint
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("reason", "sovereign_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. All other authenticated paths
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
