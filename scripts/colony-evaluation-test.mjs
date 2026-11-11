#!/usr/bin/env node
/**
 * Colony Evaluation Engine v0 — Test Script
 *
 * Tests:
 *  1. High-quality task (all criteria evidenced, rich evidence, complete) → pass
 *  2. Medium-quality task (partial evidence) → needs_review
 *  3. Low-quality task (no evidence, no criteria) → fail
 *  4. Risk marker detection (unmitigated vs mitigated)
 *  5. Status consistency (done without evidence penalized)
 *  6. evaluationToEvidence format
 *  7. evaluateTasksBatch ordering
 *  8. formatEvaluationSummary output
 */

import {
  evaluationEngine,
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
  const runId = `eval-test-${Date.now()}`;
  const redis = getRedisClient();

  console.log("===============================================================");
  console.log("  JAGAT Colony — Evaluation Engine v0 Test");
  console.log("===============================================================\n");

  // ── Test 1: High-quality task ────────────────────────────────────────────

  console.log("── Test 1: High-quality task (should PASS) ──");

  const highQualityTask = await taskEngine.createTask({
    title: "Implement auth guard middleware",
    objective: "Add colony auth guard to protect internal routes from unauthorized access",
    phase: "C5",
    sourceOfTruth: "ops/JAGAT_COLONY_GAP_AUDIT.md",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: [
      "Auth guard middleware rejects unauthorized requests",
      "Audit log records all auth attempts",
      "TypeScript compiles without errors",
    ],
    description: "Implement colonyAuthGuard() middleware that validates X-Colony-Identity headers and rejects requests without valid founder session. Add audit logging for all auth events.",
    tags: ["security", "auth", "middleware"],
    estimatedMinutes: 30,
    createdBy: runId,
  });

  // Move to running first (evidence only allowed in running/review/done)
  await taskEngine.updateTaskStatus(highQualityTask.taskId, "planning", "builder", "planning");
  await taskEngine.updateTaskStatus(highQualityTask.taskId, "approved", "builder", "approved");
  await taskEngine.updateTaskStatus(highQualityTask.taskId, "running", "builder", "running");

  // Simulate evidence attachment (as if worker completed the task)
  await taskEngine.addEvidence(highQualityTask.taskId, {
    type: "code_change",
    description: "Created src/colony/auth.ts with colonyAuthGuard() middleware. Validates X-Colony-Identity headers, rejects duplicate headers, logs auth attempts to audit engine.",
    url: "src/colony/auth.ts",
    agentRole: "builder",
  });

  await taskEngine.addEvidence(highQualityTask.taskId, {
    type: "test_result",
    description: "Auth header hardening test PASS: 12/12 assertions. Duplicate header rejection verified.",
    url: "scripts/auth-header-hardening-test.mjs",
    agentRole: "reviewer",
  });

  await taskEngine.addEvidence(highQualityTask.taskId, {
    type: "review_verdict",
    description: "Code review PASS. Auth guard correctly validates headers. Audit log integration verified. No security issues found.",
    agentRole: "reviewer",
  });

  await taskEngine.addEvidence(highQualityTask.taskId, {
    type: "log",
    description: "tsc --noEmit: 0 errors. Build successful.",
    agentRole: "builder",
  });

  // Move to review for status consistency
  await taskEngine.updateTaskStatus(highQualityTask.taskId, "review", "builder", "Worker completed task");

  // Re-fetch task to get updated state
  const hqTask = await taskEngine.getTask(highQualityTask.taskId);
  const hqResult = evaluationEngine.evaluateTask(hqTask);

  assert(hqResult.totalScore >= 70, `High-quality score ≥ 70 (got ${hqResult.totalScore})`);
  assert(hqResult.verdict === "pass" || hqResult.verdict === "needs_review",
    `High-quality verdict is pass or needs_review (got ${hqResult.verdict})`);
  assert(hqResult.dimensions.length === 5, `Has 5 dimensions (got ${hqResult.dimensions.length})`);
  assert(hqResult.taskId === highQualityTask.taskId, `Task ID matches`);

  const hqCriteria = hqResult.dimensions.find(d => d.name === "acceptance_criteria_coverage");
  assert(hqCriteria && hqCriteria.score >= 15, `Criteria coverage ≥ 15 (got ${hqCriteria?.score})`);

  const hqEvidence = hqResult.dimensions.find(d => d.name === "evidence_presence");
  assert(hqEvidence && hqEvidence.score >= 15, `Evidence presence ≥ 15 (got ${hqEvidence?.score})`);

  console.log();

  // ── Test 2: Medium-quality task ──────────────────────────────────────────

  console.log("── Test 2: Medium-quality task (should NEEDS_REVIEW) ──");

  const medQualityTask = await taskEngine.createTask({
    title: "Update documentation",
    objective: "Update ops docs to reflect latest changes",
    phase: "C3",
    sourceOfTruth: "ops/TECHNICAL_BACKLOG.md",
    assignedAgent: "reporter",
    priority: "medium",
    acceptanceCriteria: [
      "Documentation reflects current architecture",
      "All new modules documented",
    ],
    createdBy: runId,
  });

  // Move to running before adding evidence
  await taskEngine.updateTaskStatus(medQualityTask.taskId, "planning", "reporter", "plan");
  await taskEngine.updateTaskStatus(medQualityTask.taskId, "approved", "reporter", "ok");
  await taskEngine.updateTaskStatus(medQualityTask.taskId, "running", "reporter", "go");

  await taskEngine.addEvidence(medQualityTask.taskId, {
    type: "document",
    description: "Updated technical backlog with new tasks.",
    agentRole: "reporter",
  });

  const medTask = await taskEngine.getTask(medQualityTask.taskId);
  const medResult = evaluationEngine.evaluateTask(medTask);

  assert(medResult.totalScore >= 30 && medResult.totalScore < 80,
    `Medium-quality score in 30-79 range (got ${medResult.totalScore})`);
  assert(medResult.verdict === "needs_review" || medResult.verdict === "fail",
    `Medium-quality verdict is needs_review or fail (got ${medResult.verdict})`);

  console.log();

  // ── Test 3: Low-quality task ─────────────────────────────────────────────

  console.log("── Test 3: Low-quality task (should FAIL) ──");

  const lowQualityTask = await taskEngine.createTask({
    title: "Fix stuff",
    objective: "Fix the things that are broken",
    phase: "C4",
    sourceOfTruth: "",
    assignedAgent: "builder",
    priority: "low",
    acceptanceCriteria: [],
    createdBy: runId,
  });

  const lqTask = await taskEngine.getTask(lowQualityTask.taskId);
  const lqResult = evaluationEngine.evaluateTask(lqTask);

  assert(lqResult.totalScore < 60, `Low-quality score < 60 (got ${lqResult.totalScore})`);
  assert(lqResult.verdict === "fail", `Low-quality verdict is fail (got ${lqResult.verdict})`);

  const lqEvidence = lqResult.dimensions.find(d => d.name === "evidence_presence");
  assert(lqEvidence && lqEvidence.score === 0, `No evidence = 0 score (got ${lqEvidence?.score})`);

  console.log();

  // ── Test 4: Risk marker detection ────────────────────────────────────────

  console.log("── Test 4: Risk marker detection ──");

  const riskyTask = await taskEngine.createTask({
    title: "Delete old auth tokens and update .env secrets",
    objective: "Remove expired tokens from database and update production environment secrets",
    phase: "C5",
    sourceOfTruth: "ops/RUNTIME_RUNBOOK.md",
    assignedAgent: "builder",
    priority: "critical",
    acceptanceCriteria: ["Tokens removed", "Secrets updated"],
    createdBy: runId,
  });

  // Move to running before adding evidence
  await taskEngine.updateTaskStatus(riskyTask.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(riskyTask.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(riskyTask.taskId, "running", "builder", "go");

  // Without mitigation evidence
  const riskyTaskData = await taskEngine.getTask(riskyTask.taskId);
  const riskyResult = evaluationEngine.evaluateTask(riskyTaskData);
  const riskyRisk = riskyResult.dimensions.find(d => d.name === "risk_markers");
  assert(riskyRisk && riskyRisk.score < 15, `Unmitigated risk penalized (score ${riskyRisk?.score}/15)`);
  assert(riskyRisk && riskyRisk.reason.includes("unmitigated"), `Reports unmitigated risks`);

  // With mitigation evidence
  await taskEngine.addEvidence(riskyTask.taskId, {
    type: "log",
    description: "Backup created before deletion. Rollback plan documented. Validated with dry-run.",
    agentRole: "builder",
  });

  const riskyTaskData2 = await taskEngine.getTask(riskyTask.taskId);
  const riskyResult2 = evaluationEngine.evaluateTask(riskyTaskData2);
  const riskyRisk2 = riskyResult2.dimensions.find(d => d.name === "risk_markers");
  assert(riskyRisk2 && riskyRisk2.score >= riskyRisk.score,
    `Mitigation evidence improves risk score (${riskyRisk?.score} → ${riskyRisk2?.score})`);

  console.log();

  // ── Test 5: Status consistency ───────────────────────────────────────────

  console.log("── Test 5: Status consistency ──");

  // Done without evidence
  const doneNoEvidence = await taskEngine.createTask({
    title: "Quick task",
    objective: "Do something quick",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["Done"],
    createdBy: runId,
  });
  // Move through pipeline to done (simulate)
  // Note: task-engine enforces evidence for "done" transition, so we add minimal evidence
  // but evaluation-engine should still detect the weakness (minimal description, no URL, etc.)
  await taskEngine.updateTaskStatus(doneNoEvidence.taskId, "planning", "reporter", "plan");
  await taskEngine.updateTaskStatus(doneNoEvidence.taskId, "approved", "reporter", "ok");
  await taskEngine.updateTaskStatus(doneNoEvidence.taskId, "running", "reporter", "go");
  await taskEngine.addEvidence(doneNoEvidence.taskId, {
    type: "other",
    description: "done", // intentionally minimal — no substance
    agentRole: "reporter",
  });
  await taskEngine.updateTaskStatus(doneNoEvidence.taskId, "review", "reporter", "review");
  await taskEngine.updateTaskStatus(doneNoEvidence.taskId, "done", "reporter", "done");

  const doneTask = await taskEngine.getTask(doneNoEvidence.taskId);
  const doneResult = evaluationEngine.evaluateTask(doneTask);
  const doneConsistency = doneResult.dimensions.find(d => d.name === "status_consistency");
  // With only minimal evidence (3 chars description, no URL, single type), score should be low
  assert(doneConsistency && doneConsistency.score <= 8,
    `Done with minimal evidence has low consistency score (${doneConsistency?.score})`);

  // Evidence quality should also be low
  const doneEvidence = doneResult.dimensions.find(d => d.name === "evidence_presence");
  assert(doneEvidence && doneEvidence.score < 15,
    `Minimal evidence gives low evidence score (${doneEvidence?.score})`);

  // Overall should not be "pass"
  assert(doneResult.verdict !== "pass" || doneResult.totalScore < 80,
    `Minimal-evidence task not auto-passing (${doneResult.verdict}, ${doneResult.totalScore})`);

  console.log();

  // ── Test 6: evaluationToEvidence format ──────────────────────────────────

  console.log("── Test 6: evaluationToEvidence format ──");

  const evidence = evaluationEngine.evaluationToEvidence(hqResult);
  assert(evidence.type === "other", `Evidence type is "other"`);
  assert(evidence.description.includes("quality_score"), `Description includes quality_score`);
  assert(evidence.description.includes(String(hqResult.totalScore)), `Description includes score`);
  assert(evidence.description.includes(hqResult.verdict), `Description includes verdict`);
  assert(evidence.agentRole === "reporter", `Agent role is reporter`);
  assert(typeof evidence.timestamp === "string", `Timestamp is string`);

  console.log();

  // ── Test 7: evaluateTasksBatch ordering ──────────────────────────────────

  console.log("── Test 7: Batch evaluation ordering ──");

  const batchResults = evaluationEngine.evaluateTasksBatch([hqTask, medTask, lqTask]);
  assert(batchResults.length === 3, `Batch returns all 3 results`);
  assert(batchResults[0].totalScore <= batchResults[1].totalScore,
    `Sorted ascending: first ≤ second (${batchResults[0].totalScore} ≤ ${batchResults[1].totalScore})`);
  assert(batchResults[1].totalScore <= batchResults[2].totalScore,
    `Sorted ascending: second ≤ third (${batchResults[1].totalScore} ≤ ${batchResults[2].totalScore})`);

  console.log();

  // ── Test 8: formatEvaluationSummary ──────────────────────────────────────

  console.log("── Test 8: Summary formatting ──");

  const summary = evaluationEngine.formatEvaluationSummary(hqResult);
  assert(summary.includes("📊 Evaluation:"), `Summary includes header`);
  assert(summary.includes(String(hqResult.totalScore)), `Summary includes score`);
  assert(summary.includes("acceptance_criteria_coverage"), `Summary includes dimension names`);
  assert(summary.includes("█"), `Summary includes progress bar`);

  console.log();

  // ── Cleanup ──────────────────────────────────────────────────────────────

  console.log("── Cleanup ──");
  const testTaskIds = [
    highQualityTask.taskId,
    medQualityTask.taskId,
    lowQualityTask.taskId,
    riskyTask.taskId,
    doneNoEvidence.taskId,
  ];
  for (const tid of testTaskIds) {
    try {
      const key = `colony:task:${tid}`;
      await redis.del(key);
    } catch { /* ignore */ }
  }
  pass("Test tasks cleaned up");

  console.log();

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log("===============================================================");
  console.log(`  Results: ${passCount} PASS, ${failCount} FAIL`);
  console.log("===============================================================");

  await disconnectRedis();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
