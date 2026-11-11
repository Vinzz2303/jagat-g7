#!/usr/bin/env node
/**
 * JAGAT Colony — Founder Flow Runtime Verification Script
 *
 * Purpose: Verify founder-only secure baseline end-to-end against a live backend.
 * Pre-requisites:
 *   - Redis running on localhost:6379
 *   - Backend running on localhost:5000
 *   - COLONY_INTERNAL_SECRET set (or dev fallback used)
 *
 * Usage:
 *   COLONY_INTERNAL_SECRET=jagat-colony-internal-2026 node scripts/verify-founder-flow.mjs
 *
 * What this tests:
 *   1. Auth rejection: no secret, wrong secret, missing headers
 *   2. Bootstrap colony (POST /colony/bootstrap)
 *   3. Create mission (POST /colony/missions)
 *   4. Create task (POST /colony/tasks)
 *   5. Task lifecycle: queued → planning → approved → running → review → done
 *   6. Approval flow: create request, approve by founder
 *   7. Audit trail: verify all events captured
 *   8. State machine: verify invalid transitions rejected
 */

import { createHmac } from "crypto";

const BACKEND = process.env.COLONY_BACKEND_URL || "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET || "jagat-colony-internal-2026";
const FOUNDER_NAME = process.env.FOUNDER_NAME || "Faturachman Al Kahfi";

let passed = 0;
let failed = 0;
let taskId = null;
let missionId = null;
let approvalId = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaders(overrides = {}) {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER_NAME,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "verify-script-token",
    ...overrides,
  };
}

async function req(method, path, body, headers) {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      method,
      headers: headers ?? buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: {}, error: err.message };
  }
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ── Test Suites ──────────────────────────────────────────────────────────────

async function testAuthRejection() {
  console.log("\n📋 Suite 1: Auth Rejection Tests");

  // 1A. No secret
  let r = await req("POST", "/colony/bootstrap", {}, {
    "Content-Type": "application/json",
    "X-Colony-Caller": FOUNDER_NAME,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "test",
  });
  assert("1A. No X-Colony-Secret → 401", r.status === 401, `got ${r.status}`);

  // 1B. Wrong secret
  r = await req("POST", "/colony/bootstrap", {}, {
    "Content-Type": "application/json",
    "X-Colony-Secret": "wrong-secret-value",
    "X-Colony-Caller": FOUNDER_NAME,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "test",
  });
  assert("1B. Wrong X-Colony-Secret → 401", r.status === 401, `got ${r.status}`);

  // 1C. Missing identity headers
  r = await req("POST", "/colony/bootstrap", {}, {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
  });
  assert("1C. Missing identity headers → 401", r.status === 401, `got ${r.status}`);

  // 1D. Non-SOVEREIGN tier
  r = await req("POST", "/colony/bootstrap", {}, {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": "someone",
    "X-Colony-Tier": "BASIC",
    "X-Colony-Token": "test",
  });
  assert("1D. BASIC tier → 403", r.status === 403, `got ${r.status}`);

  // 1E. Non-founder endpoint access check (founderOnly guard)
  r = await req("POST", "/colony/approvals/fake-id/fake", {}, buildHeaders({
    "X-Colony-Tier": "SOVEREIGN",
  }));
  // PATCH /colony/approvals/:id is founderOnly; if someone tries POST on wrong path: 404 or 403
  // Just verify founderOnly works — try missions (POST) with a tier that maps to null
  r = await req("POST", "/colony/missions", { title: "test" }, buildHeaders({
    "X-Colony-Tier": "ULTRA",
  }));
  assert("1E. ULTRA tier → 403 (no mapping yet)", r.status === 403, `got ${r.status}`);
}

async function testBootstrap() {
  console.log("\n📋 Suite 2: Bootstrap Colony");

  const r = await req("POST", "/colony/bootstrap");
  assert("2A. Bootstrap → 200", r.status === 200, `got ${r.status}`);
  assert("2B. agents seeded", typeof r.data.agents === "number" && r.data.agents > 0, `got ${r.data.agents}`);
  assert("2C. rooms seeded", typeof r.data.rooms === "number" && r.data.rooms > 0, `got ${r.data.rooms}`);
}

