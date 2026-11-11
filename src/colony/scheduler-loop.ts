// ============================================================================
// JAGAT Colony - C6 Scheduler Loop
// Runs safe autonomous task claims and scheduled reporter summaries.
// ============================================================================

import type { AgentRole, ColonyTask, TaskStatus } from "./types.js";
import * as taskEngine from "./task-engine.js";
import * as schedulerQueue from "./scheduler-queue.js";
import * as agentSimulator from "./agent-simulator.js";
import * as chatEngine from "./chat-engine.js";
import * as auditEngine from "./audit-engine.js";
import * as reporterEngine from "./reporter-engine.js";
import { assessTaskAutonomyPolicy } from "./autonomous-policy.js";
import { createNextOptedBacklogTask } from "./backlog-intake.js";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_REPORTER_CHECK_MS = 10 * 60_000;
const DEFAULT_HEARTBEAT_MS = 2 * 60 * 60 * 1000; // 2 hours
const DEFAULT_WORKER_ID = "c6-scheduler-loop";
const SCHEDULER_ROLES: AgentRole[] = ["reporter", "director", "planner", "researcher", "builder"];
const AUTONOMOUS_ROLES: AgentRole[] = ["reporter", "director", "planner", "researcher"];
const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const STUCK_ALERT_COOLDOWN_MS = parsePositiveInt(process.env.C6_STUCK_ALERT_COOLDOWN_MS, 30 * 60 * 1000);
const STUCK_ALERT_DIGEST_LIMIT = parsePositiveInt(process.env.C6_STUCK_ALERT_DIGEST_LIMIT, 10);
const STUCK_SCAN_LIMIT = parsePositiveInt(process.env.C6_STUCK_SCAN_LIMIT, 500);
const STUCK_AUTO_BLOCK_ENABLED = process.env.C6_STUCK_AUTO_BLOCK_ENABLED !== "false";
const STUCK_AUTO_BLOCK_MINUTES = parsePositiveInt(process.env.C6_STUCK_AUTO_BLOCK_MINUTES, 120);
const STUCK_AUTO_BLOCK_MAX_PER_TICK = parsePositiveInt(process.env.C6_STUCK_AUTO_BLOCK_MAX_PER_TICK, 5);
const TICK_TIMEOUT_MS = parsePositiveInt(process.env.C6_TICK_TIMEOUT_MS, 5 * 60 * 1000); // 5 min
const STUCK_STATUSES: TaskStatus[] = ["running", "planning"];

interface StuckTaskInfo {
  task: ColonyTask;
  taskId: string;
  status: TaskStatus;
  minutes: number;
  autoBlocked?: boolean;
  autoBlockDeferredReason?: string;
}

interface SchedulerLoopState {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  reporterCheckMs: number;
  heartbeatMs: number;
  tickCount: number;
  claimedCount: number;
  skippedCount: number;
  lastSkippedCount: number;
  lastTickAt?: string;
  lastClaimedTaskId?: string;
  lastReporterCheckAt?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
}

export interface SchedulerTickResult {
  claimed: number;
  skipped: number;
  claimedTaskIds: string[];
}

const state: SchedulerLoopState = {
  enabled: process.env.C6_SCHEDULER_ENABLED !== "false",
  running: false,
  intervalMs: parsePositiveInt(process.env.C6_SCHEDULER_INTERVAL_MS, DEFAULT_INTERVAL_MS),
  reporterCheckMs: parsePositiveInt(process.env.C6_REPORTER_CHECK_MS, DEFAULT_REPORTER_CHECK_MS),
  heartbeatMs: parsePositiveInt(process.env.C6_HEARTBEAT_MS, DEFAULT_HEARTBEAT_MS),
  tickCount: 0,
  claimedCount: 0,
  skippedCount: 0,
  lastSkippedCount: 0,
};

let schedulerTimer: NodeJS.Timeout | null = null;
let reporterTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let tickInProgress = false;
let reporterInProgress = false;
let heartbeatInProgress = false;
const stuckAlertLastSentAt = new Map<string, number>();

