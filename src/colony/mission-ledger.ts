/**
 * Durable Colony Mission Ledger (opt-in; Node >=22 with node:sqlite).
 *
 * - SQLite is the durable source of truth for missions, tasks and task events.
 * - Redis remains the scheduler's projection, not a second authority.
 * - Database writes are synchronous transactions, with version checks for tasks.
 * - No automatic retry of external side effects after a crash.
 * - Enable with JAGAT_MISSION_LEDGER_ENABLED=true after taking a Redis backup.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getRedisClient } from "../services/redis.service.js";
import {
  type Mission,
  type ColonyTask,
  type TaskTransitionLog,
  TASK_STATUSES,
  REDIS_KEYS,
} from "./types.js";

export const ledgerEnabled = (): boolean => process.env.JAGAT_MISSION_LEDGER_ENABLED === "true";

let db: DatabaseSync | undefined;

function getDatabase(): DatabaseSync {
  if (!ledgerEnabled()) throw new Error("Mission ledger is disabled");
  if (db) return db;
  const filename = path.resolve(process.env.JAGAT_MISSION_LEDGER_PATH || "data/jagat-mission-ledger.sqlite");
  mkdirSync(path.dirname(filename), { recursive: true });
  const next = new DatabaseSync(filename, { timeout: 5000 });
  next.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS missions (
      mission_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      mission_id TEXT,
      status TEXT NOT NULL,
      record_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE TABLE IF NOT EXISTS task_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(task_id),
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, event_id);
  `);
  db = next;
  return next;
}

interface RecordRow { record_json: string; version?: number }

export function saveMission(mission: Mission): void {
  if (!ledgerEnabled()) return;
  const d = getDatabase();
  d.prepare(`INSERT INTO missions(mission_id,record_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(mission_id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
    .run(mission.id, JSON.stringify(mission), mission.updatedAt);
}

export function loadMission(id: string): Mission | null {
  if (!ledgerEnabled()) return null;
  const row = getDatabase().prepare("SELECT record_json FROM missions WHERE mission_id = ?").get(id) as RecordRow | undefined;
  return row ? JSON.parse(row.record_json) as Mission : null;
}

export function importMission(mission: Mission): void {
  if (!ledgerEnabled()) return;
  getDatabase().prepare("INSERT OR IGNORE INTO missions(mission_id,record_json,updated_at) VALUES(?,?,?)")
    .run(mission.id, JSON.stringify(mission), mission.updatedAt);
}

export function saveNewTask(task: ColonyTask, actor: string): ColonyTask {
  if (!ledgerEnabled()) return task;
  const d = getDatabase();
  const record = { ...task, ledgerVersion: 1 };
  d.exec("BEGIN IMMEDIATE");
  try {
    d.prepare("INSERT INTO tasks(task_id,mission_id,status,record_json,version,updated_at) VALUES(?,?,?,?,?,?)")
      .run(task.taskId, task.missionId ?? null, task.status, JSON.stringify(record), 1, task.lastUpdate);
    d.prepare("INSERT INTO task_events(task_id,event_type,from_status,to_status,actor,reason,timestamp) VALUES(?,?,?,?,?,?,?)")
      .run(task.taskId, "created", null, task.status, actor, "Task created", task.lastUpdate);
    d.exec("COMMIT");
  } catch (e) { d.exec("ROLLBACK"); throw e; }
  return record;
}

export function importTask(task: ColonyTask, history: TaskTransitionLog[] = []): void {
  if (!ledgerEnabled()) return;
  const d = getDatabase();
  d.exec("BEGIN IMMEDIATE");
  try {
    const record = { ...task, ledgerVersion: 1 };
    const change = d.prepare("INSERT OR IGNORE INTO tasks(task_id,mission_id,status,record_json,version,updated_at) VALUES(?,?,?,?,?,?)")
      .run(task.taskId, task.missionId ?? null, task.status, JSON.stringify(record), 1, task.lastUpdate);
    if (change.changes > 0) {
      const recordEvent = d.prepare("INSERT INTO task_events(task_id,event_type,from_status,to_status,actor,reason,timestamp) VALUES(?,?,?,?,?,?,?)");
      // Preserve prior Redis transition history when migrating.
      for (const old of history) {
        recordEvent.run(task.taskId, "status", old.fromStatus, old.toStatus, old.actor, old.reason, old.timestamp);
      }
      recordEvent.run(task.taskId, "imported", null, task.status, "ledger-migration", "Imported existing Redis task", new Date().toISOString());
    }
    d.exec("COMMIT");
  } catch (e) { d.exec("ROLLBACK"); throw e; }
}

export function loadTask(taskId: string): ColonyTask | null {
  if (!ledgerEnabled()) return null;
  const row = getDatabase().prepare("SELECT record_json,version FROM tasks WHERE task_id=?").get(taskId) as RecordRow | undefined;
  if (!row) return null;
  return { ...(JSON.parse(row.record_json) as ColonyTask), ledgerVersion: row.version };
}

/** Commit new snapshot and corresponding event atomically using optimistic versioning. */
export function saveTaskUpdate(
  task: ColonyTask,
  prior: ColonyTask,
  event: { type: string; actor: string; reason: string },
): ColonyTask {
  if (!ledgerEnabled()) return task;
  const d = getDatabase();
  // Older Redis tasks are imported lazily, with a retained audit marker.
  if (prior.ledgerVersion === undefined) importTask(prior);
  const version = prior.ledgerVersion ?? 1;
  const updated: ColonyTask = { ...task, ledgerVersion: version + 1 };
  d.exec("BEGIN IMMEDIATE");
  try {
    const change = d.prepare(`UPDATE tasks SET record_json=?, mission_id=?, status=?, version=?, updated_at=?
      WHERE task_id=? AND version=? AND status=?`)
      .run(JSON.stringify(updated), updated.missionId ?? null, updated.status, version + 1,
        updated.lastUpdate, task.taskId, version, prior.status);
    if (change.changes !== 1) throw new Error(`Concurrent task modification: ${task.taskId}. Reload before retry.`);
    d.prepare("INSERT INTO task_events(task_id,event_type,from_status,to_status,actor,reason,timestamp) VALUES(?,?,?,?,?,?,?)")
      .run(task.taskId, event.type, prior.status, task.status, event.actor, event.reason, updated.lastUpdate);
    d.exec("COMMIT");
  } catch (e) { d.exec("ROLLBACK"); throw e; }
  return updated;
}

