// ============================================================================
// JAGAT Colony — Task Engine
// State management untuk colony tasks menggunakan Redis
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import * as ledger from "./mission-ledger.js";
import { assessTaskAutonomyPolicy } from "./autonomous-policy.js";
import { evaluateTask, evaluationToEvidence } from "./evaluation-engine.js";
import {
  type ColonyTask,
  type TaskStatus,
  type TaskPriority,
  type TaskTransitionLog,
  type TaskEvidence,
  type AgentRole,
  type ColonyPhase,
  TASK_TRANSITIONS,
  TASK_PRIORITIES,
  DEFAULT_PERMISSIONS,
  REDIS_KEYS,
} from "./types.js";

// ── ID Generator ────────────────────────────────────────────────────────────

async function nextTaskId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.taskSequence());
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TASK-${date}-${String(seq).padStart(4, "0")}`;
}

// ── Task CRUD ───────────────────────────────────────────────────────────────

export async function createTask(params: {
  title: string;
  objective: string;
  phase: ColonyPhase;
  sourceOfTruth: string;
  assignedAgent: AgentRole;
  priority: TaskPriority;
  acceptanceCriteria: string[];
  dependencies?: string[];
  founderApprovalRequired?: boolean;
  missionId?: string;
  description?: string;
  tags?: string[];
  estimatedMinutes?: number;
  createdBy: string;
}): Promise<ColonyTask> {
  const redis = getRedisClient();
  if (!TASK_PRIORITIES.includes(params.priority)) {
    throw new Error(`Invalid task priority: "${params.priority}". Allowed: ${TASK_PRIORITIES.join(", ")}`);
  }
  // GAP 9: Runtime validation — assignedAgent must be a known colony role
  if (!(params.assignedAgent in DEFAULT_PERMISSIONS)) {
    throw new Error(
      `Invalid assignedAgent: "${params.assignedAgent}". Known roles: ${Object.keys(DEFAULT_PERMISSIONS).join(", ")}`,
    );
  }
  // Defense-in-depth: warn if agent permissions don't match task characteristics
  const agentPerms = DEFAULT_PERMISSIONS[params.assignedAgent];
  const taskText = `${params.title} ${(params.tags ?? []).join(" ")}`.toLowerCase();
  if (/code|build|patch|implement|refactor/.test(taskText) && !agentPerms.canWriteCode) {
    console.warn(
      `[Colony:TaskEngine] Warning: assignedAgent "${params.assignedAgent}" lacks canWriteCode but task appears code-related: "${params.title}"`,
    );
  }
  const taskId = await nextTaskId();
  const now = new Date().toISOString();
  const autonomyPolicy = assessTaskAutonomyPolicy(params);

  let task: ColonyTask = {
    taskId,
    title: params.title,
    objective: params.objective,
    phase: params.phase,
    sourceOfTruth: params.sourceOfTruth,
    assignedAgent: params.assignedAgent,
    status: "queued",
    priority: params.priority,
    acceptanceCriteria: params.acceptanceCriteria,
    dependencies: params.dependencies ?? [],
    evidence: [],
    lastUpdate: now,
    founderApprovalRequired: (params.founderApprovalRequired ?? false) || autonomyPolicy.founderApprovalRequired,
    missionId: params.missionId,
    description: params.description,
    createdAt: now,
    createdBy: params.createdBy,
    tags: params.tags,
    estimatedMinutes: params.estimatedMinutes,
  };

  // Durable commit BEFORE the Redis scheduler projection.
  task = ledger.saveNewTask(task, params.createdBy);
  // Store task
  await redis.set(REDIS_KEYS.task(taskId), JSON.stringify(task));

  // Add to indices
  const priorityScore = priorityToScore(params.priority);
  await redis.zadd(REDIS_KEYS.taskIndex(), priorityScore, taskId);
  await redis.sadd(REDIS_KEYS.tasksByStatus("queued"), taskId);
  await redis.sadd(REDIS_KEYS.tasksByAgent(params.assignedAgent), taskId);

  // Log creation transition
  await logTransition({
    taskId,
    fromStatus: "queued",
    toStatus: "queued",
    reason: "Task created",
    actor: params.createdBy,
    timestamp: now,
  });

  return task;
}

export async function getTask(taskId: string): Promise<ColonyTask | null> {
  const saved = ledger.loadTask(taskId);
  if (saved) return saved;
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.task(taskId));
  if (!data) return null;
  try {
    const legacy = JSON.parse(data) as ColonyTask;
    if (ledger.ledgerEnabled()) {
      const history = (await redis.lrange(REDIS_KEYS.taskTransitionLog(taskId), 0, -1))
        .flatMap((line): TaskTransitionLog[] => {
          try { return [JSON.parse(line) as TaskTransitionLog]; } catch { return []; }
        });
      ledger.importTask(legacy, history);
      return ledger.loadTask(taskId);
    }
    return legacy;
  } catch {
    console.warn(`[Colony:TaskEngine] Corrupted task data for ${taskId}, skipping`);
    return null;
  }
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  actor: string,
  reason: string,
  blockedReason?: string,
): Promise<ColonyTask> {
  const redis = getRedisClient();
  const task = await getTask(taskId);

  if (!task) throw new Error(`Task ${taskId} not found`);

  // Validate transition
  const allowedTransitions = TASK_TRANSITIONS[task.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${task.status} → ${newStatus}. ` +
      `Allowed: ${allowedTransitions.join(", ")}`,
    );
  }

  // Enforce rules per masterplan
  if (newStatus === "running" && (!task.objective || task.acceptanceCriteria.length === 0)) {
    throw new Error("Task tidak boleh running tanpa deskripsi dan acceptance criteria");
  }
  if (newStatus === "blocked" && !blockedReason) {
    throw new Error("Task blocked wajib punya alasan");
  }
  if (newStatus === "done" && task.evidence.length === 0) {
    throw new Error("Task done wajib punya evidence");
  }

  const now = new Date().toISOString();
  const oldStatus = task.status;
  const prior = { ...task };

  // Update task
  task.status = newStatus;
  task.lastUpdate = now;
  if (blockedReason) task.blockedReason = blockedReason;
  // Clear blockedReason when task leaves blocked state to avoid stale data
  if (oldStatus === "blocked" && newStatus !== "blocked") {
    task.blockedReason = undefined;
  }

  // Evaluate before committing so the event and evidence share one durable state.
  if (newStatus === "review" || newStatus === "done") {
    if (!task.evidence.some((e) => e.quality_score !== undefined)) {
      task.evidence.push(evaluationToEvidence(evaluateTask(task)));
    }
  }
  const persisted = ledger.saveTaskUpdate(task, prior, {
    type: "status", actor, reason,
  });
  await redis.set(REDIS_KEYS.task(taskId), JSON.stringify(persisted));
  // Project current status to Redis. A failed projection can be repaired at startup.
  const index = redis.multi();
  index.srem(REDIS_KEYS.tasksByStatus(oldStatus), taskId);
  index.sadd(REDIS_KEYS.tasksByStatus(newStatus), taskId);
  await index.exec();
  await logTransition({ taskId, fromStatus: oldStatus, toStatus: newStatus, reason, actor, timestamp: now });
  return persisted;
}

