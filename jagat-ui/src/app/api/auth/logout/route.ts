// ============================================================================
// JAGAT G7 — Logout API Route
// Clears session cookie via server-side Set-Cookie
// ============================================================================

import { NextResponse } from "next/server";
import { buildClearSessionCookie } from "@/lib/cookie-signer";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Sesi telah dihapus.",
  });
  response.headers.set("Set-Cookie", buildClearSessionCookie());
  return response;
}
