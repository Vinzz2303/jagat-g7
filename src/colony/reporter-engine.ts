// ============================================================================
// JAGAT Colony — Reporter Engine
// Generates daily/weekly operational summaries and posts them to Colony HQ.
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import * as taskEngine from "./task-engine.js";
import * as approvalEngine from "./approval-engine.js";
import * as agentRegistry from "./agent-registry.js";
import * as chatEngine from "./chat-engine.js";
import * as auditEngine from "./audit-engine.js";
import * as notificationDispatcher from "./notification-dispatcher.js";

export type ReporterCadence = "daily" | "weekly" | "heartbeat";

export interface ReporterRunResult {
  cadence: ReporterCadence;
  posted: boolean;
  roomId?: string;
  reason?: string;
  summary?: string;
}

export async function runReporter(cadence: ReporterCadence, force = false): Promise<ReporterRunResult> {
  const redis = getRedisClient();
  const periodKey = getPeriodKey(cadence);
  const lockKey = `colony:reporter:${cadence}:${periodKey}`;

  let lockAlreadyHeld = false;
  if (!force) {
    const claimed = await redis.set(lockKey, new Date().toISOString(), "EX", getTtlSeconds(cadence), "NX");
    if (claimed !== "OK") {
      return { cadence, posted: false, reason: "already_posted_for_period" };
    }
  } else {
    lockAlreadyHeld = (await redis.get(lockKey)) !== null;
  }

  const room = await getHqRoom();

  try {
    const summary = await buildReporterSummary(cadence);

    await chatEngine.sendMessage({
      roomId: room.roomId,
      senderId: "reporter",
      senderRole: "reporter",
      senderName: cadence === "daily" ? "Daily Reporter" : cadence === "weekly" ? "Weekly Reporter" : "Heartbeat",
      content: summary,
      messageType: "agent_update",
    });

    // Always set lock after successful post to prevent double-posting.
    // force=true bypasses the NX check but still marks the period as posted,
    // so a subsequent non-forced call within the same period is blocked.
    if (!lockAlreadyHeld) {
      await redis.set(lockKey, new Date().toISOString(), "EX", getTtlSeconds(cadence));
    }

    await auditEngine.emitAudit({
      actor: "Colony Reporter",
      actorRole: "reporter",
      action: "reporter.summary",
      resource: `report:${cadence}:${periodKey}`,
      detail: { cadence, periodKey, roomId: room.roomId },
    });

    // Dispatch to WhatsApp group (best-effort, non-blocking)
    notificationDispatcher.dispatchReporterSummary(summary, cadence).catch((err) => {
      console.error(`[Reporter] Failed to dispatch ${cadence} summary to WhatsApp:`, err);
    });

    return { cadence, posted: true, roomId: room.roomId, summary };
  } catch (err: any) {
    // Release lock on failure so the period is not consumed without a post.
    // Release if we acquired it (non-force via NX, or force without pre-existing lock).
    if (!lockAlreadyHeld) {
      await redis.del(lockKey).catch(() => {});
    }
    console.error(`[Reporter] Failed to build/post ${cadence} summary:`, err?.message ?? err);
    return { cadence, posted: false, reason: `error: ${err?.message ?? "unknown"}` };
  }
}

