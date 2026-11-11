// ============================================================================
// JAGAT Colony — Centralized Audit Engine
// Append-only audit log untuk semua mutasi colony governance
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import { REDIS_KEYS, type AuditAction } from "./types.js";

// ── T-044: Audit Category Normalization ─────────────────────────────────────

export type AuditCategory =
  | "colony"
  | "mission"
  | "task"
  | "approval"
  | "agent"
  | "chat"
  | "memory"
  | "directive"
  | "auth"
  | "session"
  | "scheduler"
  | "reporter"
  | "worker"
  | "patch"
  | "training"
  | "distillation"
  | "unknown";

/** Derive category from action prefix (e.g., "task.create" → "task") */
export function getAuditCategory(action: AuditAction): AuditCategory {
  const prefix = action.split(".")[0] ?? "unknown";
  const valid: string[] = [
    "colony", "mission", "task", "approval", "agent", "chat",
    "memory", "directive", "auth", "session", "scheduler",
    "reporter", "worker", "patch", "training", "distillation",
  ];
  return valid.includes(prefix) ? (prefix as AuditCategory) : "unknown";
}

// ── Audit Entry ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  auditId: string;
  timestamp: string;       // ISO 8601
  actor: string;           // verified name dari colonyIdentity
  actorRole: string;       // founder, executive_product, etc.
  action: AuditAction;
  category: AuditCategory; // T-044: derived from action prefix
  resource: string;        // e.g., "task:TASK-20260527-0001"
  detail: Record<string, unknown>;
  ip?: string;
}

// ── ID Generator ────────────────────────────────────────────────────────────

let auditSeq = 0;

function nextAuditId(): string {
  auditSeq++;
  return `AUDIT-${Date.now().toString(36)}-${auditSeq}`;
}

// ── Emit Audit ──────────────────────────────────────────────────────────────

export async function emitAudit(params: {
  actor: string;
  actorRole: string;
  action: AuditAction;
  resource: string;
  detail?: Record<string, unknown>;
  ip?: string;
}): Promise<AuditEntry> {
  const redis = getRedisClient();
  const entry: AuditEntry = {
    auditId: nextAuditId(),
    timestamp: new Date().toISOString(),
    actor: params.actor,
    actorRole: params.actorRole,
    action: params.action,
    category: getAuditCategory(params.action), // T-044: auto-derived
    resource: params.resource,
    detail: params.detail ?? {},
    ip: params.ip,
  };

  // Append to main audit log (append-only list)
  await redis.rpush(REDIS_KEYS.auditLog(), JSON.stringify(entry));

  // Also index by actor for per-actor queries
  await redis.rpush(REDIS_KEYS.auditByActor(params.actor), JSON.stringify(entry));

  return entry;
}

// ── Query Audit Log ─────────────────────────────────────────────────────────

export async function queryAuditLog(options?: {
  limit?: number;
  offset?: number;
  actor?: string;
  action?: AuditAction;
  category?: AuditCategory; // T-044: filter by category
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const redis = getRedisClient();
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  let key: string;
  if (options?.actor) {
    key = REDIS_KEYS.auditByActor(options.actor);
  } else {
    key = REDIS_KEYS.auditLog();
  }

  const raw = await redis.lrange(key, 0, -1);
  let entries: AuditEntry[] = [];
  for (const r of raw) {
    try {
      entries.push(JSON.parse(r) as AuditEntry);
    } catch {
      // Skip corrupted entries (e.g., truncated JSON from crash)
    }
  }

  // Filter by action if specified
  if (options?.action) {
    entries = entries.filter((e) => e.action === options.action);
  }

  // T-044: Filter by category if specified
  if (options?.category) {
    entries = entries.filter((e) => e.category === options.category);
  }

  // Return newest first
  entries.reverse();

  const total = entries.length;
  return { entries: entries.slice(offset, offset + limit), total };
}
