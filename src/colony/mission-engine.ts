// ============================================================================
// JAGAT Colony — Mission Engine
// Manajemen mission (arahan strategis founder → workstreams → tasks)
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import * as ledger from "./mission-ledger.js";
import {
  type Mission,
  type MissionOutcomeSummary,
  type TaskPriority,
  type ColonyPhase,
  TASK_PRIORITIES,
  REDIS_KEYS,
} from "./types.js";
import { getTasksByMission } from "./task-engine.js";

const MISSION_STATUSES = ["active", "completed", "paused", "cancelled"] as const;

// ── ID Generator ────────────────────────────────────────────────────────────

async function nextMissionId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.missionSequence());
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `MISSION-${date}-${String(seq).padStart(3, "0")}`;
}

// ── Mission CRUD ────────────────────────────────────────────────────────────

export async function createMission(params: {
  title: string;
  objective: string;
  phase: ColonyPhase;
  priority: TaskPriority;
  createdBy: string;
  targetDate?: string;
  notes?: string;
}): Promise<Mission> {
  const redis = getRedisClient();
  // GAP 10: Runtime validation — reject garbage priority and empty createdBy
  if (!TASK_PRIORITIES.includes(params.priority)) {
    throw new Error(`Invalid mission priority: "${params.priority}". Allowed: ${TASK_PRIORITIES.join(", ")}`);
  }
  if (!params.createdBy || params.createdBy.trim().length === 0) {
    throw new Error("Mission createdBy cannot be empty — caller identity required.");
  }
  const id = await nextMissionId();
  const now = new Date().toISOString();

  const mission: Mission = {
    id,
    title: params.title,
    objective: params.objective,
    phase: params.phase,
    status: "active",
    priority: params.priority,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    targetDate: params.targetDate,
    workstreamIds: [],
    notes: params.notes,
  };

  ledger.saveMission(mission);
  await redis.set(REDIS_KEYS.mission(id), JSON.stringify(mission));
  await redis.sadd(REDIS_KEYS.missionIndex(), id);

  return mission;
}

export async function getMission(missionId: string): Promise<Mission | null> {
  const saved = ledger.loadMission(missionId);
  if (saved) return saved;
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.mission(missionId));
  return data ? (JSON.parse(data) as Mission) : null;
}

export async function updateMission(
  missionId: string,
  updates: Partial<Pick<Mission, "title" | "objective" | "status" | "priority" | "targetDate" | "notes">>,
): Promise<Mission> {
  const redis = getRedisClient();
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  if (updates.status !== undefined && !MISSION_STATUSES.includes(updates.status)) {
    throw new Error(`Invalid mission status: ${updates.status}`);
  }
  if (updates.priority !== undefined && !TASK_PRIORITIES.includes(updates.priority)) {
    throw new Error(`Invalid mission priority: ${updates.priority}`);
  }

  // Explicit field assignment to prevent injection of unexpected fields
  if (updates.title !== undefined) mission.title = updates.title;
  if (updates.objective !== undefined) mission.objective = updates.objective;
  if (updates.status !== undefined) mission.status = updates.status;
  if (updates.priority !== undefined) mission.priority = updates.priority;
  if (updates.targetDate !== undefined) mission.targetDate = updates.targetDate;
  if (updates.notes !== undefined) mission.notes = updates.notes;
  mission.updatedAt = new Date().toISOString();
  ledger.saveMission(mission);
  await redis.set(REDIS_KEYS.mission(missionId), JSON.stringify(mission));

  return mission;
}

export async function listMissions(status?: Mission["status"]): Promise<Mission[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.missionIndex());

  const missions: Mission[] = [];
  for (const id of ids) {
    const m = await getMission(id);
    if (m && (!status || m.status === status)) {
      missions.push(m);
    }
  }

  // Sort by priority then creation date
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return missions.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ── Mission Completion with Outcome Summary ─────────────────────────────────

/**
 * Complete a mission and generate an outcome summary from linked tasks.
 * Collects task status distribution, quality scores from evidence, and blocked reasons.
 * Stores the summary on the mission object for audit trail.
 *
 * After storing the summary, automatically creates a lesson via lesson-engine.
 * Lesson creation is idempotent — if a lesson already exists for this mission, it is reused.
 *
 * Does NOT auto-replan, auto-retry, or create new tasks.
 * Does NOT change approval policy.
 * Does NOT write to Qdrant.
 */
