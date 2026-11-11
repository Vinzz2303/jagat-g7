// ============================================================================
// JAGAT G7 — Client-Safe Token Utilities
// This module is safe to import from "use client" components.
// Contains ONLY types and browser cookie helpers — NO pg/database imports.
//
// NOTE: Session cookies are now SET by the server (HttpOnly, signed).
// Client can only read the display-only payload (for UI) and clear via API.
// ============================================================================

export type TokenTier = "PRO" | "ULTRA" | "SOVEREIGN" | "GUEST";
export type TokenStatus = "ACTIVE" | "SUSPENDED";

export interface TokenEntity {
  token: string;
  ownerName: string;
  tier: TokenTier;
  status: TokenStatus;
  expiredAt: string;
}

export interface TokenValidationResult {
  valid: boolean;
  entity?: TokenEntity;
  error?: string;
}

export interface SessionPayload {
  ownerName: string;
  tier: TokenTier;
  token: string;
  expiredAt?: string;
}

// ── Cookie Helpers ───────────────────────────────────────────────────────────

/**
 * Clear the session cookie via server-side API.
 * This calls the logout endpoint which sets Set-Cookie with max-age=0.
 */
export async function clearSessionViaApi(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Fallback: try client-side clear (won't work for HttpOnly, but is harmless)
    document.cookie = "jagat_g7_session=; path=/; max-age=0; SameSite=Lax";
  }
}

/**
 * Legacy client-side cookie clear (kept for backward compatibility).
 * HttpOnly cookies set by server cannot be cleared this way — use clearSessionViaApi instead.
 */
export function clearSessionCookie(): void {
  document.cookie = "jagat_g7_session=; path=/; max-age=0; SameSite=Lax";
}

/**
 * Read the session cookie for UI display purposes only.
 * NOTE: With HttpOnly cookies, this will return null.
 * UI components should fetch session state from a server endpoint instead.
 */
export function readSessionCookie(): SessionPayload | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/jagat_g7_session=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    // Handle both signed (base64.hmac) and legacy (base64) formats
    const raw = match[1];
    const dotIndex = raw.lastIndexOf(".");
    const b64 = dotIndex > 0 ? raw.substring(0, dotIndex) : raw;
    return JSON.parse(atob(b64)) as SessionPayload;
  } catch {
    return null;
  }
}
