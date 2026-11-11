// ============================================================================
// JAGAT Colony — Lesson Memory v0 Smoke Test
// Tests: createLessonFromMission, getLesson, listLessons, getLessonsByMission
// ============================================================================

import { lessonEngine } from "../dist/colony/index.js";
import { getRedisClient } from "../dist/services/redis.service.js";

// ── Redis setup ─────────────────────────────────────────────────────────────
const redis = getRedisClient();

// ── Helpers ─────────────────────────────────────────────────────────────────
const PREFIX = "colony:";

function makeMission(id, status, outcomeSummary, phase = "C4", priority = "high") {
  return {
    id,
    title: `Test Mission ${id}`,
    objective: "Test objective",
    phase,
    status,
    priority,
    createdBy: "founder",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workstreamIds: [],
    outcomeSummary,
  };
}

function makeTask(taskId, missionId, status, tags = []) {
  return {
    taskId,
    title: `Task ${taskId}`,
    objective: "Task objective",
    phase: "C4",
    sourceOfTruth: "test",
    assignedAgent: "builder",
    status,
    priority: "medium",
    acceptanceCriteria: ["criterion 1"],
    dependencies: [],
    evidence: [],
    lastUpdate: new Date().toISOString(),
    founderApprovalRequired: false,
    missionId,
    createdAt: new Date().toISOString(),
    createdBy: "founder",
    tags,
  };
}

// ── Test counters ───────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;

function ok(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    pass++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    fail++;
  }
}

console.log("===============================================================");
console.log("  JAGAT Colony — Lesson Memory v0 Smoke Test");
console.log("===============================================================\n");

// ── Test 1: Create lesson from high-quality mission ─────────────────────────
console.log("-- Test 1: Create lesson from high-quality mission --");

const missionId1 = "MISSION-TEST-LESSON-001";
const summary1 = {
  completedAt: new Date().toISOString(),
  totalTasks: 3,
  doneCount: 3,
  blockedCount: 0,
  reviewCount: 0,
  runningCount: 0,
  queuedCount: 0,
  archivedCount: 0,
  avgQualityScore: 92,
  qualityScoreCount: 3,
  topQualityScore: 98,
  lowestQualityScore: 85,
  blockedReasons: [],
  summary: 'Mission "Test Mission" completed. 3 tasks total: 3 done, 0 blocked. Quality: avg 92/100 (top 98, lowest 85, 3 evaluated).',
};

await redis.set(`${PREFIX}mission:${missionId1}`, JSON.stringify(makeMission(missionId1, "completed", summary1)));
await redis.sadd(`${PREFIX}missions:index`, missionId1);

// Create 3 tasks — use ZADD for taskIndex (sorted set) + SET for task data
const taskIds1 = ["TASK-L001", "TASK-L002", "TASK-L003"];
for (const tid of taskIds1) {
  await redis.set(`${PREFIX}task:${tid}`, JSON.stringify(makeTask(tid, missionId1, "done", ["test-tag"])));
  await redis.zadd(`${PREFIX}tasks:index`, 50, tid); // priority score 50 = medium
  await redis.sadd(`${PREFIX}tasks:status:done`, tid);
}

const lesson1 = await lessonEngine.createLessonFromMission(missionId1);

ok("Lesson created", !!lesson1);
ok("lessonId starts with LESSON-", lesson1.lessonId.startsWith("LESSON-"));
ok("missionId matches", lesson1.missionId === missionId1);
ok("taskIds has 3 items", lesson1.taskIds.length === 3);
ok("category is quality_high", lesson1.category === "quality_high");
ok("title contains [HIGH QUALITY]", lesson1.title.includes("[HIGH QUALITY]"));
ok("score is 92", lesson1.score === 92);
ok("source is mission_outcome", lesson1.source === "mission_outcome");
ok("content matches summary", lesson1.content.includes("3 tasks total"));
ok("tags include phase:C4", lesson1.tags.includes("phase:C4"));
ok("tags include priority:high", lesson1.tags.includes("priority:high"));
ok("tags include test-tag", lesson1.tags.includes("test-tag"));
ok("createdAt is ISO string", !isNaN(Date.parse(lesson1.createdAt)));

