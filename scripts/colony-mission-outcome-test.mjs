// ============================================================================
// JAGAT Colony — Mission Outcome Summary Smoke Test
// Phase 3: Mission Execution Loop v0
// ============================================================================
//
// Tests:
// 1. Mission with mixed tasks → outcome summary with correct counts
// 2. Mission with quality scores → avg/top/lowest computed correctly
// 3. Mission with blocked tasks → blocked reasons collected
// 4. getMissionOutcome returns null for non-completed missions
// 5. Already-completed mission throws on re-complete
// ============================================================================

import { missionEngine, taskEngine, evaluationEngine } from "../dist/colony/index.js";

const runId = `SMOKE-${Date.now()}`;
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    failed++;
  }
}

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony — Mission Outcome Summary Smoke Test");
  console.log("===============================================================\n");

  // ── Test 1: Mission with mixed tasks ────────────────────────────────────
  console.log("── Test 1: Mission with mixed task statuses ──");

  const mission = await missionEngine.createMission({
    title: `Outcome Test ${runId}`,
    objective: "Verify mission outcome summary generation",
    phase: "C4",
    priority: "medium",
    createdBy: runId,
  });

  // Create 4 tasks: 2 done, 1 blocked, 1 running
  const t1 = await taskEngine.createTask({
    title: "Done task 1",
    objective: "Will be completed",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Complete the thing"],
    missionId: mission.id,
    createdBy: runId,
  });

  const t2 = await taskEngine.createTask({
    title: "Done task 2",
    objective: "Will also be completed",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Ship it"],
    missionId: mission.id,
    createdBy: runId,
  });

  const t3 = await taskEngine.createTask({
    title: "Blocked task",
    objective: "Will be blocked",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: ["Needs external dependency"],
    missionId: mission.id,
    createdBy: runId,
  });

  const t4 = await taskEngine.createTask({
    title: "Running task",
    objective: "Still in progress",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "low",
    acceptanceCriteria: ["Keep going"],
    missionId: mission.id,
    createdBy: runId,
  });

  // Move t1 to done
  await taskEngine.updateTaskStatus(t1.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t1.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t1.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(t1.taskId, {
    type: "test_result",
    description: "All tests passing, criteria met",
    url: "https://ci.example.com/123",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(t1.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t1.taskId, "done", "builder", "done");

  // Move t2 to done
  await taskEngine.updateTaskStatus(t2.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t2.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t2.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(t2.taskId, {
    type: "code_change",
    description: "Shipped successfully",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(t2.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t2.taskId, "done", "builder", "done");

  // Move t3 to blocked
  await taskEngine.updateTaskStatus(t3.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t3.taskId, "blocked", "builder", "Blocked: waiting for vendor", "Waiting for API key from vendor");

  // t4 stays running (already running after create? No, it's queued. Move to running)
  await taskEngine.updateTaskStatus(t4.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t4.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t4.taskId, "running", "builder", "go");

  // Complete the mission
  const completed = await missionEngine.completeMissionWithSummary(mission.id);
  const outcome = completed.outcomeSummary;

  assert(completed.status === "completed", "Mission status is completed");
  assert(outcome.totalTasks === 4, `Total tasks = 4 (got ${outcome.totalTasks})`);
  assert(outcome.doneCount === 2, `Done count = 2 (got ${outcome.doneCount})`);
  assert(outcome.blockedCount === 1, `Blocked count = 1 (got ${outcome.blockedCount})`);
  assert(outcome.runningCount === 1, `Running count = 1 (got ${outcome.runningCount})`);
  assert(outcome.blockedReasons.length === 1, `Has 1 blocked reason (got ${outcome.blockedReasons.length})`);
  assert(outcome.blockedReasons[0].includes("API key"), `Blocked reason mentions API key`);
  assert(outcome.summary.includes("4 tasks"), `Summary mentions total tasks`);
  assert(typeof outcome.completedAt === "string", "completedAt is ISO string");

  // ── Test 2: Quality scores aggregation ──────────────────────────────────
  console.log("\n── Test 2: Quality score aggregation ──");

  // Evaluate t1 and t2, store as evidence
  const t1Data = await taskEngine.getTask(t1.taskId);
  const t1Eval = evaluationEngine.evaluateTask(t1Data);
  await taskEngine.addEvidence(t1.taskId, evaluationEngine.evaluationToEvidence(t1Eval));

  const t2Data = await taskEngine.getTask(t2.taskId);
  const t2Eval = evaluationEngine.evaluateTask(t2Data);
  await taskEngine.addEvidence(t2.taskId, evaluationEngine.evaluationToEvidence(t2Eval));

  // Re-complete (need a new mission since the old one is already completed)
  const mission2 = await missionEngine.createMission({
    title: `Quality Test ${runId}`,
    objective: "Verify quality score aggregation",
    phase: "C4",
    priority: "medium",
    createdBy: runId,
  });

  // Create tasks linked to mission2
  const q1 = await taskEngine.createTask({
    title: "Quality task A",
    objective: "High quality work",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Must pass all checks"],
    missionId: mission2.id,
    createdBy: runId,
  });

  const q2 = await taskEngine.createTask({
    title: "Quality task B",
    objective: "Lower quality work",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Partial completion"],
    missionId: mission2.id,
    createdBy: runId,
  });

  // Move q1 to done with good evidence
  await taskEngine.updateTaskStatus(q1.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(q1.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(q1.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(q1.taskId, {
    type: "test_result",
    description: "All acceptance criteria verified and passing. Tests green. Documentation updated.",
    url: "https://ci.example.com/q1",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(q1.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(q1.taskId, "done", "builder", "done");

  // Evaluate q1
  const q1Data = await taskEngine.getTask(q1.taskId);
  const q1Eval = evaluationEngine.evaluateTask(q1Data);
  await taskEngine.addEvidence(q1.taskId, evaluationEngine.evaluationToEvidence(q1Eval));

  // Move q2 to done with minimal evidence
  await taskEngine.updateTaskStatus(q2.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(q2.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(q2.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(q2.taskId, {
    type: "other",
    description: "done",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(q2.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(q2.taskId, "done", "builder", "done");

  // Evaluate q2
  const q2Data = await taskEngine.getTask(q2.taskId);
  const q2Eval = evaluationEngine.evaluateTask(q2Data);
  await taskEngine.addEvidence(q2.taskId, evaluationEngine.evaluationToEvidence(q2Eval));

  // Complete mission2
  const completed2 = await missionEngine.completeMissionWithSummary(mission2.id);
  const outcome2 = completed2.outcomeSummary;

  assert(outcome2.qualityScoreCount === 2, `2 quality scores found (got ${outcome2.qualityScoreCount})`);
  assert(outcome2.avgQualityScore !== null, `avgQualityScore is not null`);
  assert(outcome2.topQualityScore !== null, `topQualityScore is not null`);
  assert(outcome2.lowestQualityScore !== null, `lowestQualityScore is not null`);
  assert(outcome2.topQualityScore >= outcome2.lowestQualityScore, `top >= lowest`);
  assert(outcome2.avgQualityScore >= outcome2.lowestQualityScore, `avg >= lowest`);
  assert(outcome2.avgQualityScore <= outcome2.topQualityScore, `avg <= top`);
  assert(outcome2.summary.includes("Quality:"), `Summary includes quality info`);

  // ── Test 3: getMissionOutcome ───────────────────────────────────────────
  console.log("\n── Test 3: getMissionOutcome ──");

  const retrieved = await missionEngine.getMissionOutcome(mission.id);
  assert(retrieved !== null, "getMissionOutcome returns non-null for completed mission");
  assert(retrieved.totalTasks === 4, `Retrieved totalTasks = 4 (got ${retrieved.totalTasks})`);

  const notCompleted = await missionEngine.getMissionOutcome("MISSION-FAKE-000");
  assert(notCompleted === null, "getMissionOutcome returns null for non-existent mission");

  // ── Test 4: Double-complete throws ──────────────────────────────────────
  console.log("\n── Test 4: Double-complete guard ──");

  let doubleThrew = false;
  try {
    await missionEngine.completeMissionWithSummary(mission.id);
  } catch (err) {
    doubleThrew = err.message.includes("already completed");
  }
  assert(doubleThrew, "Double-complete throws 'already completed' error");

  // ── Cleanup ─────────────────────────────────────────────────────────────
  console.log("\n── Cleanup ──");
  const { getRedisClient } = await import("../dist/services/redis.service.js");
  const cleanupRedis = getRedisClient();
  for (const t of [t1, t2, t3, t4, q1, q2]) {
    await cleanupRedis.del(`colony:task:${t.taskId}`);
  }
  console.log("  ✅ Test tasks cleaned up");

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`  Results: ${passed} PASS, ${failed} FAIL`);
  console.log("===============================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
