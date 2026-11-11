// ============================================================================
// JAGAT G7 - Sovereign Token Registry
// Server-only module. Do not import from client components.
// Uses PostgreSQL/Supabase when reachable, with an in-memory fallback when
// outbound cloud database ports are blocked.
// ============================================================================

import { Pool } from "pg";

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

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/jagat_db";

const isSupabase = connectionString.includes("supabase.com");

const SEED_TOKENS: TokenEntity[] = [
  {
    token: "JAGAT-J7-SECURE-2026",
    ownerName: "Faturachman Alkahfi (Core Node)",
    tier: "SOVEREIGN",
    status: "ACTIVE",
    expiredAt: "2026-12-31T23:59:59Z",
  },
  {
    token: "G7-ULTRA-WANDA-99X",
    ownerName: "Wanda (Analis Node)",
    tier: "ULTRA",
    status: "ACTIVE",
    expiredAt: "2026-06-18T00:00:00Z",
  },
  {
    token: "G7-PRO-EXPIRED-TEST",
    ownerName: "Retail Tester",
    tier: "PRO",
    status: "ACTIVE",
    expiredAt: "2026-05-01T00:00:00Z",
  },
];

const localMemoryTokens: TokenEntity[] = SEED_TOKENS.map(cloneToken);

let fallbackMode = false;
let fallbackAnnounced = false;
let pool: Pool | null = null;

const REQUIRED_COLUMNS = ["token", "owner_name", "tier", "status", "expired_at"] as const;

function cloneToken(entity: TokenEntity): TokenEntity {
  return { ...entity };
}

function activateFallback(error?: unknown): void {
  fallbackMode = true;

  if (!fallbackAnnounced) {
    console.warn(
      "[TokenRegistry] ⚠️ Cloud DB Unreachable. Activating Sovereign Local Memory Pool Fallback."
    );
    fallbackAnnounced = true;
  }

  if (error instanceof Error) {
    console.warn("[TokenRegistry] Fallback reason:", error.message);
  }
}

function isSchemaMismatch(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema") ||
    message.includes("relation")
  );
}

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as NodeJS.ErrnoException).code || "";
  const message = error.message.toLowerCase();

  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "XX000" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection reset") ||
    message.includes("connection terminated") ||
    message.includes("enotfound") ||
    message.includes("not found")
  );
}

try {
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (error) => {
    if (isConnectionFailure(error)) activateFallback(error);
    else console.error("[JAGAT DB] Pool error:", error.message);
  });
} catch (error) {
  activateFallback(error);
}

