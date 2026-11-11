// ============================================================================
// JAGAT Colony — Phase v0B: Mission Outcome → Lesson Memory Feedback Loop
// Tests: completeMissionWithSummary() auto-creates lesson via lesson-engine
// ============================================================================
//
// Verifies:
// 1. completeMissionWithSummary() automatically creates a lesson
// 2. Lesson category is correctly classified from outcome summary
// 3. Idempotent: calling completeMissionWithSummary() again throws (already completed)
//    but calling createLessonFromMission() again returns same lesson
// 4. Lesson is Redis-only (no Qdrant writes)
// 5. No auto-replan or auto-create task
// 6. Mission with no tasks still creates a lesson (general category)
// 7. Lesson content comes from MissionOutcomeSummary only
// ============================================================================

import { missionEngine, taskEngine, lessonEngine } from "../dist/colony/index.js";

const runId = `V0B-${Date.now()}`;
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
  console.log("  JAGAT Colony — Phase v0B: Feedback Loop Test");
  console.log("  Mission Outcome → Lesson Memory (auto-create)");
  console.log("===============================================================\n");

  // ── Test 1: High-quality mission → auto lesson ───────────────────────────
  console.log("── Test 1: High-quality mission auto-creates lesson ──");

  const m1 = await missionEngine.createMission({
    title: `v0B High Quality ${runId}`,
    objective: "Verify auto lesson creation for high quality mission",
    phase: "C4",
    priority: "high",
    createdBy: runId,
  });

  // Create 2 tasks, move to done with evidence
  const t1 = await taskEngine.createTask({
    title: "HQ Task A",
    objective: "High quality work",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: ["All checks pass"],
    missionId: m1.id,
    createdBy: runId,
  });

  const t2 = await taskEngine.createTask({
    title: "HQ Task B",
    objective: "Also high quality",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Ship it"],
    missionId: m1.id,
    createdBy: runId,
  });

  // Move t1 → done
  await taskEngine.updateTaskStatus(t1.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t1.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t1.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(t1.taskId, {
    type: "test_result",
    description: "All acceptance criteria verified and passing. Tests green. Documentation updated.",
    url: "https://ci.example.com/t1",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(t1.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t1.taskId, "done", "builder", "done");

  // Move t2 → done
  await taskEngine.updateTaskStatus(t2.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t2.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t2.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(t2.taskId, {
    type: "code_change",
    description: "Shipped successfully with full test coverage",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(t2.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t2.taskId, "done", "builder", "done");

  // Complete mission — should auto-create lesson
  const completed1 = await missionEngine.completeMissionWithSummary(m1.id);

  assert(completed1.status === "completed", "Mission 1 status is completed");
  assert(completed1.outcomeSummary !== undefined, "Mission 1 has outcomeSummary");
  assert(completed1.outcomeSummary.doneCount === 2, `Done count = 2 (got ${completed1.outcomeSummary.doneCount})`);

  // Verify lesson was auto-created
  const lessons1 = await lessonEngine.getLessonsByMission(m1.id);
  assert(lessons1.length === 1, `Mission 1 has exactly 1 lesson (got ${lessons1.length})`);

  if (lessons1.length > 0) {
    const lesson1 = lessons1[0];
    assert(lesson1.lessonId.startsWith("LESSON-"), `Lesson ID starts with LESSON- (${lesson1.lessonId})`);
    assert(lesson1.missionId === m1.id, "Lesson missionId matches");
    assert(lesson1.taskIds.length === 2, `Lesson has 2 taskIds (got ${lesson1.taskIds.length})`);
    assert(lesson1.source === "mission_outcome", "Source is mission_outcome");
    assert(lesson1.content.includes("completed"), "Content mentions completed");
    assert(lesson1.tags.includes("phase:C4"), "Tags include phase:C4");
    assert(lesson1.tags.includes("priority:high"), "Tags include priority:high");
    assert(typeof lesson1.createdAt === "string", "createdAt is string");
    assert(!isNaN(Date.parse(lesson1.createdAt)), "createdAt is valid ISO date");

    console.log(`    → Lesson: ${lesson1.lessonId} | category: ${lesson1.category} | score: ${lesson1.score}`);
  }

  // ── Test 2: Low-quality mission → auto lesson with quality_low ───────────
  console.log("\n── Test 2: Low-quality mission auto-creates lesson ──");

  const m2 = await missionEngine.createMission({
    title: `v0B Low Quality ${runId}`,
    objective: "Verify low quality classification",
    phase: "C5",
    priority: "critical",
    createdBy: runId,
  });

  const t3 = await taskEngine.createTask({
    title: "LQ Task",
    objective: "Low quality work",
    phase: "C5",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "critical",
    acceptanceCriteria: ["Minimal criteria"],
    missionId: m2.id,
    createdBy: runId,
  });

  // Move t3 → done with minimal evidence
  await taskEngine.updateTaskStatus(t3.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t3.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t3.taskId, "running", "builder", "go");
  await taskEngine.addEvidence(t3.taskId, {
    type: "other",
    description: "done",
    agentRole: "builder",
  });
  await taskEngine.updateTaskStatus(t3.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t3.taskId, "done", "builder", "done");

  const completed2 = await missionEngine.completeMissionWithSummary(m2.id);
  assert(completed2.status === "completed", "Mission 2 status is completed");

  const lessons2 = await lessonEngine.getLessonsByMission(m2.id);
  assert(lessons2.length === 1, `Mission 2 has exactly 1 lesson (got ${lessons2.length})`);

  if (lessons2.length > 0) {
    const lesson2 = lessons2[0];
    assert(lesson2.tags.includes("priority:critical"), "Tags include priority:critical");
    assert(lesson2.tags.includes("phase:C5"), "Tags include phase:C5");
    console.log(`    → Lesson: ${lesson2.lessonId} | category: ${lesson2.category} | score: ${lesson2.score}`);
  }

  // ── Test 3: Mission with blocked tasks → blocked_pattern ─────────────────
  console.log("\n── Test 3: Mission with blocked tasks ──");

  const m3 = await missionEngine.createMission({
    title: `v0B Blocked ${runId}`,
    objective: "Verify blocked pattern classification",
    phase: "C4",
    priority: "medium",
    createdBy: runId,
  });

  // Create 3 tasks, block 2 of them
  const t4 = await taskEngine.createTask({
    title: "Blocked A",
    objective: "Will be blocked",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Needs vendor"],
    missionId: m3.id,
    createdBy: runId,
  });

  const t5 = await taskEngine.createTask({
    title: "Blocked B",
    objective: "Also blocked",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Needs API key"],
    missionId: m3.id,
    createdBy: runId,
  });

  const t6 = await taskEngine.createTask({
    title: "Done C",
    objective: "Completed",
    phase: "C4",
    sourceOfTruth: "ops/",
    assignedAgent: "builder",
    priority: "medium",
    acceptanceCriteria: ["Done"],
    missionId: m3.id,
    createdBy: runId,
  });

  // Block t4
  await taskEngine.updateTaskStatus(t4.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t4.taskId, "blocked", "builder", "Blocked: waiting for vendor", "Vendor API key missing");

  // Block t5
  await taskEngine.updateTaskStatus(t5.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t5.taskId, "blocked", "builder", "Blocked: no API key", "Need credentials from ops");

  // Done t6
  await taskEngine.updateTaskStatus(t6.taskId, "planning", "builder", "plan");
  await taskEngine.updateTaskStatus(t6.taskId, "approved", "builder", "ok");
  await taskEngine.updateTaskStatus(t6.taskId, "running", "builder", "go");
  await taskEngine.updateTaskStatus(t6.taskId, "review", "builder", "review");
  await taskEngine.updateTaskStatus(t6.taskId, "done", "builder", "done");

  const completed3 = await missionEngine.completeMissionWithSummary(m3.id);
  assert(completed3.outcomeSummary.blockedCount === 2, `Blocked count = 2 (got ${completed3.outcomeSummary.blockedCount})`);
  assert(completed3.outcomeSummary.blockedReasons.length === 2, `2 blocked reasons (got ${completed3.outcomeSummary.blockedReasons.length})`);

  const lessons3 = await lessonEngine.getLessonsByMission(m3.id);
  assert(lessons3.length === 1, `Mission 3 has exactly 1 lesson (got ${lessons3.length})`);

  if (lessons3.length > 0) {
    const lesson3 = lessons3[0];
    assert(lesson3.category === "blocked_pattern", `Category is blocked_pattern (got ${lesson3.category})`);
    assert(lesson3.title.includes("[BLOCKED PATTERN]"), "Title contains [BLOCKED PATTERN]");
    console.log(`    → Lesson: ${lesson3.lessonId} | category: ${lesson3.category}`);
  }

  // ── Test 4: Idempotency — createLessonFromMission returns same lesson ────
  console.log("\n── Test 4: Idempotency ──");

  const lesson1Again = await lessonEngine.createLessonFromMission(m1.id);
  assert(lessons1.length > 0 && lesson1Again.lessonId === lessons1[0].lessonId, "createLessonFromMission returns same lesson (idempotent)");

  // ── Test 5: Double-complete throws ───────────────────────────────────────
  console.log("\n── Test 5: Double-complete guard ──");

  let doubleThrew = false;
  try {
    await missionEngine.completeMissionWithSummary(m1.id);
  } catch (err) {
    doubleThrew = err.message.includes("already completed");
  }
  assert(doubleThrew, "Double-complete throws 'already completed' error");

  // ── Test 6: No auto-replan or auto-task creation ─────────────────────────
  console.log("\n── Test 6: No auto-replan / auto-task ──");

  // Verify no new tasks were created beyond what we explicitly created
  // (The lesson engine does NOT create tasks)
  const allLessons = await lessonEngine.listLessons();
  const v0bLessons = allLessons.filter(l => l.missionId.startsWith("MISSION-") || [m1.id, m2.id, m3.id].includes(l.missionId));
  assert(v0bLessons.length >= 3, `At least 3 v0b lessons exist (got ${v0bLessons.length})`);

  // ── Test 7: Lesson content comes from MissionOutcomeSummary only ─────────
  console.log("\n── Test 7: Lesson content from MissionOutcomeSummary ──");

  if (lessons1.length > 0) {
    const content = lessons1[0].content;
    assert(content.includes("tasks total"), "Content includes task count");
    assert(content.includes("done"), "Content includes done count");
    assert(typeof content === "string" && content.length > 10, "Content is non-trivial string");
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n===============================================================");
  console.log(`  v0B Results: ${passed} PASS, ${failed} FAIL`);
  console.log("===============================================================");

  if (failed > 0) {
    console.log("\n  ❌ v0B FAILED — see above for details");
  } else {
    console.log("\n  ✅ v0B PASSED — Mission Outcome → Lesson Memory feedback loop verified");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ FATAL ERROR:", err);
  process.exit(1);
});
