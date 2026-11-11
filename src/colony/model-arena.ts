// ============================================================================
// JAGAT Colony — Model Arena v0
// Advisory model performance tracking.
//
// Stores performance records per model per task type.
// Provides advisory recommendations — does NOT auto-route.
// Does NOT modify model-router.ts, Ollama config, or production defaults.
//
// Storage: Redis only.
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import {
  type ModelArenaEntry,
  type ModelArenaRecord,
  type RuntimeArenaEvent,
  type RuntimeArenaOutcome,
  REDIS_KEYS,
} from "./types.js";

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum records per model+taskType (capped list) */
const MAX_RECORDS = 100;

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Record a single performance data point for a model on a task type.
 * Automatically updates the rolling summary.
 */
export async function recordArenaResult(
  modelId: string,
  taskType: string,
  score: number,
  latencyMs: number,
  source: string = "manual",
): Promise<ModelArenaEntry> {
  const redis = getRedisClient();
  const now = new Date().toISOString();

  // Create the record
  const record: ModelArenaRecord = {
    modelId,
    taskType,
    score: Math.max(0, Math.min(100, score)),
    latencyMs: Math.max(0, latencyMs),
    recordedAt: now,
    source,
  };

  // Append to capped list
  const recordsKey = REDIS_KEYS.arenaRecords(modelId, taskType);
  await redis.rpush(recordsKey, JSON.stringify(record));
  await redis.ltrim(recordsKey, -MAX_RECORDS, -1);

  // Register in index (use || separator — model IDs contain colons)
  await redis.sadd(REDIS_KEYS.arenaIndex(), `${modelId}||${taskType}`);

  // Recompute summary
  const summary = await recomputeSummary(modelId, taskType);

  return summary;
}

/**
 * Get the performance summary for a specific model + taskType.
 */
export async function getArenaSummary(
  modelId: string,
  taskType: string,
): Promise<ModelArenaEntry | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.arenaSummary(modelId, taskType));
  return data ? (JSON.parse(data) as ModelArenaEntry) : null;
}

/**
 * List all arena summaries, optionally filtered by taskType.
 */
export async function listArenaSummaries(
  taskType?: string,
): Promise<ModelArenaEntry[]> {
  const redis = getRedisClient();
  const indexEntries = await redis.smembers(REDIS_KEYS.arenaIndex());

  const results: ModelArenaEntry[] = [];

  for (const entry of indexEntries) {
    const sepIdx = entry.indexOf("||");
    if (sepIdx < 0) continue;
    const mId = entry.slice(0, sepIdx);
    const tType = entry.slice(sepIdx + 2);
    if (!mId || !tType) continue;
    if (taskType && tType !== taskType) continue;

    const summary = await getArenaSummary(mId, tType);
    if (summary) results.push(summary);
  }

  // Sort by avgScore descending
  results.sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  return results;
}

/**
 * Get advisory recommendation for which model to use for a task type.
 * Returns the model with highest avgScore (tie-break: lower latency).
 *
 * This is ADVISORY only — it does NOT change routing.
 */