async function initDB(): Promise<void> {
  if (fallbackMode) return;

  if (!pool) {
    activateFallback();
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS jagat_tokens (
          token        VARCHAR(255) PRIMARY KEY,
          owner_name   VARCHAR(255) NOT NULL,
          tier         VARCHAR(50)  NOT NULL,
          status       VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
          expired_at   TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);

      const columnCheck = await client.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'jagat_tokens'
      `);

      const actualColumns = new Set(columnCheck.rows.map((row) => row.column_name));
      const missingColumns = REQUIRED_COLUMNS.filter((column) => !actualColumns.has(column));

      if (missingColumns.length > 0) {
        activateFallback(
          new Error(
            `Legacy/incompatible jagat_tokens schema detected. Missing columns: ${missingColumns.join(", ")}`
          )
        );
        return;
      }

      for (const s of SEED_TOKENS) {
        await client.query(
          `
            INSERT INTO jagat_tokens (token, owner_name, tier, status, expired_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (token) DO UPDATE SET
              owner_name = EXCLUDED.owner_name,
              tier = EXCLUDED.tier,
              status = EXCLUDED.status,
              expired_at = EXCLUDED.expired_at
          `,
          [s.token, s.ownerName, s.tier, s.status, s.expiredAt]
        );
      }
      console.log("[JAGAT DB] Ensured 3 baseline tokens are present.");

      console.log("[JAGAT DB] Connected to PostgreSQL. Table jagat_tokens ready.");
    } finally {
      client.release();
    }
  } catch (error) {
    if (isConnectionFailure(error) || isSchemaMismatch(error)) {
      activateFallback(error);
      return;
    }
    throw error;
  }
}

const initPromise = initDB().catch((error) => {
  if (isConnectionFailure(error) || isSchemaMismatch(error)) activateFallback(error);
  else console.error("[JAGAT DB] Init failed:", error instanceof Error ? error.message : error);
});

function mapRow(row: Record<string, unknown>): TokenEntity {
  const expiredAt =
    row.expired_at instanceof Date ? row.expired_at.toISOString() : String(row.expired_at);

  return {
    token: row.token as string,
    ownerName: row.owner_name as string,
    tier: row.tier as TokenTier,
    status: row.status as TokenStatus,
    expiredAt,
  };
}

function sortByExpiryDesc(a: TokenEntity, b: TokenEntity): number {
  return new Date(b.expiredAt).getTime() - new Date(a.expiredAt).getTime();
}

function normalizeExtensionDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  return Math.max(1, Math.min(365, Math.floor(days)));
}

function extendFromCurrentExpiry(expiredAt: string, days: number): string {
  const safeDays = normalizeExtensionDays(days);
  const now = Date.now();
  const currentExpiry = new Date(expiredAt).getTime();
  const base = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
  return new Date(base + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function validateEntity(entity: TokenEntity | undefined): TokenValidationResult {
  if (!entity) return { valid: false, error: "Token tidak valid. Akses ditolak." };

  if (entity.status === "SUSPENDED") {
    return {
      valid: false,
      entity,
      error: "Token telah disuspend. Hubungi administrator JAGAT G7.",
    };
  }

  if (new Date() > new Date(entity.expiredAt)) {
    return {
      valid: false,
      entity,
      error:
        "Node Masa Aktif Habis. Silakan Perpanjang Langganan Bulanan JAGAT G7 Anda via Transfer BCA.",
    };
  }

  return { valid: true, entity };
}

export async function getRegistry(): Promise<TokenEntity[]> {
  await initPromise;

  if (fallbackMode || !pool) {
    return [...localMemoryTokens].sort(sortByExpiryDesc).map(cloneToken);
  }

  try {
    const { rows } = await pool.query("SELECT * FROM jagat_tokens ORDER BY expired_at DESC");
    return rows.map(mapRow);
  } catch (error) {
    if (!isConnectionFailure(error) && !isSchemaMismatch(error)) throw error;
    activateFallback(error);
    return [...localMemoryTokens].sort(sortByExpiryDesc).map(cloneToken);
  }
}

export async function addToken(entity: TokenEntity): Promise<void> {
  await initPromise;

  if (fallbackMode || !pool) {
    const index = localMemoryTokens.findIndex((item) => item.token === entity.token);
    if (index >= 0) localMemoryTokens[index] = cloneToken(entity);
    else localMemoryTokens.push(cloneToken(entity));
    return;
  }

  try {
    await pool.query(
      "INSERT INTO jagat_tokens (token, owner_name, tier, status, expired_at) VALUES ($1, $2, $3, $4, $5)",
      [entity.token, entity.ownerName, entity.tier, entity.status, entity.expiredAt]
    );
  } catch (error) {
    if (!isConnectionFailure(error) && !isSchemaMismatch(error)) throw error;
    activateFallback(error);
    await addToken(entity);
  }
}

export const createToken = addToken;

export async function updateTokenStatus(
  input: string,
  status: TokenStatus,
): Promise<TokenEntity | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  await initPromise;

  if (fallbackMode || !pool) {
    const index = localMemoryTokens.findIndex((item) => item.token === trimmed);
    if (index < 0) return null;
    localMemoryTokens[index] = { ...localMemoryTokens[index], status };
    return cloneToken(localMemoryTokens[index]);
  }

  try {
    const { rows } = await pool.query(
      "UPDATE jagat_tokens SET status = $2 WHERE token = $1 RETURNING *",
      [trimmed, status],
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  } catch (error) {
    if (!isConnectionFailure(error) && !isSchemaMismatch(error)) throw error;
    activateFallback(error);
    return updateTokenStatus(trimmed, status);
  }
}

export async function extendToken(input: string, days = 30): Promise<TokenEntity | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  await initPromise;

  if (fallbackMode || !pool) {
    const index = localMemoryTokens.findIndex((item) => item.token === trimmed);
    if (index < 0) return null;
    localMemoryTokens[index] = {
      ...localMemoryTokens[index],
      status: "ACTIVE",
      expiredAt: extendFromCurrentExpiry(localMemoryTokens[index].expiredAt, days),
    };
    return cloneToken(localMemoryTokens[index]);
  }

  try {
    const { rows } = await pool.query("SELECT * FROM jagat_tokens WHERE token = $1 LIMIT 1", [
      trimmed,
    ]);
    if (rows.length === 0) return null;

    const nextExpiry = extendFromCurrentExpiry(mapRow(rows[0]).expiredAt, days);
    const updated = await pool.query(
      "UPDATE jagat_tokens SET expired_at = $2, status = 'ACTIVE' WHERE token = $1 RETURNING *",
      [trimmed, nextExpiry],
    );
    return updated.rows.length > 0 ? mapRow(updated.rows[0]) : null;
  } catch (error) {
    if (!isConnectionFailure(error) && !isSchemaMismatch(error)) throw error;
    activateFallback(error);
    return extendToken(trimmed, days);
  }
}

export async function validateToken(input: string): Promise<TokenValidationResult> {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, error: "Access token diperlukan." };

  await initPromise;

  if (fallbackMode || !pool) {
    const entity = localMemoryTokens.find((item) => item.token === trimmed);
    return validateEntity(entity ? cloneToken(entity) : undefined);
  }

  try {
    const { rows } = await pool.query("SELECT * FROM jagat_tokens WHERE token = $1 LIMIT 1", [
      trimmed,
    ]);
    return validateEntity(rows.length > 0 ? mapRow(rows[0]) : undefined);
  } catch (error) {
    if (!isConnectionFailure(error) && !isSchemaMismatch(error)) throw error;
    activateFallback(error);
    const entity = localMemoryTokens.find((item) => item.token === trimmed);
    return validateEntity(entity ? cloneToken(entity) : undefined);
  }
}
