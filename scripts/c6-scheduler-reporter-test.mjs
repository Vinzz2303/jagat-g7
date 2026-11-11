#!/usr/bin/env node
/**
 * JAGAT Colony - C6 Scheduler + Reporter live test.
 *
 * Requires backend on localhost:5000 and Redis.
 */

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET || "jagat-colony-internal-2026";
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || "6379");

let passed = 0;
let failed = 0;

function headers(tier = "SOVEREIGN") {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": "Faturachman Al Kahfi",
    "X-Colony-Tier": tier,
    "X-Colony-Token": "c6-test-token",
  };
}

async function test(label, fn) {
  try {
    await fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(method, path, body, tier = "SOVEREIGN") {
  const res = await fetch(`${BACKEND}/colony${path}`, {
    method,
    headers: headers(tier),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeTaskStale(taskId, minutesAgo = 45) {
  const { Redis } = await import("ioredis");
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
  try {
    const key = `colony:task:${taskId}`;
    const raw = await redis.get(key);
    assert(raw, `missing redis task ${key}`);
    const task = JSON.parse(raw);
    task.lastUpdate = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    await redis.set(key, JSON.stringify(task));
  } finally {
    await redis.quit();
  }
}

console.log("\nJAGAT Colony - C6 Scheduler + Reporter Test\n");

let taskId;
let stuckTaskId;
let autoBlockTaskId;

await test("bootstrap colony", async () => {
  const res = await api("POST", "/bootstrap", {});
  assert(res.status === 200, `expected 200, got ${res.status}`);
});

await test("scheduler status endpoint is founder-only", async () => {
  const res = await api("GET", "/scheduler/status");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(typeof res.data.scheduler?.running === "boolean", "missing scheduler.running");
});

await test("create low-risk reporter task", async () => {
  const res = await api("POST", "/tasks", {
    title: `Ops heartbeat note ${Date.now()}`,
    objective: "Compose a short operational heartbeat for queue smoke verification.",
    phase: "C4",
    sourceOfTruth: "C4 reporter queue smoke",
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["status reaches review", "evidence is attached"],
    founderApprovalRequired: false,
    tags: ["queue-smoke", "autonomous-safe"],
  });
  assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
  assert(res.data.founderApprovalRequired === false, "task should remain autonomous-safe");
  taskId = res.data.taskId;
});

await test("manual scheduler tick claims task", async () => {
  const res = await api("POST", "/scheduler/tick", {});
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.data.result.claimedTaskIds.includes(taskId), `tick did not claim ${taskId}`);
});

await test("claimed task moves through autonomous simulation", async () => {
  await sleep(6500);
  const res = await api("GET", `/tasks/${taskId}`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(["review", "running", "approved"].includes(res.data.status), `unexpected status ${res.data.status}`);
});

await test("daily reporter can post forced summary", async () => {
  const res = await api("POST", "/reporter/run", { cadence: "daily", force: true });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.data.result?.posted === true, "reporter did not post summary");
});

await test("weekly reporter summary can be generated without posting", async () => {
  const res = await api("GET", "/reporter/summary?cadence=weekly");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(String(res.data.summary || "").includes("Weekly Colony Readout"), "missing weekly summary");
});

await test("non-sovereign cannot run scheduler", async () => {
  const res = await api("POST", "/scheduler/tick", {}, "LITE");
  assert(res.status === 403, `expected 403, got ${res.status}`);
});

await test("create running task fixture for stuck detection", async () => {
  const created = await api("POST", "/tasks", {
    title: `Stuck detection fixture ${Date.now()}`,
    objective: "Fixture for C6 stuck-task detection.",
    phase: "C6",
    sourceOfTruth: "scripts/c6-scheduler-reporter-test.mjs",
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["stuck detection emits audit"],
    founderApprovalRequired: false,
    tags: ["c6", "stuck-fixture"],
  });
  assert(created.status === 201, `expected 201, got ${created.status}`);
  stuckTaskId = created.data.taskId;

  for (const status of ["planning", "approved", "running"]) {
    const patched = await api("PATCH", `/tasks/${stuckTaskId}/status`, {
      status,
      reason: "stuck detection fixture",
    });
    assert(patched.status === 200, `expected 200 for ${status}, got ${patched.status}`);
  }
  await makeTaskStale(stuckTaskId, 45);
});

await test("manual scheduler tick detects stale running task", async () => {
  const res = await api("POST", "/scheduler/tick", {});
  assert(res.status === 200, `expected 200, got ${res.status}`);
});

await test("stuck detection emits audit event", async () => {
  const res = await api("GET", "/audit?action=scheduler.tick&limit=40");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const entries = res.data.entries ?? res.data.events ?? [];
  const found = entries.some((entry) =>
    entry.resource === `task:${stuckTaskId}` && entry.detail?.event === "stuck_detected",
  );
  assert(found, `missing stuck_detected audit for ${stuckTaskId}`);
});

await test("stuck detection posts digest message instead of per-task spam", async () => {
  const roomsRes = await api("GET", "/chat/rooms");
  assert(roomsRes.status === 200, `expected 200 for rooms, got ${roomsRes.status}`);
  const hqRoom = (roomsRes.data ?? []).find((room) => room.name === "Colony HQ");
  assert(hqRoom?.roomId, "missing Colony HQ room");

  const res = await api("GET", `/chat/rooms/${hqRoom.roomId}/messages?limit=30`);
  assert(res.status === 200, `expected 200 for messages, got ${res.status}`);
  const messages = res.data.messages ?? [];
  const digestMessages = messages.filter((message) =>
    String(message.content || "").includes("C6 stuck-task digest"),
  );
  assert(digestMessages.length > 0, "missing C6 stuck-task digest message");
});

await test("create low-risk stale task fixture for safe auto-block", async () => {
  const created = await api("POST", "/tasks", {
    title: `Low risk stale digest note ${Date.now()}`,
    objective: "Prepare a short non-code operational note for safe C6 auto-block verification.",
    phase: "C4",
    sourceOfTruth: "scripts/c6-scheduler-reporter-test.mjs",
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["safe stale task may be auto-blocked"],
    founderApprovalRequired: false,
    tags: ["autonomous-safe", "stale-fixture"],
  });
  assert(created.status === 201, `expected 201, got ${created.status}: ${JSON.stringify(created.data)}`);
  assert(created.data.founderApprovalRequired === false, "safe fixture should not require founder approval");
  autoBlockTaskId = created.data.taskId;

  for (const status of ["planning", "approved", "running"]) {
    const patched = await api("PATCH", `/tasks/${autoBlockTaskId}/status`, {
      status,
      reason: "safe auto-block fixture",
    });
    assert(patched.status === 200, `expected 200 for ${status}, got ${patched.status}`);
  }
  await makeTaskStale(autoBlockTaskId, 180);
});

await test("scheduler auto-blocks only safe long-stuck tasks", async () => {
  const tick = await api("POST", "/scheduler/tick", {});
  assert(tick.status === 200, `expected 200, got ${tick.status}`);

  const res = await api("GET", `/tasks/${autoBlockTaskId}`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.data.status === "blocked", `expected blocked, got ${res.data.status}`);
  assert(
    String(res.data.blockedReason || "").includes("C6 auto-escalation"),
    "missing C6 auto-escalation blockedReason",
  );
});

await test("safe auto-block emits audit event", async () => {
  const res = await api("GET", "/audit?action=scheduler.tick&limit=80");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const entries = res.data.entries ?? res.data.events ?? [];
  const found = entries.some((entry) =>
    entry.resource === `task:${autoBlockTaskId}` && entry.detail?.event === "stuck_auto_blocked",
  );
  assert(found, `missing stuck_auto_blocked audit for ${autoBlockTaskId}`);
});

console.log(`\nResults: ${passed} PASS / ${failed} FAIL\n`);
if (failed > 0) process.exit(1);