export async function buildReporterSummary(cadence: ReporterCadence): Promise<string> {
  // Heartbeat uses a shorter, punchier format
  if (cadence === "heartbeat") return buildHeartbeatSummary();

  const [stats, blockedTasks, pendingApprovals, roster] = await Promise.all([
    taskEngine.getColonyStats(),
    taskEngine.getBlockedTasks(),
    approvalEngine.listPendingApprovals(),
    agentRegistry.getColonyRoster(),
  ]);

  const title = cadence === "daily" ? "Daily Colony Brief" : "Weekly Colony Readout";
  const now = new Date().toISOString();

  const lines = [
    `## ${title}`,
    ``,
    `Timestamp: ${now}`,
    ``,
    `### Queue`,
    `- Total: ${stats.totalTasks}`,
    `- Queued: ${stats.queued} | Planning: ${stats.planning} | Approved: ${stats.approved}`,
    `- Running: ${stats.running} | Review: ${stats.review} | Done: ${stats.done}`,
    `- Blocked: ${stats.blocked} | Archived: ${stats.archived}`,
    ``,
    `### Controls`,
    `- Pending approvals: ${pendingApprovals.length}`,
    `- Blocked tasks: ${blockedTasks.length}`,
    `- Agents online/working: ${(roster.byStatus.working ?? 0)} working, ${(roster.byStatus.idle ?? 0)} idle`,
  ];

  if (blockedTasks.length > 0) {
    lines.push(``, `### Blockers`);
    for (const task of blockedTasks.slice(0, 5)) {
      lines.push(`- ${task.taskId}: ${task.title}${task.blockedReason ? ` — ${task.blockedReason}` : ""}`);
    }
  }

  if (pendingApprovals.length > 0) {
    lines.push(``, `### Approval Inbox`);
    for (const approval of pendingApprovals.slice(0, 5)) {
      lines.push(`- ${approval.approvalId}: ${approval.type} for ${approval.taskId}`);
    }
  }

  lines.push(
    ``,
    `### Next Action`,
    pendingApprovals.length > 0
      ? `Founder review approval inbox first.`
      : blockedTasks.length > 0
        ? `Resolve blocked tasks before expanding queue.`
        : `Queue is stable; continue eligible low-risk autonomous work.`,
  );

  return lines.join("\n");
}

async function getHqRoom() {
  const rooms = await chatEngine.seedDefaultRooms();
  const hq = rooms.find((room) => room.name === "Colony HQ") ?? rooms[0];
  if (!hq) throw new Error("[Reporter] No Colony HQ room found after seeding.");
  return hq;
}

function getPeriodKey(cadence: ReporterCadence): string {
  const now = new Date();
  if (cadence === "daily") return now.toISOString().slice(0, 10);
  if (cadence === "heartbeat") {
    // 2-hour bucket: 2026-06-08-H06, H08, H10...
    const hourBucket = Math.floor(now.getUTCHours() / 2) * 2;
    return `${now.toISOString().slice(0, 10)}-H${String(hourBucket).padStart(2, "0")}`;
  }
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - firstDay.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getTtlSeconds(cadence: ReporterCadence): number {
  if (cadence === "heartbeat") return 2 * 60 * 60 + 300; // 2h + 5min buffer
  return cadence === "daily" ? 36 * 60 * 60 : 10 * 24 * 60 * 60;
}

// ── Heartbeat Summary ─────────────────────────────────────────────────────────

async function buildHeartbeatSummary(): Promise<string> {
  const [stats, blockedTasks, pendingApprovals, roster] = await Promise.all([
    taskEngine.getColonyStats(),
    taskEngine.getBlockedTasks(),
    approvalEngine.listPendingApprovals(),
    agentRegistry.getColonyRoster(),
  ]);

  const now = new Date();
  const timeStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

  const lines: string[] = [
    `💓 *JAGAT Heartbeat* — ${timeStr} WIB`,
    ``,
    `📋 Queue: ${stats.totalTasks} total | ✅ ${stats.done} done | 🔄 ${stats.running} running | ⏳ ${stats.queued} queued`,
  ];

  if (stats.blocked > 0) lines.push(`🚫 Blocked: ${stats.blocked}`);
  if (pendingApprovals.length > 0) lines.push(`⚠️ Pending approvals: ${pendingApprovals.length}`);
  if (blockedTasks.length > 0) {
    lines.push(``, `*Blockers:*`);
    for (const task of blockedTasks.slice(0, 3)) {
      lines.push(`• ${task.taskId}: ${task.title}`);
    }
  }

  const workingAgents = roster.byStatus.working ?? 0;
  const idleAgents = roster.byStatus.idle ?? 0;
  lines.push(``, `🤖 Agents: ${workingAgents} working, ${idleAgents} idle`);

  if (pendingApprovals.length === 0 && blockedTasks.length === 0 && stats.blocked === 0) {
    lines.push(``, `✅ All clear — Colony running smooth.`);
  }

  return lines.join("\n");
}