async function testMission() {
  console.log("\n📋 Suite 3: Create Mission");

  const r = await req("POST", "/colony/missions", {
    title: "VERIFY — Founder Flow Runtime Test",
    objective: "Membuktikan bahwa founder flow berjalan end-to-end di environment aktif",
    phase: "C5",
    priority: "high",
  });
  assert("3A. Create mission → 201", r.status === 201, `got ${r.status}`);
  assert("3B. Mission has ID", !!r.data.id, `got ${JSON.stringify(r.data).slice(0, 100)}`);
  assert("3C. createdBy = founder (server override)", r.data.createdBy === "founder", `got ${r.data.createdBy}`);
  missionId = r.data.id;
}

async function testTaskLifecycle() {
  console.log("\n📋 Suite 4: Task Lifecycle");

  // Create task
  let r = await req("POST", "/colony/tasks", {
    title: "VERIFY — Task lifecycle test",
    objective: "Uji state machine queued → planning → approved → running → review → done",
    phase: "C5",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: ["State machine berjalan", "Audit tercatat"],
    founderApprovalRequired: true,
    missionId,
  });
  assert("4A. Create task → 201", r.status === 201, `got ${r.status}`);
  assert("4B. Task has taskId", !!r.data.taskId, `got ${JSON.stringify(r.data).slice(0, 100)}`);
  assert("4C. Initial status = queued", r.data.status === "queued", `got ${r.data.status}`);
  assert("4D. createdBy from auth (founder role)", r.data.createdBy === "founder", `got ${r.data.createdBy}`);
  taskId = r.data.taskId;

  if (!taskId) {
    console.log("  ⚠️  No taskId — skipping lifecycle tests");
    return;
  }

  // queued → planning
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "planning", reason: "Verify script" });
  assert("4E. queued → planning", r.status === 200 && r.data.status === "planning", `got ${r.status} / ${r.data.status}`);

  // planning → approved
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "approved", reason: "Verify approval" });
  assert("4F. planning → approved", r.status === 200 && r.data.status === "approved", `got ${r.status} / ${r.data.status}`);

  // approved → running
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "running", reason: "Verify running" });
  assert("4G. approved → running", r.status === 200 && r.data.status === "running", `got ${r.status} / ${r.data.status}`);

  // running → review
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "review", reason: "Verify review" });
  assert("4H. running → review", r.status === 200 && r.data.status === "review", `got ${r.status} / ${r.data.status}`);

  // Add evidence (required for done)
  r = await req("POST", `/colony/tasks/${taskId}/evidence`, {
    type: "review_verdict",
    description: "Verify script completed all transitions successfully",
    timestamp: new Date().toISOString(),
    agentRole: "reviewer",
  });
  assert("4I. Add evidence → 200", r.status === 200, `got ${r.status}`);

  // review → done
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "done", reason: "Verify complete" });
  assert("4J. review → done", r.status === 200 && r.data.status === "done", `got ${r.status} / ${r.data.status}`);

  // Invalid transition: done → running (should fail)
  r = await req("PATCH", `/colony/tasks/${taskId}/status`, { status: "running", reason: "Illegal jump" });
  assert("4K. done → running rejected (state machine)", r.status >= 400, `got ${r.status}`);
}