export function loadTaskTransitions(taskId: string): TaskTransitionLog[] {
  if (!ledgerEnabled()) return [];
  const rows = getDatabase().prepare(`SELECT task_id,from_status,to_status,actor,reason,timestamp
    FROM task_events WHERE task_id=? AND event_type IN ('created','imported','status') ORDER BY event_id ASC`)
    .all(taskId) as Array<{ task_id: string; from_status: string | null; to_status: string; actor: string; reason: string; timestamp: string }>;
  return rows.map((r) => ({ taskId: r.task_id, fromStatus: (r.from_status ?? r.to_status) as TaskTransitionLog["fromStatus"], toStatus: r.to_status as TaskTransitionLog["toStatus"], actor: r.actor, reason: r.reason, timestamp: r.timestamp }));
}

export function getLedgerCounts(): { missions: number; tasks: number; events: number } | null {
  if (!ledgerEnabled()) return null;
  const d = getDatabase();
  const count = (table: string) => Number((d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
  return { missions: count("missions"), tasks: count("tasks"), events: count("task_events") };
}

/**
 * Called before starting the HTTP server and scheduler. Existing Redis records
 * absent from the ledger are imported, then every ledger record is projected
 * back to Redis. This is intentionally fail-closed: no scheduler if it fails.
 */
export async function reconcileLedgerAndRedis(): Promise<{ missions: number; tasks: number }> {
  if (!ledgerEnabled()) return { missions: 0, tasks: 0 };
  const d = getDatabase();
  const redis = getRedisClient();
  // Migration imports: only objects that are NOT yet in the authoritative ledger.
  for (const id of await redis.smembers(REDIS_KEYS.missionIndex())) {
    const raw = await redis.get(REDIS_KEYS.mission(id));
    if (raw && !loadMission(id)) importMission(JSON.parse(raw) as Mission);
  }
  for (const id of await redis.zrange(REDIS_KEYS.taskIndex(), 0, -1)) {
    const raw = await redis.get(REDIS_KEYS.task(id));
    if (raw && !loadTask(id)) {
      const history = (await redis.lrange(REDIS_KEYS.taskTransitionLog(id), 0, -1))
        .flatMap((line): TaskTransitionLog[] => {
          try { return [JSON.parse(line) as TaskTransitionLog]; } catch { return []; }
        });
      importTask(JSON.parse(raw) as ColonyTask, history);
    }
  }
  // Repair Redis counters after a cold rebuild, avoiding duplicate IDs.
  const seqMax = (records: Array<{ id: string }>) => records.reduce((n, r) => {
    const match = r.id.match(/-(\d+)$/);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  const storedMissionIds = (d.prepare("SELECT mission_id AS id FROM missions").all() as Array<{ id: string }>);
  const storedTaskIds = (d.prepare("SELECT task_id AS id FROM tasks").all() as Array<{ id: string }>);
  for (const [key, max] of [
    [REDIS_KEYS.missionSequence(), seqMax(storedMissionIds)],
    [REDIS_KEYS.taskSequence(), seqMax(storedTaskIds)],
  ] as Array<[string, number]>) {
    const current = Number(await redis.get(key) ?? 0);
    if (max > current) await redis.set(key, String(max));
  }
  let missions = 0;
  for (const row of d.prepare("SELECT mission_id, record_json FROM missions").all() as Array<{ mission_id: string; record_json: string }>) {
    await redis.set(REDIS_KEYS.mission(row.mission_id), row.record_json);
    await redis.sadd(REDIS_KEYS.missionIndex(), row.mission_id);
    missions++;
  }
  let tasks = 0;
  const priorities: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  for (const row of d.prepare("SELECT task_id,record_json,status FROM tasks").all() as Array<{ task_id: string; record_json: string; status: string }>) {
    const t = JSON.parse(row.record_json) as ColonyTask;
    // Clear stale indices for each ledger task; preserves unrelated Redis-only tasks.
    const pipeline = redis.multi();
    pipeline.set(REDIS_KEYS.task(t.taskId), row.record_json);
    pipeline.zadd(REDIS_KEYS.taskIndex(), priorities[t.priority] ?? 3, t.taskId);
    pipeline.sadd(REDIS_KEYS.tasksByAgent(t.assignedAgent), t.taskId);
    for (const state of TASK_STATUSES) pipeline.srem(REDIS_KEYS.tasksByStatus(state), t.taskId);
    pipeline.sadd(REDIS_KEYS.tasksByStatus(t.status), t.taskId);
    await pipeline.exec();
    tasks++;
  }
  return { missions, tasks };
}

export function closeMissionLedger(): void {
  if (db) { db.close(); db = undefined; }
}
