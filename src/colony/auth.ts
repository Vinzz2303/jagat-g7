// ============================================================================
// JAGAT Colony — Auth Middleware
// Express middleware untuk validasi akses colony berdasarkan role
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import type { HumanRole } from "./types.js";

// ── Colony Identity ─────────────────────────────────────────────────────────

export interface ColonyIdentity {
  name: string;
  role: HumanRole;
  tier: string;
  token: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      colonyIdentity?: ColonyIdentity;
    }
  }
}

// ── Tier → Role Mapping ─────────────────────────────────────────────────────
// Saat ini hanya SOVEREIGN → founder yang aktif.
//
// DESIGN NOTE (Phase 2 Final):
// Role mapping sengaja dibatasi ke founder-only pada tahap ini.
// Executive roles (executive_product, executive_infra) belum diaktifkan
// karena:
//   1. Belum ada token tier yang memetakan ke executive (ULTRA masih
//      belum punya klaim role eksplisit di token registry)
//   2. Untuk mengaktifkan executive, nanti perlu:
//      - Tambahkan field `role` eksplisit di token entity (bukan infer dari tier)
//      - Atau tambahkan tier-to-role mapping entry di sini
//   3. Sampai saat itu, tier selain SOVEREIGN ditolak dari colony
//
// Ini BUKAN bug — ini keputusan arsitektural yang disengaja.
// Jangan aktifkan executive mapping tanpa token registry yang mendukung.

function tierToRole(tier: string): HumanRole | null {
  switch (tier) {
    case "SOVEREIGN":
      return "founder";
    // TIDAK DIAKTIFKAN sampai token registry punya field `role` eksplisit:
    // case "ULTRA":
    //   return "executive_product";
    default:
      return null;
  }
}

// ── Shared Secret for Internal Proxy ────────────────────────────────────────
// The Next.js proxy sends this secret to prove it already validated the session.
// FAIL-CLOSED in production: server refuses to start without proper secret.

function getColonyInternalSecret(): string {
  const secret = process.env.COLONY_INTERNAL_SECRET;
  if (secret && secret.length >= 16) return secret;

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    return "jagat-colony-internal-2026";
  }

  throw new Error(
    "[Colony:Auth] FATAL: COLONY_INTERNAL_SECRET is required in production (min 16 chars). " +
    "Server refusing to validate colony requests."
  );
}

// ── Auth Middleware ─────────────────────────────────────────────────────────

/**
 * colonyAuthGuard — validates that the caller has the required colony role.
 *
 * Auth flow:
 * 1. Next.js middleware validates signed session cookie (HMAC-SHA256)
 * 2. API proxy injects X-Colony-Caller, X-Colony-Tier, X-Colony-Token, X-Colony-Secret
 * 3. This middleware validates the internal secret and maps tier → role
 * 4. Injects req.colonyIdentity for downstream route handlers
 *
 * @param allowedRoles - Array of HumanRole values that may access this endpoint.
 *                       If empty, any authenticated colony user is accepted.
 */
export function colonyAuthGuard(...allowedRoles: HumanRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identityHeaderNames = [
      "x-colony-caller",
      "x-colony-tier",
      "x-colony-token",
      "x-colony-secret",
    ];
    const duplicateIdentityHeader = identityHeaderNames.find((headerName) => {
      let count = 0;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i]?.toLowerCase() === headerName) count += 1;
        if (count > 1) return true;
      }
      return false;
    });

    if (duplicateIdentityHeader) {
      res.status(400).json({
        error: "Bad Request",
        message: `Duplicate identity header "${duplicateIdentityHeader}" is not allowed.`,
      });
      return;
    }

    // Read forwarded identity from proxy
    // Express headers can be string | string[] if duplicate headers are sent.
    // We require exactly one value per header; reject arrays defensively.
    const rawCallerName = req.headers["x-colony-caller"];
    const rawCallerTier = req.headers["x-colony-tier"];
    const rawCallerToken = req.headers["x-colony-token"];
    const rawSecret = req.headers["x-colony-secret"];

    if (Array.isArray(rawCallerName) || Array.isArray(rawCallerTier) || Array.isArray(rawCallerToken) || Array.isArray(rawSecret)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Duplicate identity headers are not allowed.",
      });
      return;
    }

    const callerName = rawCallerName as string | undefined;
    const callerTier = rawCallerTier as string | undefined;
    const callerToken = rawCallerToken as string | undefined;
    const secret = rawSecret as string | undefined;

    // Validate internal proxy secret (fail-closed)
    let expectedSecret: string;
    try {
      expectedSecret = getColonyInternalSecret();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Colony auth configuration error.",
      });
      return;
    }

    if (!secret || secret !== expectedSecret) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Colony API hanya dapat diakses melalui proxy internal.",
      });
      return;
    }

    // Validate required identity headers
    if (!callerName || !callerTier || !callerToken) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Identity headers tidak lengkap.",
      });
      return;
    }

    // Map tier to colony role
    const role = tierToRole(callerTier);
    if (!role) {
      res.status(403).json({
        error: "Forbidden",
        message: `Tier "${callerTier}" tidak memiliki akses colony.`,
      });
      return;
    }

    // Check role-based access
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Role "${role}" tidak diizinkan untuk endpoint ini. Required: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    // Inject identity into request
    req.colonyIdentity = {
      name: callerName,
      role,
      tier: callerTier,
      token: callerToken,
    };

    next();
  };
}

// ── Convenience Guards ──────────────────────────────────────────────────────

/** Only founder can access */
export const founderOnly = colonyAuthGuard("founder");

/** Founder and executives can access */
export const executiveOrAbove = colonyAuthGuard("founder", "executive_product", "executive_infra");

/** Any authenticated colony user */
export const anyColonyUser = colonyAuthGuard("founder", "executive_product", "executive_infra", "internal_ops");