export function startC6SchedulerLoop(): SchedulerLoopState {
  if (!state.enabled) {
    console.log("[Colony:C6] Scheduler loop disabled via C6_SCHEDULER_ENABLED=false.");
    return getSchedulerLoopStatus();
  }

  if (state.running) return getSchedulerLoopStatus();

  state.running = true;
  schedulerTimer = setInterval(() => {
    void runSchedulerTick().catch((err) => recordError("scheduler_tick", err));
  }, state.intervalMs);

  reporterTimer = setInterval(() => {
    void runReporterSweep().catch((err) => recordError("reporter_sweep", err));
  }, state.reporterCheckMs);

  heartbeatTimer = setInterval(() => {
    void runHeartbeat().catch((err) => recordError("heartbeat", err));
  }, state.heartbeatMs);

  // Run reporter sweep on bootstrap
  void runReporterSweep().catch((err) => recordError("reporter_bootstrap", err));
  // Run first heartbeat after 1 minute (let system warm up)
  setTimeout(() => {
    void runHeartbeat().catch((err) => recordError("heartbeat_bootstrap", err));
  }, 60_000);

  console.log(`[Colony:C6] Scheduler loop started interval=${state.intervalMs}ms reporterCheck=${state.reporterCheckMs}ms heartbeat=${state.heartbeatMs}ms.`);
  return getSchedulerLoopStatus();
}