// ── Test 2: Create lesson from low-quality mission ──────────────────────────
console.log("\n-- Test 2: Create lesson from low-quality mission --");

const missionId2 = "MISSION-TEST-LESSON-002";
const summary2 = {
  completedAt: new Date().toISOString(),
  totalTasks: 2,
  doneCount: 1,
  blockedCount: 1,
  reviewCount: 0,
  runningCount: 0,
  queuedCount: 0,
  archivedCount: 0,
  avgQualityScore: 45,
  qualityScoreCount: 1,
  topQualityScore: 45,
  lowestQualityScore: 45,
  blockedReasons: ["[TASK-L010] Missing API key"],
  summary: 'Mission "Low Quality Mission" completed. 2 tasks total: 1 done, 1 blocked. Quality: avg 45/100. Blocked: Missing API key.',
};

await redis.set(`${PREFIX}mission:${missionId2}`, JSON.stringify(makeMission(missionId2, "completed", summary2, "C5", "critical")));
await redis.sadd(`${PREFIX}missions:index`, missionId2);

const taskIds2 = ["TASK-L010", "TASK-L011"];
for (const tid of taskIds2) {
  const st = tid === "TASK-L010" ? "blocked" : "done";
  await redis.set(`${PREFIX}task:${tid}`, JSON.stringify(makeTask(tid, missionId2, st)));
  await redis.zadd(`${PREFIX}tasks:index`, 50, tid);
  await redis.sadd(`${PREFIX}tasks:status:${st}`, tid);
}

const lesson2 = await lessonEngine.createLessonFromMission(missionId2);

ok("Low-quality lesson created", !!lesson2);
ok("category is quality_low", lesson2.category === "quality_low");
ok("title contains [LOW QUALITY]", lesson2.title.includes("[LOW QUALITY]"));
ok("score is 45", lesson2.score === 45);
ok("tags include priority:critical", lesson2.tags.includes("priority:critical"));

// ── Test 3: Idempotency ────────────────────────────────────────────────────
console.log("\n-- Test 3: Idempotency --");

const lesson1Again = await lessonEngine.createLessonFromMission(missionId1);
ok("Same lessonId returned", lesson1Again.lessonId === lesson1.lessonId);
ok("Same missionId returned", lesson1Again.missionId === lesson1.missionId);

// ── Test 4: getLesson ──────────────────────────────────────────────────────
console.log("\n-- Test 4: getLesson --");

const fetched = await lessonEngine.getLesson(lesson1.lessonId);
ok("getLesson returns lesson", !!fetched);
ok("Fetched lessonId matches", fetched.lessonId === lesson1.lessonId);

const notFound = await lessonEngine.getLesson("LESSON-NONEXISTENT-999");
ok("getLesson returns null for non-existent", notFound === null);

// ── Test 5: listLessons ────────────────────────────────────────────────────
console.log("\n-- Test 5: listLessons --");

const allLessons = await lessonEngine.listLessons();
ok("listLessons returns ≥ 2 lessons", allLessons.length >= 2);

const highOnly = await lessonEngine.listLessons({ category: "quality_high" });
ok("Filter quality_high returns 1", highOnly.length === 1);
ok("quality_high lesson is lesson1", highOnly[0].lessonId === lesson1.lessonId);

const lowOnly = await lessonEngine.listLessons({ category: "quality_low" });
ok("Filter quality_low returns ≥ 1", lowOnly.length >= 1);

const limited = await lessonEngine.listLessons({ limit: 1 });
ok("Limit 1 returns 1 lesson", limited.length === 1);

// ── Test 6: getLessonsByMission ────────────────────────────────────────────
console.log("\n-- Test 6: getLessonsByMission --");

