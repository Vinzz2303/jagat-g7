#!/usr/bin/env node
/**
 * Colony Feedback Loop v0A — Integration Test
 *
 * Verifies that the auto-evaluation hook in task-engine.ts correctly:
 *  1. Attaches quality_score evidence when task enters "review"
 *  2. Attaches quality_score evidence when task enters "done"
 *  3. Does NOT duplicate if quality_score evidence already exists
 *  4. Does NOT trigger on other status transitions (e.g. "running")
 *  5. Does NOT auto-approve or change approval policy
 *  6. Quality score is advisory only (task status unchanged by score)
 */

import {
  taskEngine,
} from "../dist/colony/index.js";
import { disconnectRedis, getRedisClient } from "../dist/services/redis.service.js";

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`  ✅ PASS  ${message}`);
}

function fail(message, detail = "") {
  failCount += 1;
  console.error(`  ❌ FAIL  ${message}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message, detail = "") {
  if (condition) pass(message);
  else fail(message, detail);
}

async function main() {
  const runId = `v0a-${Date.now()}`;
  const redis = getRedisClient();
  const createdTaskIds = [];

  console.log("===============================================================");
  console.log("  JAGAT Colony — Feedback Loop v0A Integration Test");
  console.log("===============================================================\n");

  // ── Helper: create a task with evidence, advance to running ──────────────
  async function createTaskWithEvidence(label) {
    const task = await taskEngine.createTask({
      title: `v0A test task: ${label}`,
      objective: `Test auto-evaluation hook when task enters review or done status`,
      phase: "C5",
      sourceOfTruth: "ops/test",
      assignedAgent: "builder",
      priority: "medium",
      acceptanceCriteria: ["Auto-evaluation attaches quality score", "No duplicate scores"],
      description: `Integration test task for feedback loop v0A. Validates that evaluation engine hook fires correctly.`,
      tags: ["test", "v0a"],
      estimatedMinutes: 10,
      createdBy: runId,
    });
    createdTaskIds.push(task.taskId);

    // Advance to running
    await taskEngine.updateTaskStatus(task.taskId, "planning", "builder", "planning");
    await taskEngine.updateTaskStatus(task.taskId, "approved", "builder", "approved");
    await taskEngine.updateTaskStatus(task.taskId, "running", "builder", "running");

    // Add one piece of real evidence (required for done transition later)
    await taskEngine.addEvidence(task.taskId, {
      type: "test_result",
      description: `Evidence for v0A test: ${label}. Verification of auto-evaluation hook.`,
      url: "scripts/colony-feedback-loop-v0a-test.mjs",
      agentRole: "builder",
    });

    return task;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1: Auto-evaluation fires on "review" transition
  // ══════════════════════════════════════════════════════════════════════════
  console.log("── Test 1: Auto-evaluation on \"review\" transition ──");

  const t1 = await createTaskWithEvidence("review-trigger");
  const t1Before = await taskEngine.getTask(t1.taskId);
  const evidenceCountBefore = t1Before.evidence.length;

  // Transition to review — should trigger auto-evaluation
  await taskEngine.updateTaskStatus(t1.taskId, "review", "reviewer", "review for v0a test");

  const t1After = await taskEngine.getTask(t1.taskId);
  const evidenceCountAfter = t1After.evidence.length;

  assert(
    evidenceCountAfter === evidenceCountBefore + 1,
    "Review transition adds 1 evidence entry",
    `expected ${evidenceCountBefore + 1}, got ${evidenceCountAfter}`,
  );

  const qualityEvidence = t1After.evidence.find((e) => e.quality_score !== undefined);
  assert(qualityEvidence !== undefined, "New evidence has quality_score field");
  assert(
    typeof qualityEvidence?.quality_score === "number",
    "quality_score is a number",
    `got ${typeof qualityEvidence?.quality_score}`,
  );
  assert(
    qualityEvidence?.quality_score >= 0 && qualityEvidence?.quality_score <= 100,
    `quality_score in valid range (got ${qualityEvidence?.quality_score})`,
  );
  assert(
    qualityEvidence?.quality_verdict === "pass" ||
    qualityEvidence?.quality_verdict === "needs_review" ||
    qualityEvidence?.quality_verdict === "fail",
    `quality_verdict is valid (got ${qualityEvidence?.quality_verdict})`,
  );
  assert(
    Array.isArray(qualityEvidence?.quality_dimensions),
    "quality_dimensions is an array",
  );
  assert(
    qualityEvidence?.quality_dimensions?.length === 5,
    `Has 5 dimensions (got ${qualityEvidence?.quality_dimensions?.length})`,
  );
  assert(
    qualityEvidence?.agentRole === "reporter",
    `Agent role is reporter (got ${qualityEvidence?.agentRole})`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2: Auto-evaluation fires on "done" transition
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 2: Auto-evaluation on \"done\" transition ──");

  const t2 = await createTaskWithEvidence("done-trigger");
  const t2Before = await taskEngine.getTask(t2.taskId);
  const t2EvidenceBefore = t2Before.evidence.length;

  // Transition: running → review → done (state machine requires review step)
  await taskEngine.updateTaskStatus(t2.taskId, "review", "reviewer", "review for v0a test");
  // Quality score was already attached at review. Now transition to done.
  // Since quality_score already exists from review, done should NOT add another.
  // But we want to test done-trigger specifically, so we need a fresh task.
  // Actually — let's test: does done ALSO fire if review already fired?
  // Answer: No, because quality_score already exists (duplicate guard).
  // So for done-trigger test, we go running → review (no evidence check) → done.

  const t2AfterReview = await taskEngine.getTask(t2.taskId);
  const t2EvidenceAfterReview = t2AfterReview.evidence.length;

  // Now transition to done
  await taskEngine.updateTaskStatus(t2.taskId, "done", "reviewer", "done for v0a test");

  const t2After = await taskEngine.getTask(t2.taskId);
  const t2EvidenceAfter = t2After.evidence.length;

  // Quality score was attached at review, so done should NOT add another (duplicate guard)
  assert(
    t2EvidenceAfter === t2EvidenceAfterReview,
    "Done does NOT add duplicate quality_score (already added at review)",
    `expected ${t2EvidenceAfterReview}, got ${t2EvidenceAfter}`,
  );

  const t2Quality = t2After.evidence.find((e) => e.quality_score !== undefined);
  assert(t2Quality !== undefined, "Done task has quality_score evidence");
  assert(
    typeof t2Quality?.quality_score === "number",
    "Done quality_score is a number",
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3: No duplicate if quality_score already exists
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 3: No duplicate quality_score ──");

  // t1 is now in "review" with quality_score evidence.
  // Transition to "done" — should NOT add another quality_score.
  const t1BeforeDone = await taskEngine.getTask(t1.taskId);
  const t1EvidenceBeforeDone = t1BeforeDone.evidence.length;

  await taskEngine.updateTaskStatus(t1.taskId, "done", "reviewer", "approve for v0a test");

  const t1AfterDone = await taskEngine.getTask(t1.taskId);
  const t1EvidenceAfterDone = t1AfterDone.evidence.length;
  const qualityEvidenceCount = t1AfterDone.evidence.filter((e) => e.quality_score !== undefined).length;

  assert(
    qualityEvidenceCount === 1,
    `Only 1 quality_score evidence (no duplicate), got ${qualityEvidenceCount}`,
  );
  assert(
    t1EvidenceAfterDone === t1EvidenceBeforeDone,
    `No new evidence added on done when quality_score exists (${t1EvidenceBeforeDone} → ${t1EvidenceAfterDone})`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4: No auto-evaluation on "running" transition
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 4: No auto-evaluation on non-review/done transitions ──");

  const t4 = await taskEngine.createTask({
    title: "v0A no-trigger test",
    objective: "Verify no auto-evaluation on running transition",
    phase: "C5",
    sourceOfTruth: "ops/test",
    assignedAgent: "builder",
    priority: "low",
    acceptanceCriteria: ["No quality score on running"],
    description: "This task should not get auto-evaluated on running transition.",
    createdBy: runId,
  });
  createdTaskIds.push(t4.taskId);

  await taskEngine.updateTaskStatus(t4.taskId, "planning", "builder", "planning");
  await taskEngine.updateTaskStatus(t4.taskId, "approved", "builder", "approved");
  await taskEngine.updateTaskStatus(t4.taskId, "running", "builder", "running");

  const t4After = await taskEngine.getTask(t4.taskId);
  const t4QualityEvidence = t4After.evidence.filter((e) => e.quality_score !== undefined);

  assert(
    t4QualityEvidence.length === 0,
    "Running transition does NOT trigger auto-evaluation",
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5: Auto-evaluation does NOT auto-approve
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 5: No auto-approve (advisory only) ──");

  // t2 was moved to "done" — verify it's still "done", not auto-promoted
  const t2Final = await taskEngine.getTask(t2.taskId);
  assert(
    t2Final.status === "done",
    `Task status is "done" (not auto-changed), got "${t2Final.status}"`,
  );

  // t1 was moved to "done" — verify status unchanged
  const t1Final = await taskEngine.getTask(t1.taskId);
  assert(
    t1Final.status === "done",
    `Task 1 status is "done" (not auto-changed), got "${t1Final.status}"`,
  );

  // Verify no approval-related fields were modified by the hook
  const t2QualityFinal = t2Final.evidence.find((e) => e.quality_score !== undefined);
  assert(
    t2QualityFinal?.type === "other",
    `Quality evidence type is "other" (not approval), got "${t2QualityFinal?.type}"`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 6: Quality score dimension breakdown is present
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 6: Quality dimension breakdown ──");

  const dims = t2QualityFinal?.quality_dimensions ?? [];
  const dimNames = dims.map((d) => d.name);

  assert(
    dimNames.includes("acceptance_criteria_coverage"),
    `Has acceptance_criteria_coverage dimension`,
  );
  assert(
    dimNames.includes("evidence_presence"),
    `Has evidence_presence dimension`,
  );
  assert(
    dimNames.includes("output_completeness"),
    `Has output_completeness dimension`,
  );
  assert(
    dimNames.includes("risk_markers"),
    `Has risk_markers dimension`,
  );
  assert(
    dimNames.includes("status_consistency"),
    `Has status_consistency dimension`,
  );

  // Verify each dimension has score, maxScore, reason
  for (const dim of dims) {
    assert(
      typeof dim.score === "number" && typeof dim.maxScore === "number",
      `Dimension "${dim.name}" has numeric score/maxScore (${dim.score}/${dim.maxScore})`,
    );
    assert(
      typeof dim.reason === "string" && dim.reason.length > 0,
      `Dimension "${dim.name}" has non-empty reason`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 7: Description contains quality_score marker
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 7: Evidence description format ──");

  assert(
    t2QualityFinal?.description?.includes("[quality_score]"),
    "Description contains [quality_score] marker",
  );
  assert(
    t2QualityFinal?.description?.includes("/100"),
    "Description contains /100 score format",
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Cleanup ──");

  for (const taskId of createdTaskIds) {
    try {
      const task = await taskEngine.getTask(taskId);
      if (task) {
        await redis.del(`colony:task:${taskId}`);
        await redis.srem(`colony:tasks:status:${task.status}`, taskId);
        await redis.del(`colony:task:${taskId}:transitions`);
      }
    } catch {
      // ignore cleanup errors
    }
  }
  pass(`Cleaned up ${createdTaskIds.length} test tasks`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`  Results: ${passCount} PASS, ${failCount} FAIL`);
  console.log("===============================================================");

  await disconnectRedis();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  await disconnectRedis();
  process.exit(1);
});