export function stopC6SchedulerLoop(): SchedulerLoopState {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (reporterTimer) clearInterval(reporterTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  schedulerTimer = null;
  reporterTimer = null;
  heartbeatTimer = null;
  state.running = false;
  return getSchedulerLoopStatus();
}

export function getSchedulerLoopStatus(): SchedulerLoopState {
  return { ...state };
}

export async function runSchedulerTick(workerId = DEFAULT_WORKER_ID): Promise<SchedulerTickResult> {
  if (tickInProgress) {
    return { claimed: 0, skipped: 0, claimedTaskIds: [] };
  }

  tickInProgress = true;
  const claimedTaskIds: string[] = [];
  let skipped = 0;

  try {
    // Defense-in-depth: wrap inner logic in a timeout to prevent permanent lock
    // if a Redis/Qdrant call hangs indefinitely.
    return await runTickInner(workerId, claimedTaskIds, skipped);
  } finally {
    tickInProgress = false;
  }
}

async function runTickInner(
  workerId: string,
  claimedTaskIds: string[],
  skipped: number,
): Promise<SchedulerTickResult> {
  // Defense-in-depth: store timeout reference so we can clear it when the race settles.
  // Without cleanup, the timeout fires after tickPromise wins the race, creating an
  // unhandled promise rejection (Node.js v15+ may crash on unhandledRejection).
  let tickTimeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<SchedulerTickResult>((_, reject) => {
    tickTimeout = setTimeout(() => reject(new Error(`[C6] Scheduler tick timed out after ${TICK_TIMEOUT_MS}ms`)), TICK_TIMEOUT_MS);
  });

  const tickPromise = (async (): Promise<SchedulerTickResult> => {
    const room = await getHqRoom();
    let intakeError: string | undefined;
    try {
      const taskId = await createNextOptedBacklogTask();
      if (taskId) console.log(`[Colony:C6] Created opted-in backlog task ${taskId}.`);
    } catch (err) {
      intakeError = err instanceof Error ? err.message : String(err);
      console.error("[Colony:C6] Backlog intake failed:", err);
    }

    for (const role of SCHEDULER_ROLES) {
      const result = await schedulerQueue.claimNextEligibleTask(role, `${workerId}:${role}`);
      skipped += result.skipped.length;

      if (!result.claim) continue;

      claimedTaskIds.push(result.claim.task.taskId);
      await agentSimulator.dispatchClaimedTask(result.claim.task, room.roomId, "C6 Scheduler");
      await schedulerQueue.releaseSchedulerClaim(result.claim);
    }

    state.tickCount += 1;
    state.claimedCount += claimedTaskIds.length;
    state.skippedCount += skipped;
    state.lastSkippedCount = skipped;
    state.lastTickAt = new Date().toISOString();
    state.lastClaimedTaskId = claimedTaskIds.at(-1) ?? state.lastClaimedTaskId;
    state.lastError = intakeError ? `backlog_intake: ${intakeError}` : undefined;

    // Stuck-task detection: flag tasks stuck in running/planning > threshold.
    // Send one digest message per tick to keep Colony HQ readable when old queues are noisy.
    const stuckTasks = await detectStuckTasks();
    const alertableStuckTasks = stuckTasks
      .filter((stuck) => shouldSendStuckAlert(stuck.taskId))
      .sort((a, b) => b.minutes - a.minutes);

    if (alertableStuckTasks.length > 0) {
      await applySafeAutoEscalations(alertableStuckTasks, workerId);

      await chatEngine.sendMessage({
        roomId: room.roomId,
        senderId: "system",
        senderRole: "founder",
        senderName: "C6 Scheduler",
        content: formatStuckTaskDigest(alertableStuckTasks),
        messageType: "system",
        linkedTaskId: alertableStuckTasks[0]?.taskId,
      });

      for (const stuck of alertableStuckTasks) {
        await auditEngine.emitAudit({
          actor: workerId, actorRole: "reporter", action: "scheduler.tick",
          resource: `task:${stuck.taskId}`,
          detail: {
            event: "stuck_detected",
            status: stuck.status,
            minutes: stuck.minutes,
            autoBlocked: stuck.autoBlocked === true,
            deferredReason: stuck.autoBlockDeferredReason,
          },
        });
      }

      await auditEngine.emitAudit({
        actor: workerId,
        actorRole: "reporter",
        action: "scheduler.tick",
        resource: "scheduler:c6",
        detail: {
          event: "stuck_digest",
          count: alertableStuckTasks.length,
          taskIds: alertableStuckTasks.map((task) => task.taskId).slice(0, STUCK_ALERT_DIGEST_LIMIT),
        },
      });
    }

    if (claimedTaskIds.length > 0 || skipped > 0) {
      await auditEngine.emitAudit({
        actor: workerId,
        actorRole: "reporter",
        action: "scheduler.tick",
        resource: "scheduler:c6",
        detail: { claimedTaskIds, skipped },
      });
    }

    return { claimed: claimedTaskIds.length, skipped, claimedTaskIds };
  })();

  try {
    return await Promise.race([tickPromise, timeoutPromise]);
  } finally {
    // Clear the timeout to prevent unhandled rejection when tickPromise wins the race.
    if (tickTimeout) clearTimeout(tickTimeout);
  }
}

export async function runReporterSweep(force = false): Promise<reporterEngine.ReporterRunResult[]> {
  if (reporterInProgress) return [];

  reporterInProgress = true;
  try {
    const results = await Promise.all([
      reporterEngine.runReporter("daily", force),
      reporterEngine.runReporter("weekly", force),
    ]);
    state.lastReporterCheckAt = new Date().toISOString();
    state.lastError = undefined;
    return results;
  } catch (err) {
    recordError("reporter_sweep", err);
    throw err;
  } finally {
    reporterInProgress = false;
  }
}

/**
 * Run heartbeat — dispatch a short status ping to WhatsApp group.
 * Runs every 2 hours (configurable via C6_HEARTBEAT_MS).
 */
export async function runHeartbeat(force = false): Promise<reporterEngine.ReporterRunResult> {
  if (heartbeatInProgress) return { cadence: "heartbeat", posted: false, reason: "already_in_progress" };

  heartbeatInProgress = true;
  try {
    const result = await reporterEngine.runReporter("heartbeat", force);
    state.lastHeartbeatAt = new Date().toISOString();
    state.lastError = undefined;
    if (result.posted) {
      console.log(`[Colony:C6] Heartbeat dispatched to WhatsApp.`);
    }
    return result;
  } catch (err) {
    recordError("heartbeat", err);
    throw err;
  } finally {
    heartbeatInProgress = false;
  }
}

async function getHqRoom() {
  const rooms = await chatEngine.seedDefaultRooms();
  const hq = rooms.find((room) => room.name === "Colony HQ") ?? rooms[0];
  if (!hq) throw new Error("[C6] No Colony HQ room found after seeding.");
  return hq;
}

async function detectStuckTasks(): Promise<StuckTaskInfo[]> {
  const stuck: StuckTaskInfo[] = [];
  const now = Date.now();
  for (const status of STUCK_STATUSES) {
    const { tasks } = await taskEngine.listTasks({ status, limit: STUCK_SCAN_LIMIT });
    for (const task of tasks) {
      const age = now - new Date(task.lastUpdate).getTime();
      if (age > STUCK_THRESHOLD_MS) {
        stuck.push({ task, taskId: task.taskId, status, minutes: Math.round(age / 60000) });
      }
    }
  }
  return stuck;
}

async function applySafeAutoEscalations(stuckTasks: StuckTaskInfo[], workerId: string): Promise<void> {
  if (!STUCK_AUTO_BLOCK_ENABLED) {
    for (const stuck of stuckTasks) stuck.autoBlockDeferredReason = "auto_block_disabled";
    return;
  }

  let autoBlockedCount = 0;
  for (const stuck of stuckTasks) {
    const decision = assessStuckAutoBlock(stuck);
    if (!decision.allowed) {
      stuck.autoBlockDeferredReason = decision.reason;
      continue;
    }

    if (autoBlockedCount >= STUCK_AUTO_BLOCK_MAX_PER_TICK) {
      stuck.autoBlockDeferredReason = "auto_block_tick_limit";
      continue;
    }

    const blockedReason = `C6 auto-escalation: task stuck in ${stuck.status} for ${stuck.minutes} minutes.`;
    await taskEngine.updateTaskStatus(
      stuck.taskId,
      "blocked",
      workerId,
      "Auto-blocked oleh C6 stuck-task policy.",
      blockedReason,
    );
    stuck.autoBlocked = true;
    autoBlockedCount += 1;

    await auditEngine.emitAudit({
      actor: workerId,
      actorRole: "reporter",
      action: "scheduler.tick",
      resource: `task:${stuck.taskId}`,
      detail: {
        event: "stuck_auto_blocked",
        previousStatus: stuck.status,
        minutes: stuck.minutes,
        blockedReason,
      },
    });
  }
}

function assessStuckAutoBlock(stuck: StuckTaskInfo): { allowed: true } | { allowed: false; reason: string } {
  if (stuck.minutes < STUCK_AUTO_BLOCK_MINUTES) {
    return { allowed: false, reason: "below_auto_block_threshold" };
  }

  if (stuck.task.founderApprovalRequired) {
    return { allowed: false, reason: "founder_approval_required" };
  }

  if (stuck.task.priority !== "low") {
    return { allowed: false, reason: `priority:${stuck.task.priority}` };
  }

  if (!AUTONOMOUS_ROLES.includes(stuck.task.assignedAgent)) {
    return { allowed: false, reason: `agent:${stuck.task.assignedAgent}` };
  }

  const policy = assessTaskAutonomyPolicy(stuck.task);
  if (policy.executionMode !== "autonomous_allowed") {
    return { allowed: false, reason: policy.reasons[0] ?? "policy_founder_gate" };
  }

  return { allowed: true };
}

function shouldSendStuckAlert(taskId: string): boolean {
  const now = Date.now();
  const lastSentAt = stuckAlertLastSentAt.get(taskId) ?? 0;
  if (now - lastSentAt < STUCK_ALERT_COOLDOWN_MS) return false;
  stuckAlertLastSentAt.set(taskId, now);
  // Evict stale entries older than 2x cooldown to prevent unbounded map growth.
  const evictionThreshold = now - STUCK_ALERT_COOLDOWN_MS * 2;
  for (const [key, ts] of stuckAlertLastSentAt) {
    if (ts < evictionThreshold) stuckAlertLastSentAt.delete(key);
  }
  return true;
}

function formatStuckTaskDigest(stuckTasks: StuckTaskInfo[]): string {
  const visible = stuckTasks.slice(0, STUCK_ALERT_DIGEST_LIMIT);
  const hiddenCount = Math.max(0, stuckTasks.length - visible.length);
  const autoBlockedCount = stuckTasks.filter((task) => task.autoBlocked).length;
  const lines = [
    `\u26a0\ufe0f C6 stuck-task digest: ${stuckTasks.length} task perlu review (threshold: ${STUCK_THRESHOLD_MS / 60000}m).`,
    ...visible.map((task) => {
      const action = task.autoBlocked
        ? "auto-blocked"
        : `review-only (${task.autoBlockDeferredReason ?? "policy_hold"})`;
      return `- ${task.taskId} | ${task.status} | ${task.minutes}m | ${action}`;
    }),
  ];

  if (hiddenCount > 0) {
    lines.push(`- +${hiddenCount} task lain tidak ditampilkan di digest ini.`);
  }

  if (autoBlockedCount > 0) {
    lines.push(`Auto-blocked low-risk: ${autoBlockedCount}. Founder-gated/high-risk tetap review-only.`);
  } else {
    lines.push("Detection only: tidak ada task yang memenuhi policy auto-block aman.");
  }
  return lines.join("\n");
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function recordError(scope: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  state.lastError = `${scope}: ${message}`;
  console.error(`[Colony:C6] ${scope} failed:`, err);
}