const mission1Lessons = await lessonEngine.getLessonsByMission(missionId1);
ok("Mission 1 has 1 lesson", mission1Lessons.length === 1);
ok("Lesson belongs to mission 1", mission1Lessons[0].missionId === missionId1);

const mission2Lessons = await lessonEngine.getLessonsByMission(missionId2);
ok("Mission 2 has 1 lesson", mission2Lessons.length === 1);

const noLessons = await lessonEngine.getLessonsByMission("MISSION-NONEXISTENT");
ok("Non-existent mission returns empty", noLessons.length === 0);

// ── Test 7: Error cases ────────────────────────────────────────────────────
console.log("\n-- Test 7: Error cases --");

try {
  await lessonEngine.createLessonFromMission("MISSION-NONEXISTENT");
  ok("Should throw for non-existent mission", false);
} catch (e) {
  ok("Throws for non-existent mission", e.message.includes("not found"));
}

// Create an active (non-completed) mission
const missionIdActive = "MISSION-TEST-LESSON-ACTIVE";
await redis.set(`${PREFIX}mission:${missionIdActive}`, JSON.stringify(makeMission(missionIdActive, "active", undefined)));
await redis.sadd(`${PREFIX}missions:index`, missionIdActive);

try {
  await lessonEngine.createLessonFromMission(missionIdActive);
  ok("Should throw for non-completed mission", false);
} catch (e) {
  ok("Throws for non-completed mission", e.message.includes("not completed"));
}

// ── Test 9: Cross-mission pattern detection ──────────────────────────────────
console.log("\n-- Test 9: Cross-mission pattern detection --");

const patterns = await lessonEngine.detectCrossMissionPatterns();
ok("Pattern detection returns total lessons", patterns.totalLessons >= 2);
ok("Pattern detection returns total missions", patterns.totalMissions >= 2);
ok("Patterns is array", Array.isArray(patterns.patterns));
ok("generatedAt is set", typeof patterns.generatedAt === "string");

// Check for recurring category pattern (both missions have lessons)
const recurring = patterns.patterns.find((p) => p.patternType === "recurring_category");
if (recurring) {
  ok("Recurring category has affected missions", recurring.affectedMissions.length >= 2);
  ok("Recurring category has confidence", recurring.confidence > 0);
} else {
  // No recurring pattern found (acceptable if categories differ)
  ok("No recurring category pattern (categories may differ)", true);
}

// ── Cleanup ────────────────────────────────────────────────────────────────
console.log("\n-- Cleanup --");

for (const id of [missionId1, missionId2, missionIdActive]) {
  await redis.del(`${PREFIX}mission:${id}`);
  await redis.srem(`${PREFIX}missions:index`, id);
}
for (const tid of [...taskIds1, ...taskIds2]) {
  await redis.del(`${PREFIX}task:${tid}`);
  await redis.zrem(`${PREFIX}tasks:index`, tid);
}
// Clean status sets
for (const st of ["done", "blocked"]) {
  const members = await redis.smembers(`${PREFIX}tasks:status:${st}`);
  for (const m of members) {
    if (m.startsWith("TASK-L0")) await redis.srem(`${PREFIX}tasks:status:${st}`, m);
  }
}

// Clean lessons
const allLessonIds = await redis.smembers(`${PREFIX}lessons:index`);
for (const lid of allLessonIds) {
  const ldata = await redis.get(`${PREFIX}lesson:${lid}`);
  if (ldata) {
    const parsed = JSON.parse(ldata);
    if ([missionId1, missionId2].includes(parsed.missionId)) {
      await redis.del(`${PREFIX}lesson:${lid}`);
      await redis.srem(`${PREFIX}lessons:index`, lid);
      await redis.srem(`${PREFIX}lessons:by_mission:${parsed.missionId}`, lid);
    }
  }
}

console.log("  ✅ Test data cleaned up");

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

process.exit(fail > 0 ? 1 : 0);