export async function addEvidence(
  taskId: string,
  evidence: TaskEvidence,
): Promise<ColonyTask> {
  const redis = getRedisClient();
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Only allow evidence in states where work is actively tracked
  const evidenceAllowed: TaskStatus[] = ["running", "review", "done"];
  if (!evidenceAllowed.includes(task.status)) {
    throw new Error(
      `Cannot add evidence to task in status "${task.status}". ` +
      `Allowed: ${evidenceAllowed.join(", ")}`,
    );
  }

  const prior = { ...task };
  task.evidence.push(evidence);
  task.lastUpdate = new Date().toISOString();

  const persisted = ledger.saveTaskUpdate(task, prior, { type: "evidence", actor: evidence.agentRole, reason: evidence.description });
  await redis.set(REDIS_KEYS.task(taskId), JSON.stringify(persisted));
  return persisted;
}

// ── Query Functions ─────────────────────────────────────────────────────────

export async function listTasks(options?: {
  status?: TaskStatus;
  agent?: AgentRole;
  phase?: ColonyPhase;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: ColonyTask[]; total: number }> {
  const redis = getRedisClient();
  let taskIds: string[];

  if (options?.status && options?.agent) {
    // Intersect status + agent filters when both provided
    const [statusIds, agentIds] = await Promise.all([
      redis.smembers(REDIS_KEYS.tasksByStatus(options.status)),
      redis.smembers(REDIS_KEYS.tasksByAgent(options.agent)),
    ]);
    const agentSet = new Set(agentIds);
    taskIds = statusIds.filter((id) => agentSet.has(id));
  } else if (options?.status) {
    taskIds = await redis.smembers(REDIS_KEYS.tasksByStatus(options.status));
  } else if (options?.agent) {
    taskIds = await redis.smembers(REDIS_KEYS.tasksByAgent(options.agent));
  } else {
    // Get all by priority (sorted set)
    taskIds = await redis.zrange(REDIS_KEYS.taskIndex(), 0, -1);
  }

  const total = taskIds.length;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const slicedIds = taskIds.slice(offset, offset + limit);

  const tasks: ColonyTask[] = [];
  for (const id of slicedIds) {
    const task = await getTask(id);
    if (task) {
      if (options?.phase && task.phase !== options.phase) continue;
      tasks.push(task);
    }
  }

  return { tasks, total };
}

export async function getTasksByMission(missionId: string): Promise<ColonyTask[]> {
  // High limit: mission-level operations need ALL tasks for accurate aggregation.
  // 10000 covers sustained autonomous operation without a dedicated mission→task index.
  const { tasks } = await listTasks({ limit: 10000 });
  return tasks.filter((t) => t.missionId === missionId);
}

export async function getBlockedTasks(): Promise<ColonyTask[]> {
  const { tasks } = await listTasks({ status: "blocked" });
  return tasks;
}

export async function getTaskTransitions(taskId: string): Promise<TaskTransitionLog[]> {
  if (ledger.loadTask(taskId)) return ledger.loadTaskTransitions(taskId);
  const redis = getRedisClient();
  const logs = await redis.lrange(REDIS_KEYS.taskTransitionLog(taskId), 0, -1);
  return logs.map((l) => JSON.parse(l) as TaskTransitionLog);
}

// ── Dashboard Stats ─────────────────────────────────────────────────────────

export interface ColonyStats {
  totalTasks: number;
  queued: number;
  planning: number;
  approved: number;
  running: number;
  review: number;
  blocked: number;
  done: number;
  archived: number;
}

export async function getColonyStats(): Promise<ColonyStats> {
  const redis = getRedisClient();

  const statusCounts = await Promise.all([
    redis.scard(REDIS_KEYS.tasksByStatus("queued")),
    redis.scard(REDIS_KEYS.tasksByStatus("planning")),
    redis.scard(REDIS_KEYS.tasksByStatus("approved")),
    redis.scard(REDIS_KEYS.tasksByStatus("running")),
    redis.scard(REDIS_KEYS.tasksByStatus("review")),
    redis.scard(REDIS_KEYS.tasksByStatus("blocked")),
    redis.scard(REDIS_KEYS.tasksByStatus("done")),
    redis.scard(REDIS_KEYS.tasksByStatus("archived")),
  ]);

  const total = await redis.zcard(REDIS_KEYS.taskIndex());

  return {
    totalTasks: total,
    queued: statusCounts[0],
    planning: statusCounts[1],
    approved: statusCounts[2],
    running: statusCounts[3],
    review: statusCounts[4],
    blocked: statusCounts[5],
    done: statusCounts[6],
    archived: statusCounts[7],
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function priorityToScore(priority: TaskPriority): number {
  const scores: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return scores[priority];
}

async function logTransition(log: TaskTransitionLog): Promise<void> {
  const redis = getRedisClient();
  await redis.rpush(REDIS_KEYS.taskTransitionLog(log.taskId), JSON.stringify(log));
}