async function testApprovalFlow() {
  console.log("\n📋 Suite 5: Approval Flow");

  // Create a new task to request approval on
  let r = await req("POST", "/colony/tasks", {
    title: "VERIFY — Approval flow test",
    objective: "Uji approval create + respond",
    phase: "C5",
    assignedAgent: "planner",
    priority: "medium",
    acceptanceCriteria: ["Approval flow berjalan"],
    founderApprovalRequired: true,
  });
  const approvalTaskId = r.data.taskId;

  // Create approval request
  r = await req("POST", "/colony/approvals", {
    taskId: approvalTaskId,
    type: "task_start",
    description: "Verify: approval request dari founder",
  });
  assert("5A. Create approval → 201", r.status === 201, `got ${r.status}`);
  assert("5B. requestedBy = founder name (server override)", r.data.requestedBy === FOUNDER_NAME, `got ${r.data.requestedBy}`);
  approvalId = r.data.approvalId;

  // List pending approvals
  r = await req("GET", "/colony/approvals");
  assert("5C. List approvals → 200", r.status === 200, `got ${r.status}`);

  if (!approvalId) {
    console.log("  ⚠️  No approvalId — skipping respond test");
    return;
  }

  // Respond as founder — note: respondedBy comes from server, NOT from body
  r = await req("PATCH", `/colony/approvals/${approvalId}`, {
    response: "approved",
    note: "Disetujui oleh verify script (simulating founder)",
  });
  assert("5D. Respond to approval → 200", r.status === 200, `got ${r.status}`);
  assert("5E. respondedBy = verified founder name", r.data.respondedBy === FOUNDER_NAME, `got ${r.data.respondedBy}`);
  assert("5F. status = approved", r.data.status === "approved", `got ${r.data.status}`);

  // Double-respond should fail (can't respond twice)
  r = await req("PATCH", `/colony/approvals/${approvalId}`, {
    response: "rejected",
    note: "Try double respond",
  });
  assert("5G. Double respond rejected (approval already resolved)", r.status >= 400, `got ${r.status}`);
}

async function testAuditTrail() {
  console.log("\n📋 Suite 6: Audit Trail");

  const r = await req("GET", "/colony/audit?limit=50");
  assert("6A. Audit endpoint accessible → 200", r.status === 200, `got ${r.status}`);

  const events = r.data.entries ?? [];
  assert("6B. Audit has events", events.length > 0, `got ${events.length} events`);

  const hasBootstrap = events.some(e => e.action === "colony.bootstrap");
  assert("6C. Bootstrap event recorded", hasBootstrap);

  const hasMission = events.some(e => e.action === "mission.create");
  assert("6D. Mission create event recorded", hasMission);

  const hasTask = events.some(e => e.action === "task.create");
  assert("6E. Task create event recorded", hasTask);

  const hasStatusChange = events.some(e => e.action === "task.status_change");
  assert("6F. Task status change event recorded", hasStatusChange);

  const hasApproval = events.some(e => e.action === "approval.create");
  assert("6G. Approval create event recorded", hasApproval);

  const hasApprovalRespond = events.some(e => e.action === "approval.respond");
  assert("6H. Approval respond event recorded", hasApprovalRespond);

  // All events must have actor (not unknown or empty)
  const missingActor = events.filter(e => !e.actor || e.actor === "unknown");
  assert("6I. No events with missing/unknown actor", missingActor.length === 0, `${missingActor.length} events missing actor`);

  // All events must have actorRole
  const missingActorRole = events.filter(e => !e.actorRole || e.actorRole === "unknown");
  assert("6J. No events with missing/unknown actorRole", missingActorRole.length === 0, `${missingActorRole.length} events missing actorRole`);

  // All events must have timestamp
  const missingTimestamp = events.filter(e => !e.timestamp);
  assert("6K. All events have timestamp", missingTimestamp.length === 0, `${missingTimestamp.length} events missing timestamp`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  JAGAT Colony — Founder Flow Runtime Verification");
  console.log(`  Backend: ${BACKEND}`);
  console.log(`  Founder: ${FOUNDER_NAME}`);
  console.log(`  Secret: ${SECRET.slice(0, 8)}...`);
  console.log("═══════════════════════════════════════════════════════════════");

  await testAuthRejection();
  await testBootstrap();
  await testMission();
  await testTaskLifecycle();
  await testApprovalFlow();
  await testAuditTrail();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} PASS / ${failed} FAIL`);
  console.log(`  Status: ${failed === 0 ? "✅ ALL PASS — Founder flow verified" : "❌ FAILURES DETECTED"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
