#!/usr/bin/env node
/**
 * Colony Engine Hardening Coverage
 * Covers audit query filtering, directive draft guards, and mission runtime validation.
 */

import {
  auditEngine,
  autonomousPolicy,
  directiveEngine,
  missionEngine,
  reporterEngine,
  schedulerQueue,
  taskEngine,
  workerExecutor,
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

async function expectReject(label, fn, pattern) {
  try {
    await fn();
    fail(label, "expected rejection but command resolved");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(pattern.test(msg), label, msg);
  }
}

async function main() {
  const runId = `coverage-${Date.now()}`;
  const actor = `coverage-founder-${runId}`;

  console.log("===============================================================");
  console.log("  JAGAT Colony — Engine Hardening Coverage");
  console.log("===============================================================");

  // Cleanup stale test tasks from previous runs to prevent scheduler limit overflow
  const cleanupRedis = getRedisClient();
  const staleKeys = await cleanupRedis.keys("colony:task:TASK-*");
  let cleanedUp = 0;
  for (const key of staleKeys) {
    try {
      const raw = await cleanupRedis.get(key);
      if (!raw) continue;
      const task = JSON.parse(raw);
      if (task.status === "queued" && (task.sourceOfTruth?.startsWith("coverage:") || task.createdBy?.startsWith("coverage-"))) {
        await cleanupRedis.del(key);
        await cleanupRedis.sRem("colony:tasks:index", task.taskId);
        await cleanupRedis.sRem(`colony:tasks:status:${task.status}`, task.taskId);
        if (task.assignedAgent) await cleanupRedis.sRem(`colony:tasks:agent:${task.assignedAgent}`, task.taskId);
        cleanedUp++;
      }
    } catch { /* ignore parse errors */ }
  }
  if (cleanedUp > 0) console.log(`  🧹 Cleaned up ${cleanedUp} stale test tasks from previous runs\n`);

  console.log("\n🧾 Suite 1: Audit filtered totals");
  await auditEngine.emitAudit({
    actor,
    actorRole: "founder",
    action: "mission.create",
    resource: `coverage:${runId}:mission`,
    detail: { runId },
  });
  await auditEngine.emitAudit({
    actor,
    actorRole: "founder",
    action: "task.create",
    resource: `coverage:${runId}:task`,
    detail: { runId },
  });
  await auditEngine.emitAudit({
    actor,
    actorRole: "founder",
    action: "task.create",
    resource: `coverage:${runId}:task2`,
    detail: { runId },
  });

  const taskAudit = await auditEngine.queryAuditLog({ actor, action: "task.create", limit: 10 });
  assert(taskAudit.total === 2, "queryAuditLog total reflects action filter", `total=${taskAudit.total}`);
  assert(taskAudit.entries.length === 2, "queryAuditLog entries are action-filtered", `entries=${taskAudit.entries.length}`);
  assert(taskAudit.entries.every((entry) => entry.action === "task.create"), "queryAuditLog returns only requested action");

  const pagedAudit = await auditEngine.queryAuditLog({ actor, action: "task.create", limit: 1, offset: 1 });
  assert(pagedAudit.total === 2, "queryAuditLog keeps filtered total under pagination", `total=${pagedAudit.total}`);
  assert(pagedAudit.entries.length === 1, "queryAuditLog paginates after filtering", `entries=${pagedAudit.entries.length}`);

  // T-044: Verify category normalization on emitted entries
  assert(taskAudit.entries[0].category === "task", "T-044: task.create has category 'task'", taskAudit.entries[0].category);
  
  const missionAudit = await auditEngine.queryAuditLog({ actor, action: "mission.create", limit: 1 });
  assert(missionAudit.entries[0].category === "mission", "T-044: mission.create has category 'mission'", missionAudit.entries[0].category);

  // T-044: Test category filter
  const taskCategory = await auditEngine.queryAuditLog({ actor, category: "task", limit: 10 });
  assert(taskCategory.total >= 2, "T-044: category filter finds task entries", `total=${taskCategory.total}`);
  assert(taskCategory.entries.every((e) => e.category === "task"), "T-044: all entries have category 'task'");

  // T-044: Test getAuditCategory directly
  assert(auditEngine.getAuditCategory("scheduler.tick") === "scheduler", "T-044: scheduler.tick → scheduler");
  assert(auditEngine.getAuditCategory("patch.apply") === "patch", "T-044: patch.apply → patch");
  assert(auditEngine.getAuditCategory("distillation.capture") === "distillation", "T-044: distillation.capture → distillation");

  console.log("\n📜 Suite 2: Directive draft governance guards");
  await expectReject(
    "updateDraftStatus rejects missing/expired draft",
    () => directiveEngine.updateDraftStatus(`DRAFT-NOT-FOUND-${runId}`, "approved"),
    /not found|expired/i,
  );

  console.log("\n🎯 Suite 3: Mission runtime validation");
  const mission = await missionEngine.createMission({
    title: `Coverage Mission ${runId}`,
    objective: "Verify mission update runtime validation",
    phase: "C5",
    priority: "medium",
    createdBy: actor,
  });

  await expectReject(
    "updateMission rejects invalid runtime status",
    () => missionEngine.updateMission(mission.id, { status: "teleported" }),
    /Invalid mission status/i,
  );
  await expectReject(
    "updateMission rejects invalid runtime priority",
    () => missionEngine.updateMission(mission.id, { priority: "panic" }),
    /Invalid mission priority/i,
  );

  const updated = await missionEngine.updateMission(mission.id, { status: "paused", priority: "high" });
  assert(updated.status === "paused", "updateMission accepts valid status", `status=${updated.status}`);
  assert(updated.priority === "high", "updateMission accepts valid priority", `priority=${updated.priority}`);

  // GAP 10: createMission runtime validation
  await expectReject(
    "createMission rejects invalid priority",
    () => missionEngine.createMission({
      title: `Bad Priority Mission ${runId}`,
      objective: "Should fail",
      phase: "C5",
      priority: "turbo",
      createdBy: actor,
    }),
    /Invalid mission priority/i,
  );
  await expectReject(
    "createMission rejects empty createdBy",
    () => missionEngine.createMission({
      title: `No Creator Mission ${runId}`,
      objective: "Should fail",
      phase: "C5",
      priority: "medium",
      createdBy: "",
    }),
    /createdBy cannot be empty/i,
  );

  await expectReject(
    "createTask rejects invalid priority",
    () => taskEngine.createTask({
      title: `Coverage Bad Priority ${runId}`,
      objective: "Should fail",
      phase: "C4",
      sourceOfTruth: `coverage:${runId}`,
      assignedAgent: "reporter",
      priority: "turbo",
      acceptanceCriteria: ["Rejected"],
      createdBy: actor,
    }),
    /Invalid task priority/i,
  );

  await expectReject(
    "createTask rejects invalid assignedAgent",
    () => taskEngine.createTask({
      title: `Coverage Bad Agent ${runId}`,
      objective: "Should fail",
      phase: "C4",
      sourceOfTruth: `coverage:${runId}`,
      assignedAgent: "nonexistent_role",
      priority: "medium",
      acceptanceCriteria: ["Rejected"],
      createdBy: actor,
    }),
    /Invalid assignedAgent/i,
  );

  console.log("\n⚙️ Suite 4: C5 worker execution lock");
  const task = await taskEngine.createTask({
    title: `Coverage Worker Lock ${runId}`,
    objective: "Verify duplicate worker dispatch is denied by task lock",
    phase: "C5",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Duplicate execution is rejected before worker side effects"],
    founderApprovalRequired: false,
    createdBy: actor,
  });
  const redis = getRedisClient();
  const lockKey = `colony:worker:lock:${task.taskId}`;
  await redis.set(lockKey, "coverage-existing-lock", "EX", 60);
  await expectReject(
    "executeWorker rejects duplicate in-progress task lock",
    () => workerExecutor.executeWorker(task, "general", actor),
    /already in progress/i,
  );
  await redis.del(lockKey);

  console.log("\n🧭 Suite 5: Autonomous policy and scheduler queue");
  const riskyBuilderTask = await taskEngine.createTask({
    title: `Coverage Builder Patch ${runId}`,
    objective: "Patch code safely through proposal only",
    phase: "C5",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Founder approval is required"],
    founderApprovalRequired: false,
    createdBy: actor,
  });
  assert(
    riskyBuilderTask.founderApprovalRequired === true,
    "createTask forces founder approval for builder/code tasks",
  );

  const riskyPolicy = autonomousPolicy.assessTaskAutonomyPolicy(riskyBuilderTask);
  assert(
    riskyPolicy.executionMode === "founder_approval_required",
    "autonomous policy marks builder patch task as founder-gated",
    riskyPolicy.executionMode,
  );

  const safeReporterTask = await taskEngine.createTask({
    title: `Coverage Reporter Summary ${runId}`,
    objective: "Summarize current colony queue without code access",
    phase: "C4",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["Summary is recorded"],
    founderApprovalRequired: false,
    createdBy: actor,
  });
  assert(
    safeReporterTask.founderApprovalRequired === false,
    "createTask keeps low-risk reporter task autonomous",
  );

  // Clean up stale queued tasks from prior test runs to prevent flaky claims
  const queueRedis = getRedisClient();
  const staleQueuedIds = await queueRedis.smembers("colony:tasks:status:queued");
  for (const staleId of staleQueuedIds) {
    if (staleId !== safeReporterTask.taskId) {
      await queueRedis.srem("colony:tasks:status:queued", staleId);
      await queueRedis.zrem("colony:tasks:index", staleId);
      await queueRedis.srem("colony:tasks:agent:reporter", staleId);
    }
  }

  const firstClaim = await schedulerQueue.claimNextEligibleTask("reporter", `coverage-scheduler-${runId}`);
  assert(firstClaim.claim?.task.taskId === safeReporterTask.taskId, "scheduler claims eligible autonomous reporter task");
  assert(firstClaim.claim?.task.status === "planning", "scheduler claim moves task to planning");

  const secondClaim = await schedulerQueue.claimNextEligibleTask("reporter", `coverage-scheduler-${runId}-2`);
  assert(secondClaim.claim?.task.taskId !== safeReporterTask.taskId, "scheduler does not claim same task twice");
  if (firstClaim.claim) await schedulerQueue.releaseSchedulerClaim(firstClaim.claim);

  console.log("\n📰 Suite 6: Reporter engine period lock");
  // Delete any existing daily lock so the test is deterministic
  const reporterRedis = getRedisClient();
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  await reporterRedis.del(`colony:reporter:daily:${dayKey}`);

  const reporterResult1 = await reporterEngine.runReporter("daily", false);
  assert(reporterResult1.posted === true, "reporter first daily run posts successfully", `reason=${reporterResult1.reason ?? "posted"}`);
  const reporterResult2 = await reporterEngine.runReporter("daily", false);
  assert(reporterResult2.posted === false, "reporter second daily run blocked by period lock", `reason=${reporterResult2.reason}`);
  assert(reporterResult2.reason === "already_posted_for_period", "reporter period lock reason is correct", reporterResult2.reason);

  const reporterSummary = await reporterEngine.buildReporterSummary("daily");
  assert(typeof reporterSummary === "string" && reporterSummary.length > 100, "reporter summary is substantial string", `length=${reporterSummary.length}`);
  assert(reporterSummary.includes("Daily Colony Brief"), "reporter summary contains expected title");

  console.log("\n🛡️ Suite 7: Autonomous policy edge cases and scheduler dependency");

  // 7a: C5 reporter low-risk → autonomous
  const c5ReporterPolicy = autonomousPolicy.assessTaskAutonomyPolicy({
    assignedAgent: "reporter",
    phase: "C5",
    priority: "low",
    title: "Summarize colony queue status",
    objective: "Generate read-only summary for founder review",
  });
  assert(c5ReporterPolicy.executionMode === "autonomous_allowed", "C5 reporter low-risk → autonomous", c5ReporterPolicy.executionMode);
  assert(c5ReporterPolicy.riskLevel === "low", "C5 reporter risk level is low", c5ReporterPolicy.riskLevel);
  assert(c5ReporterPolicy.founderApprovalRequired === false, "C5 reporter does not require founder approval");

  // 7b: Builder with high-risk keyword → founder-gated
  const keywordPolicy = autonomousPolicy.assessTaskAutonomyPolicy({
    assignedAgent: "reporter",
    phase: "C4",
    priority: "low",
    title: "Apply security patch to auth module",
    objective: "Fix vulnerability",
  });
  assert(keywordPolicy.founderApprovalRequired === true, "High-risk keyword 'patch' triggers founder gate");
  assert(keywordPolicy.reasons.some((r) => r.startsWith("keyword:")), "Keyword reason present", keywordPolicy.reasons.join(","));

  // 7c: Critical priority → founder-gated regardless of agent
  const criticalPolicy = autonomousPolicy.assessTaskAutonomyPolicy({
    assignedAgent: "reporter",
    phase: "C4",
    priority: "critical",
    title: "Fix production outage",
  });
  assert(criticalPolicy.founderApprovalRequired === true, "Critical priority → founder-gated");
  assert(criticalPolicy.reasons.includes("priority:critical"), "Priority reason present");

  // 7d: Scheduler dependency blocking
  const parentTask = await taskEngine.createTask({
    title: `Coverage Parent Dep ${runId}`,
    objective: "Must complete before child can run",
    phase: "C4",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["Completed"],
    founderApprovalRequired: false,
    createdBy: actor,
  });
  const childTask = await taskEngine.createTask({
    title: `Coverage Child Dep ${runId}`,
    objective: "Depends on parent task",
    phase: "C4",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["Parent completes first"],
    founderApprovalRequired: false,
    createdBy: actor,
    dependencies: [parentTask.taskId],
  });

  // Child should be skipped while parent is not done
  // Scan multiple claims to find child in skipped list
  let childSkip = null;
  for (let scan = 0; scan < 10; scan++) {
    const scanClaim = await schedulerQueue.claimNextEligibleTask("reporter", `coverage-scan-${runId}-${scan}`);
    childSkip = scanClaim.skipped.find((s) => s.taskId === childTask.taskId);
    if (childSkip) break;
    // Release any claim we picked up so next scan can continue
    if (scanClaim.claim) await schedulerQueue.releaseSchedulerClaim(scanClaim.claim);
  }
  assert(childSkip !== undefined, "Child task skipped when parent not done", childSkip?.reason);
  assert(childSkip?.reason === `dependency_not_complete:${parentTask.taskId}`, "Skip reason is dependency_not_complete", childSkip?.reason);

  // Complete parent through valid state machine: planning → approved → running → review → done
  // Note: scheduler may have already moved parent to "planning" during claim scans above
  const parentCurrent = await taskEngine.getTask(parentTask.taskId);
  if (parentCurrent.status === "queued") {
    await taskEngine.updateTaskStatus(parentTask.taskId, "planning", actor, "planning");
  }
  await taskEngine.updateTaskStatus(parentTask.taskId, "approved", actor, "approved");
  await taskEngine.updateTaskStatus(parentTask.taskId, "running", actor, "started");
  await taskEngine.addEvidence(parentTask.taskId, { type: "file", description: "task completed", url: "test" });
  await taskEngine.updateTaskStatus(parentTask.taskId, "review", actor, "reviewing");
  await taskEngine.updateTaskStatus(parentTask.taskId, "done", actor, "completed");

  // Now child should be claimable
  const depClaim2 = await schedulerQueue.claimNextEligibleTask("reporter", `coverage-dep2-${runId}`);
  assert(depClaim2.claim?.task.taskId === childTask.taskId, "Child task claimed after parent done", depClaim2.claim?.task.taskId);
  if (depClaim2.claim) await schedulerQueue.releaseSchedulerClaim(depClaim2.claim);

  // 7e: GAP 9 — scheduler permission mismatch: code task assigned to reporter should be skipped
  const codeReporterTask = await taskEngine.createTask({
    title: `Implement new code feature ${runId}`,
    objective: "Build something that requires code permissions",
    phase: "C5",
    sourceOfTruth: `coverage:${runId}`,
    assignedAgent: "reporter",
    priority: "low",
    acceptanceCriteria: ["Code implemented"],
    founderApprovalRequired: false,
    createdBy: actor,
  });
  const permClaim = await schedulerQueue.claimNextEligibleTask("reporter", `coverage-perm-${runId}`);
  const permSkip = permClaim.skipped.find((s) => s.taskId === codeReporterTask.taskId);
  assert(permSkip !== undefined, "Code task skipped for reporter (permission mismatch)", permSkip?.reason);
  assert(permSkip?.reason === "agent_permission_mismatch:needs_code_permission", "Skip reason is agent_permission_mismatch", permSkip?.reason);
  if (permClaim.claim) await schedulerQueue.releaseSchedulerClaim(permClaim.claim);

  console.log("\n===============================================================");
  console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
  console.log("===============================================================");

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("\n💥 Coverage script crashed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectRedis().catch(() => undefined);
  });
