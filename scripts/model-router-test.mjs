/**
 * Model Router Test Suite
 * Verifikasi routing decision berdasarkan Garuda Ladder rules.
 *
 * Usage: node scripts/model-router-test.mjs
 */

import { routeModelForTask, isLocallyServable, formatRoutingDecision } from "../dist/colony/model-router.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed += 1;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertContains(arr, value, label) {
  if (!arr.includes(value)) {
    throw new Error(`${label}: expected "${value}" in [${arr.join(", ")}]`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`${label}: expected true, got false`);
}

function assertFalse(value, label) {
  if (value) throw new Error(`${label}: expected false, got true`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides = {}) {
  return {
    taskId: "TSK-TEST-001",
    title: overrides.title ?? "test task",
    objective: overrides.objective ?? "test objective",
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? "normal",
    assignedAgent: overrides.assignedAgent ?? "reporter",
    founderApprovalRequired: overrides.founderApprovalRequired ?? false,
    acceptanceCriteria: [],
    status: "pending",
    createdAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    createdBy: "test",
  };
}

// ── Test Groups ───────────────────────────────────────────────────────────────

console.log("\n── Rule 1: Founder Approval Required → L4 External ─────");

test("founderApprovalRequired=true → L4, not locally servable", () => {
  const task = makeTask({ founderApprovalRequired: true, assignedAgent: "builder" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L4", "level");
  assertEqual(decision.host, "external", "host");
  assertFalse(decision.locallyServable, "locally servable");
  assertContains(decision.triggeredRules, "founder_approval_required", "triggered rules");
});

test("founderApprovalRequired=true overrides reporter role", () => {
  const task = makeTask({ founderApprovalRequired: true, assignedAgent: "reporter" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L4", "level — founder gate overrides reporter");
  assertFalse(decision.locallyServable, "not locally servable");
});

console.log("\n── Rule 2: Security File Patterns → L4 External ────────");

test("auth-engine in title → L4 external", () => {
  const task = makeTask({ title: "Review auth-engine middleware", assignedAgent: "reviewer" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L4", "level");
  assertFalse(decision.locallyServable, "not locally servable");
  assertContains(decision.triggeredRules, "security_file_reference", "triggered rules");
});

test("patch-engine in objective → L4 external", () => {
  const task = makeTask({ objective: "Fix bug in patch-engine handling", assignedAgent: "builder" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L4", "level");
  assertFalse(decision.locallyServable, "not locally servable");
});

console.log("\n── Rule 3: High-Risk Keywords → L3 External ────────────");

test("'deploy' keyword → L3 external", () => {
  const task = makeTask({ title: "Deploy new service to production", assignedAgent: "planner" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L3", "level");
  assertEqual(decision.host, "external", "host");
  assertFalse(decision.locallyServable, "not locally servable");
  assertContains(decision.triggeredRules, "high_risk_keyword", "triggered rules");
});

test("'billing' keyword → L3 external", () => {
  const task = makeTask({ title: "Update billing integration", assignedAgent: "builder" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L3", "level");
});

test("'credential' keyword → L3 external", () => {
  const task = makeTask({ objective: "Handle credential rotation", assignedAgent: "reporter" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L3", "level");
  assertFalse(decision.locallyServable, "not locally servable");
});

console.log("\n── Rule 4: Reporter Role → L1 Remote ────────────────────");

test("reporter role → L1 fast remote", () => {
  const task = makeTask({ assignedAgent: "reporter" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L1", "level");
  assertEqual(decision.host, "remote", "host");
  assertTrue(decision.locallyServable, "locally servable");
  assertContains(decision.triggeredRules, "reporter_role", "triggered rules");
});

test("reporter role with 'summary' task → L1", () => {
  const task = makeTask({ title: "Generate weekly summary report", assignedAgent: "reporter" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L1", "level");
  assertTrue(isLocallyServable(task), "isLocallyServable helper");
});

console.log("\n── Rule 5: Planner/Researcher → L2 Remote ──────────────");

test("planner role → L2 remote", () => {
  const task = makeTask({ assignedAgent: "planner" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L2", "level");
  assertEqual(decision.host, "remote", "host");
  assertTrue(decision.locallyServable, "locally servable");
  assertContains(decision.triggeredRules, "planner_researcher_role", "triggered rules");
});

test("researcher role → L2 remote", () => {
  const task = makeTask({ assignedAgent: "researcher" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L2", "level");
  assertTrue(isLocallyServable(task), "isLocallyServable");
});

console.log("\n── Rule 6: Builder/Reviewer + High Priority → L3 External");

test("builder + high priority → L3 external (instruction discipline 0/20)", () => {
  const task = makeTask({ assignedAgent: "builder", priority: "high" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L3", "level");
  assertEqual(decision.host, "external", "host");
  assertFalse(decision.locallyServable, "not locally servable");
  assertContains(decision.triggeredRules, "coder_high_priority", "triggered rules");
});

test("reviewer + high priority → L3 external", () => {
  const task = makeTask({ assignedAgent: "reviewer", priority: "high" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L3", "level");
  assertFalse(decision.locallyServable, "not locally servable");
});

console.log("\n── Rule 7: Builder/Reviewer + Normal → L2 Remote ────────");

test("builder + normal priority → L2 remote (14b review model)", () => {
  const task = makeTask({ assignedAgent: "builder", priority: "normal" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L2", "level");
  assertEqual(decision.host, "remote", "host");
  assertTrue(decision.locallyServable, "locally servable");
  assertEqual(decision.recommendedModel, "qwen2.5-coder:14b", "model");
  assertContains(decision.triggeredRules, "coder_normal_priority", "triggered rules");
});

test("builder + low priority → L2 remote", () => {
  const task = makeTask({ assignedAgent: "builder", priority: "low" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L2", "level");
  assertTrue(isLocallyServable(task), "isLocallyServable");
});

console.log("\n── Rule 8: Director → L4 External ──────────────────────");

test("director role → L4 external (architecture decisions)", () => {
  const task = makeTask({ assignedAgent: "director" });
  const decision = routeModelForTask(task);
  assertEqual(decision.garudaLevel, "L4", "level");
  assertEqual(decision.host, "external", "host");
  assertFalse(decision.locallyServable, "not locally servable");
  assertContains(decision.triggeredRules, "director_role", "triggered rules");
});

console.log("\n── Format Helper ────────────────────────────────────────");

test("formatRoutingDecision returns readable string", () => {
  const task = makeTask({ assignedAgent: "reporter" });
  const decision = routeModelForTask(task);
  const formatted = formatRoutingDecision(decision);
  assertTrue(formatted.includes("[ModelRouter]"), "includes prefix");
  assertTrue(formatted.includes("L1"), "includes level");
  assertTrue(formatted.includes("remote"), "includes host");
  assertTrue(formatted.includes("locally-servable"), "includes servability");
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(50));
console.log(`Model Router Test: ${passed} PASS / ${failed} FAIL`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
