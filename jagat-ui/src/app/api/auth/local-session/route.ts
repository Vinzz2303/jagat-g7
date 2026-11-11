// ============================================================================
// JAGAT G7 — Local Session API Route
// Creates a guest session cookie via server-side signing
// ============================================================================

import { NextResponse } from "next/server";
import { buildSessionCookie, type SessionPayload } from "@/lib/cookie-signer";

export async function POST() {
  const expiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const sessionPayload: SessionPayload = {
    ownerName: "Faturachman Alkahfi (Guest Node)",
    tier: "GUEST",
    token: "G7-SOVEREIGN-LOCAL-SESSION",
    expiredAt,
  };

  const cookieHeader = await buildSessionCookie(sessionPayload);

  const response = NextResponse.json({
    success: true,
    message: "Sesi lokal berdaulat diaktifkan.",
    tier: "GUEST",
  });
  response.headers.set("Set-Cookie", cookieHeader);
  return response;
}