export async function getRecommendation(
  taskType: string,
): Promise<{ modelId: string; avgScore: number; avgLatencyMs: number; reason: string } | null> {
  const summaries = await listArenaSummaries(taskType);

  if (summaries.length === 0) {
    return null;
  }

  // Filter to entries with actual data
  const withData = summaries.filter((s) => s.avgScore !== null && s.sampleCount > 0);
  if (withData.length === 0) {
    return null;
  }

  // Sort by avgScore desc, then by avgLatencyMs asc (lower is better)
  withData.sort((a, b) => {
    const scoreDiff = (b.avgScore ?? 0) - (a.avgScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.avgLatencyMs ?? Infinity) - (b.avgLatencyMs ?? Infinity);
  });

  const best = withData[0];
  if (!best) return null;

  return {
    modelId: best.modelId,
    avgScore: best.avgScore ?? 0,
    avgLatencyMs: best.avgLatencyMs ?? 0,
    reason: `Best avg score (${best.avgScore}/100) for "${taskType}" across ${best.sampleCount} samples. Advisory only — does not change production routing.`,
  };
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Recompute the summary for a model+taskType from its record list.
 */
async function recomputeSummary(
  modelId: string,
  taskType: string,
): Promise<ModelArenaEntry> {
  const redis = getRedisClient();
  const recordsKey = REDIS_KEYS.arenaRecords(modelId, taskType);

  // Read all records
  const rawRecords = await redis.lrange(recordsKey, 0, -1);
  const records: ModelArenaRecord[] = rawRecords.map((r: string) => JSON.parse(r));

  const sampleCount = records.length;
  let avgScore: number | null = null;
  let avgLatencyMs: number | null = null;

  if (sampleCount > 0) {
    const totalScore = records.reduce((sum, r) => sum + r.score, 0);
    const totalLatency = records.reduce((sum, r) => sum + r.latencyMs, 0);
    avgScore = Math.round(totalScore / sampleCount);
    avgLatencyMs = Math.round(totalLatency / sampleCount);
  }

  // Generate recommendation text
  let recommendation: string;
  if (sampleCount === 0) {
    recommendation = "No data available.";
  } else {
    // avgScore is guaranteed non-null when sampleCount > 0
    const score = avgScore ?? 0;
    if (score >= 80) {
      recommendation = `Strong performer for "${taskType}" tasks. ${sampleCount} samples, avg ${score}/100.`;
    } else if (score >= 60) {
      recommendation = `Acceptable for "${taskType}" tasks. ${sampleCount} samples, avg ${score}/100. Monitor quality.`;
    } else {
      recommendation = `Weak for "${taskType}" tasks. ${sampleCount} samples, avg ${score}/100. Consider alternatives.`;
    }
  }

  const summary: ModelArenaEntry = {
    modelId,
    taskType,
    avgScore,
    avgLatencyMs,
    sampleCount,
    recommendation,
    lastUpdatedAt: new Date().toISOString(),
  };

  await redis.set(REDIS_KEYS.arenaSummary(modelId, taskType), JSON.stringify(summary));

  return summary;
}

// ── T-043: Runtime Arena Event Recording ─────────────────────────────────────

const MAX_RUNTIME_EVENTS = 500;

/**
 * Record a runtime arena event — observability data from actual model usage.
 * Does NOT require a quality score. Captures latency and routing metadata.
 * Advisory only — does NOT change production routing.
 */
export async function recordRuntimeEvent(
  modelId: string,
  taskType: string,
  latencyMs: number,
  metadata?: {
    taskId?: string;
    agentRole?: string;
    outcome?: RuntimeArenaOutcome;
    source?: string;
    errorCode?: string;
  },
): Promise<void> {
  try {
    const redis = getRedisClient();
    const event: RuntimeArenaEvent = {
      eventId: `runtime_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      modelId,
      taskType,
      latencyMs: Math.max(0, latencyMs),
      outcome: metadata?.outcome ?? "success",
      source: metadata?.source ?? "worker-executor",
      taskId: metadata?.taskId,
      agentRole: metadata?.agentRole,
      errorCode: metadata?.errorCode,
      recordedAt: new Date().toISOString(),
    };
    const key = REDIS_KEYS.arenaRuntimeEvents();
    await redis.rpush(key, JSON.stringify(event));
    await redis.ltrim(key, -MAX_RUNTIME_EVENTS, -1);
  } catch (err) {
    // Non-fatal: runtime recording should never break worker execution
    console.warn("[Colony:Arena] Runtime event recording failed (non-fatal):", err);
  }
}

/**
 * Get recent runtime arena events.
 * @param limit Maximum number of events to return (default 50)
 */
export async function getRuntimeEvents(limit: number = 50): Promise<RuntimeArenaEvent[]> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.arenaRuntimeEvents();
  const raw = await redis.lrange(key, -limit, -1);
  return raw.map((r: string) => JSON.parse(r) as RuntimeArenaEvent).reverse();
}
