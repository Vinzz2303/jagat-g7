// ============================================================================
// JAGAT Colony - Planner Lesson Context Smoke Test
// Tests: getPlannerLessonContext advisory retrieval for directive planning.
// ============================================================================

import { lessonEngine } from "../dist/colony/index.js";
import { getRedisClient } from "../dist/services/redis.service.js";

const redis = getRedisClient();
const PREFIX = "colony:";
const runKey = `t040${Date.now()}`;
const blockedMissionId = `MISSION-TEST-T040-BLOCKED-${runKey}`;
const qualityMissionId = `MISSION-TEST-T040-QUALITY-${runKey}`;
const blockedTaskIds = [`TASK-T040-BLOCKED-1-${runKey}`, `TASK-T040-BLOCKED-2-${runKey}`];
const qualityTaskIds = [`TASK-T040-QUALITY-1-${runKey}`, `TASK-T040-QUALITY-2-${runKey}`];

let pass = 0;
let fail = 0;

function ok(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}`);
    fail++;
  }
}

function makeMission(id, title, outcomeSummary, priority = "high") {
  return {
    id,
    title,
    objective: `T040 planner lesson context test ${runKey}`,
    phase: "C4",
    status: "completed",
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
    title: `T040 Task ${taskId}`,
    objective: `Validate planner lesson context ${runKey}`,
    phase: "C4",
    sourceOfTruth: "scripts/colony-planner-lesson-context-test.mjs",
    assignedAgent: "builder",
    status,
    priority: "medium",
    acceptanceCriteria: ["test criterion"],
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

async function seedMission(mission, taskIds, status, tags) {
  await redis.set(`${PREFIX}mission:${mission.id}`, JSON.stringify(mission));
  await redis.sadd(`${PREFIX}missions:index`, mission.id);

  for (const taskId of taskIds) {
    await redis.set(`${PREFIX}task:${taskId}`, JSON.stringify(makeTask(taskId, mission.id, status, tags)));
    await redis.zadd(`${PREFIX}tasks:index`, 50, taskId);
    await redis.sadd(`${PREFIX}tasks:status:${status}`, taskId);
  }

  return lessonEngine.createLessonFromMission(mission.id);
}

async function cleanup() {
  for (const missionId of [blockedMissionId, qualityMissionId]) {
    await redis.del(`${PREFIX}mission:${missionId}`);
    await redis.srem(`${PREFIX}missions:index`, missionId);
    const lessonIds = await redis.smembers(`${PREFIX}lessons:by_mission:${missionId}`);
    for (const lessonId of lessonIds) {
      await redis.del(`${PREFIX}lesson:${lessonId}`);
      await redis.srem(`${PREFIX}lessons:index`, lessonId);
      await redis.srem(`${PREFIX}lessons:by_mission:${missionId}`, lessonId);
    }
    await redis.del(`${PREFIX}lessons:by_mission:${missionId}`);
  }

  for (const taskId of [...blockedTaskIds, ...qualityTaskIds]) {
    await redis.del(`${PREFIX}task:${taskId}`);
    await redis.zrem(`${PREFIX}tasks:index`, taskId);
    for (const status of ["blocked", "done"]) {
      await redis.srem(`${PREFIX}tasks:status:${status}`, taskId);
    }
  }
}

console.log("===============================================================");
console.log("  JAGAT Colony - Planner Lesson Context Smoke Test");
console.log("===============================================================\n");

await cleanup();

const blockedSummary = {
  completedAt: new Date().toISOString(),
  totalTasks: 3,
  doneCount: 1,
  blockedCount: 2,
  reviewCount: 0,
  runningCount: 0,
  queuedCount: 0,
  archivedCount: 0,
  avgQualityScore: null,
  qualityScoreCount: 0,
  topQualityScore: null,
  lowestQualityScore: null,
  blockedReasons: [
    `[${blockedTaskIds[0]}] vendor api key missing ${runKey}`,
    `[${blockedTaskIds[1]}] vendor credential handoff missing ${runKey}`,
  ],
  summary: `Mission blocked by repeated vendor api key and credential handoff issues. Marker ${runKey}.`,
};

const qualitySummary = {
  completedAt: new Date().toISOString(),
  totalTasks: 2,
  doneCount: 2,
  blockedCount: 0,
  reviewCount: 0,
  runningCount: 0,
  queuedCount: 0,
  archivedCount: 0,
  avgQualityScore: 91,
  qualityScoreCount: 2,
  topQualityScore: 94,
  lowestQualityScore: 88,
  blockedReasons: [],
  summary: `Mission completed with stable acceptance criteria and reusable quality pattern. Marker quality${runKey}.`,
};

console.log("-- Seed completed missions and lessons --");
const blockedLesson = await seedMission(
  makeMission(blockedMissionId, `Planner Lesson Blocked ${runKey}`, blockedSummary, "critical"),
  blockedTaskIds,
  "blocked",
  ["vendor-api", runKey],
);
const qualityLesson = await seedMission(
  makeMission(qualityMissionId, `Planner Lesson Quality quality${runKey}`, qualitySummary, "high"),
  qualityTaskIds,
  "done",
  ["quality-pattern", `quality${runKey}`],
);

ok("blocked lesson category is blocked_pattern", blockedLesson.category === "blocked_pattern");
ok("quality lesson category is quality_high", qualityLesson.category === "quality_high");

console.log("\n-- Retrieve advisory lesson context --");
const taskCountBefore = await redis.zcard(`${PREFIX}tasks:index`);
const context = await lessonEngine.getPlannerLessonContext({
  directive: `buat planner integrasi vendor api key agar tidak blocked lagi ${runKey}`,
  limit: 3,
});
const taskCountAfter = await redis.zcard(`${PREFIX}tasks:index`);

ok("context storage is redis_only", context.storage === "redis_only");
ok("context action policy is advisory_only", context.actionPolicy === "advisory_only");
ok("returns at least one lesson", context.lessons.length >= 1);
ok("top lesson is blocked lesson", context.lessons[0]?.lessonId === blockedLesson.lessonId);
ok("top lesson relevance is positive", (context.lessons[0]?.relevanceScore ?? 0) > 0);
ok("top lesson has relevance reasons", (context.lessons[0]?.relevanceReasons.length ?? 0) > 0);
ok("retrieval does not create tasks", taskCountAfter === taskCountBefore);

console.log("\n-- Category filter --");
const qualityContext = await lessonEngine.getPlannerLessonContext({
  directive: `gunakan quality pattern quality${runKey}`,
  categories: ["quality_high"],
  limit: 3,
});

ok("quality filter returns a lesson", qualityContext.lessons.length >= 1);
ok("quality filter only returns quality_high", qualityContext.lessons.every((lesson) => lesson.category === "quality_high"));
ok("quality filter includes seeded quality lesson", qualityContext.lessons.some((lesson) => lesson.lessonId === qualityLesson.lessonId));

console.log("\n-- Cleanup --");
await cleanup();
console.log("  cleanup complete");

console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

process.exit(fail > 0 ? 1 : 0);
