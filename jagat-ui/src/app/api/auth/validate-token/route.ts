// ============================================================================
// JAGAT G7 — Token Validation API Route
// Validates access token and sets signed session cookie via Set-Cookie header
// ============================================================================

import { NextResponse } from "next/server";
import { validateToken } from "@/lib/token-registry";
import { buildSessionCookie, type SessionPayload } from "@/lib/cookie-signer";

export async function POST(req: Request) {
  const body = await req.json();
  const { token } = body as { token?: string };

  if (!token?.trim()) {
    return NextResponse.json({ valid: false, error: "Access token diperlukan." });
  }

  const result = await validateToken(token);

  if (!result.valid || !result.entity) {
    return NextResponse.json(result);
  }

  // Build signed session cookie
  const sessionPayload: SessionPayload = {
    ownerName: result.entity.ownerName,
    tier: result.entity.tier,
    token: result.entity.token,
    expiredAt: result.entity.expiredAt,
  };
  const cookieHeader = await buildSessionCookie(sessionPayload);

  // Return validation result WITH Set-Cookie header
  const response = NextResponse.json(result);
  response.headers.set("Set-Cookie", cookieHeader);
  return response;
}
