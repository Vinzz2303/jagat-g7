// ============================================================================
// JAGAT Colony — Scheduler Queue Guard
// Claims only safe/eligible queued tasks for autonomous execution.
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import { assessTaskAutonomyPolicy, type TaskAutonomyPolicy } from "./autonomous-policy.js";
import { taskEngine, auditEngine } from "./index.js";
import { DEFAULT_PERMISSIONS, type AgentRole, type ColonyTask } from "./types.js";

const SCHEDULER_CLAIM_TTL_SECONDS = 5 * 60;

export interface SchedulerClaim {
  task: ColonyTask;
  lockKey: string;
  lockValue: string;
  policy: TaskAutonomyPolicy;
}

export interface SchedulerSkip {
  taskId: string;
  reason: string;
  policy?: TaskAutonomyPolicy;
}

export interface SchedulerClaimResult {
  claim: SchedulerClaim | null;
  skipped: SchedulerSkip[];
}

export async function claimNextEligibleTask(
  agentRole: AgentRole,
  workerId: string,
): Promise<SchedulerClaimResult> {
  const redis = getRedisClient();
  const skipped: SchedulerSkip[] = [];
  const { tasks } = await taskEngine.listTasks({ status: "queued", agent: agentRole, limit: 100 });

  for (const candidate of tasks) {
    const current = await taskEngine.getTask(candidate.taskId);
    if (!current || current.status !== "queued") {
      skipped.push({ taskId: candidate.taskId, reason: "not_queued" });
      continue;
    }

    const policy = assessTaskAutonomyPolicy(current);
    if (current.founderApprovalRequired || policy.founderApprovalRequired) {
      skipped.push({ taskId: current.taskId, reason: "founder_approval_required", policy });
      continue;
    }

    // GAP 9: Validate agent has compatible permissions for the task.
    // Defense-in-depth: verify permissions object exists (agent-registry also validates on registerAgent).
    const agentPerms = DEFAULT_PERMISSIONS[agentRole];
    if (!agentPerms) {
      skipped.push({ taskId: current.taskId, reason: `unknown_agent_role:${agentRole}` });
      continue;
    }
    // If task appears code-related, agent must have at least one of canWriteCode or canRunBuild.
    const taskText = `${current.title} ${(current.tags ?? []).join(" ")}`.toLowerCase();
    if (/code|build|patch|implement|refactor/.test(taskText) && !agentPerms.canWriteCode && !agentPerms.canRunBuild) {
      skipped.push({ taskId: current.taskId, reason: "agent_permission_mismatch:needs_code_permission", policy });
      continue;
    }

    const dependencyCheck = await dependenciesComplete(current);
    if (!dependencyCheck.ok) {
      skipped.push({ taskId: current.taskId, reason: dependencyCheck.reason });
      continue;
    }

    const lockKey = schedulerLockKey(current.taskId);
    const lockValue = `${workerId}:${Date.now()}`;
    const acquired = await redis.set(lockKey, lockValue, "EX", SCHEDULER_CLAIM_TTL_SECONDS, "NX");
    if (acquired !== "OK") {
      skipped.push({ taskId: current.taskId, reason: "already_claimed" });
      continue;
    }

    const latest = await taskEngine.getTask(current.taskId);
    if (!latest || latest.status !== "queued") {
      await releaseSchedulerClaim({ task: current, lockKey, lockValue, policy });
      skipped.push({ taskId: current.taskId, reason: "status_changed_after_lock" });
      continue;
    }

    const claimedTask = await taskEngine.updateTaskStatus(
      latest.taskId,
      "planning",
      workerId,
      "Scheduler claimed eligible autonomous task",
    );

    await auditEngine.emitAudit({
      actor: workerId,
      actorRole: agentRole,
      action: "scheduler.claim",
      resource: `task:${claimedTask.taskId}`,
      detail: {
        assignedAgent: agentRole,
        policy,
      },
    });

    return { claim: { task: claimedTask, lockKey, lockValue, policy }, skipped };
  }

  return { claim: null, skipped };
}

export async function releaseSchedulerClaim(claim: SchedulerClaim): Promise<void> {
  const redis = getRedisClient();
  const currentValue = await redis.get(claim.lockKey);
  if (currentValue === claim.lockValue) {
    await redis.del(claim.lockKey);
  }
}

function schedulerLockKey(taskId: string): string {
  return `colony:scheduler:claim:${taskId}`;
}

async function dependenciesComplete(task: ColonyTask): Promise<{ ok: true } | { ok: false; reason: string }> {
  for (const dependencyId of task.dependencies) {
    const dependency = await taskEngine.getTask(dependencyId);
    if (!dependency) {
      return { ok: false, reason: `dependency_missing:${dependencyId}` };
    }
    if (dependency.status !== "done" && dependency.status !== "archived") {
      return { ok: false, reason: `dependency_not_complete:${dependencyId}` };
    }
  }
  return { ok: true };
}
