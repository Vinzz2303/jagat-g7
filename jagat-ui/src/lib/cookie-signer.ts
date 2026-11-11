// ============================================================================
// JAGAT G7 — Server-Only Cookie Signer (HMAC-SHA256)
// DO NOT import from "use client" components.
//
// Uses Web Crypto API (crypto.subtle) for real HMAC-SHA256 signing.
// Fully compatible with Edge Runtime and Node.js environments.
// ============================================================================

export interface SessionPayload {
  ownerName: string;
  tier: string;
  token: string;
  expiredAt?: string;
}

// ── Secret Management ───────────────────────────────────────────────────────

function getSecret(): string {
  const envSecret = process.env.COOKIE_SIGNING_SECRET;

  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    // Dev-only deterministic fallback — sessions survive within process
    console.warn(
      "[CookieSigner] ⚠️  COOKIE_SIGNING_SECRET not set. Using dev fallback. DO NOT use in production."
    );
    return "jagat-dev-cookie-signing-secret-2026-local-only";
  }

  // FAIL-CLOSED: production MUST have a proper secret
  throw new Error(
    "[CookieSigner] FATAL: COOKIE_SIGNING_SECRET is required in production and must be >= 32 characters. " +
    "Server refusing to sign/verify cookies without a proper secret."
  );
}

// ── Web Crypto HMAC-SHA256 ──────────────────────────────────────────────────

const encoder = new TextEncoder();

/**
 * Import the signing secret as a CryptoKey for HMAC-SHA256.
 */
async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Compute HMAC-SHA256 of data, returning hex string.
 */
async function hmacSign(data: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  // Convert ArrayBuffer to hex string
  const bytes = new Uint8Array(signature);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

/**
 * Constant-time comparison of two hex strings to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── Sign / Verify ───────────────────────────────────────────────────────────

/**
 * Sign a session payload → returns a signed cookie value.
 * Format: `base64payload.hmac256hex`
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = toBase64Url(json);
  const signature = await hmacSign(b64);
  return `${b64}.${signature}`;
}

/**
 * Verify and decode a signed cookie value.
 * Returns null if HMAC-SHA256 signature is invalid or payload is malformed.
 */
export async function verifySession(raw: string): Promise<SessionPayload | null> {
  if (!raw || typeof raw !== "string") return null;

  const normalizedRaw = decodeURIComponent(raw);
  const dotIndex = normalizedRaw.lastIndexOf(".");
  if (dotIndex < 1) return null;

  const b64 = normalizedRaw.substring(0, dotIndex);
  const providedSignature = normalizedRaw.substring(dotIndex + 1);

  // Compute expected HMAC-SHA256
  let expectedSignature: string;
  try {
    expectedSignature = await hmacSign(b64);
  } catch {
    return null;
  }

  // Constant-time comparison
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  // Decode payload
  try {
    const json = fromBase64Url(b64);
    const payload = JSON.parse(json) as SessionPayload;

    // Validate required fields
    if (!payload.ownerName || !payload.tier || !payload.token) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Cookie Builder ──────────────────────────────────────────────────────────

const COOKIE_NAME = "jagat_g7_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Build a Set-Cookie header value for a signed session.
 * Uses real HMAC-SHA256 via Web Crypto API.
 */
export async function buildSessionCookie(payload: SessionPayload): Promise<string> {
  const signed = await signSession(payload);
  const isProduction = process.env.NODE_ENV === "production";
  const secureCookieEnabled = process.env.COOKIE_SECURE !== "false";
  const flags = [
    `${COOKIE_NAME}=${encodeURIComponent(signed)}`,
    `Path=/`,
    `Max-Age=${MAX_AGE_SECONDS}`,
    `SameSite=Lax`,
    `HttpOnly`,
  ];
  if (isProduction && secureCookieEnabled) flags.push("Secure");
  return flags.join("; ");
}

/**
 * Build a Set-Cookie header to clear the session cookie.
 * (No crypto needed — just expires the cookie.)
 */
export function buildClearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