export async function completeMissionWithSummary(missionId: string): Promise<Mission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (mission.status === "completed") throw new Error(`Mission ${missionId} already completed`);

  // Gather all linked tasks
  const tasks = await getTasksByMission(missionId);

  // Count statuses
  const statusCounts = {
    done: 0,
    blocked: 0,
    review: 0,
    running: 0,
    queued: 0,
    planning: 0,
    approved: 0,
    archived: 0,
  };
  const blockedReasons: string[] = [];
  const qualityScores: number[] = [];

  for (const task of tasks) {
    const key = task.status as keyof typeof statusCounts;
    if (key in statusCounts) {
      statusCounts[key]++;
    }

    // Collect blocked reasons
    if (task.status === "blocked" && task.blockedReason) {
      blockedReasons.push(`[${task.taskId}] ${task.blockedReason}`);
    }

    // Extract quality_score from evidence (evaluation engine stores it as typed property)
    for (const ev of task.evidence) {
      if (typeof ev.quality_score === "number") {
        qualityScores.push(ev.quality_score);
      }
    }
  }

  const totalTasks = tasks.length;
  const avgQualityScore = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : null;
  const topQualityScore = qualityScores.length > 0 ? Math.max(...qualityScores) : null;
  const lowestQualityScore = qualityScores.length > 0 ? Math.min(...qualityScores) : null;

  // Build human-readable summary
  const parts: string[] = [];
  parts.push(`Mission "${mission.title}" completed.`);
  parts.push(`${totalTasks} tasks total: ${statusCounts.done} done, ${statusCounts.blocked} blocked, ${statusCounts.review} in review, ${statusCounts.running} running, ${statusCounts.queued} queued.`);
  if (avgQualityScore !== null) {
    parts.push(`Quality: avg ${avgQualityScore}/100 (top ${topQualityScore}, lowest ${lowestQualityScore}, ${qualityScores.length} evaluated).`);
  } else {
    parts.push(`No quality evaluations found.`);
  }
  if (blockedReasons.length > 0) {
    parts.push(`Blocked tasks: ${blockedReasons.join("; ")}`);
  }

  const outcomeSummary: MissionOutcomeSummary = {
    completedAt: new Date().toISOString(),
    totalTasks,
    doneCount: statusCounts.done,
    blockedCount: statusCounts.blocked,
    reviewCount: statusCounts.review,
    runningCount: statusCounts.running,
    queuedCount: statusCounts.queued,
    archivedCount: statusCounts.archived,
    avgQualityScore,
    qualityScoreCount: qualityScores.length,
    topQualityScore,
    lowestQualityScore,
    blockedReasons,
    summary: parts.join(" "),
  };

  // Update mission
  const redis = getRedisClient();
  mission.status = "completed";
  mission.outcomeSummary = outcomeSummary;
  mission.updatedAt = new Date().toISOString();
  ledger.saveMission(mission);
  await redis.set(REDIS_KEYS.mission(missionId), JSON.stringify(mission));

  // ── v0B: Auto-create lesson from mission outcome ─────────────────────────
  // Import dynamically to avoid circular dependency (lesson-engine imports mission-engine)
  try {
    const { createLessonFromMission } = await import("./lesson-engine.js");
    const lesson = await createLessonFromMission(missionId);
    console.log(`[Colony:MissionEngine] Lesson created: ${lesson.lessonId} for mission ${missionId} (category: ${lesson.category})`);
  } catch (err: any) {
    // Non-fatal: lesson creation failure should not block mission completion
    console.error(`[Colony:MissionEngine] Warning: failed to create lesson for mission ${missionId}: ${err.message}`);
  }

  return mission;
}

/**
 * Get outcome summary for a completed mission.
 * Returns null if mission not found or not completed.
 */
export async function getMissionOutcome(missionId: string): Promise<MissionOutcomeSummary | null> {
  const mission = await getMission(missionId);
  if (!mission || mission.status !== "completed") return null;
  return mission.outcomeSummary ?? null;
}
