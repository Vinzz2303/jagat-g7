// ============================================================================
// JAGAT Colony — Next.js API Proxy Route
// Proxies all /api/colony/* requests to the backend Express server
// with authenticated identity headers injected from the HMAC-SHA256
// verified session cookie.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/cookie-signer";

const BACKEND_URL = process.env.JAGAT_BACKEND_URL || "http://127.0.0.1:5000";

// ── Colony Internal Secret ──────────────────────────────────────────────────
// Shared secret between Next.js proxy and Express backend.
// FAIL-CLOSED in production: no fallback.

function getColonySecret(): string {
  const secret = process.env.COLONY_INTERNAL_SECRET;
  if (secret && secret.length >= 16) return secret;

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.warn("[ColonyProxy] ⚠️  COLONY_INTERNAL_SECRET not set. Using dev fallback.");
    return "jagat-colony-internal-2026";
  }

  throw new Error(
    "[ColonyProxy] FATAL: COLONY_INTERNAL_SECRET is required in production (min 16 chars)."
  );
}

// ── Session Extraction (HMAC-SHA256 verified) ───────────────────────────────

async function extractVerifiedSession(request: NextRequest) {
  const raw = request.cookies.get("jagat_g7_session")?.value;
  if (!raw) return null;
  return verifySession(raw);
}

// ── Auth Gate ────────────────────────────────────────────────────────────────

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: status === 403 ? "Forbidden" : "Unauthorized", message }, { status });
}

function buildAuthHeaders(session: { ownerName: string; tier: string; token: string }): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Colony-Caller": session.ownerName,
    "X-Colony-Tier": session.tier,
    "X-Colony-Token": session.token,
    "X-Colony-Secret": getColonySecret(),
  };
}

async function readJsonBodyOrEmpty(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await extractVerifiedSession(request);
  if (!session) return unauthorizedResponse("Session tidak valid atau telah dimanipulasi.");
  if (session.tier !== "SOVEREIGN") return unauthorizedResponse("Clearance SOVEREIGN diperlukan.", 403);

  const { path } = await params;
  const target = `${BACKEND_URL}/colony/${path.join("/")}${request.nextUrl.search}`;

  try {
    const res = await fetch(target, { headers: buildAuthHeaders(session) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Colony backend unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await extractVerifiedSession(request);
  if (!session) return unauthorizedResponse("Session tidak valid atau telah dimanipulasi.");
  if (session.tier !== "SOVEREIGN") return unauthorizedResponse("Clearance SOVEREIGN diperlukan.", 403);

  const { path } = await params;
  const target = `${BACKEND_URL}/colony/${path.join("/")}`;
  const body = await readJsonBodyOrEmpty(request);

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: buildAuthHeaders(session),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Colony backend unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await extractVerifiedSession(request);
  if (!session) return unauthorizedResponse("Session tidak valid atau telah dimanipulasi.");
  if (session.tier !== "SOVEREIGN") return unauthorizedResponse("Clearance SOVEREIGN diperlukan.", 403);

  const { path } = await params;
  const target = `${BACKEND_URL}/colony/${path.join("/")}`;
  const body = await readJsonBodyOrEmpty(request);

  try {
    const res = await fetch(target, {
      method: "PATCH",
      headers: buildAuthHeaders(session),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Colony backend unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
