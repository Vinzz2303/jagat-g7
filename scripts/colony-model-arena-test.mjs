// ============================================================================
// JAGAT Colony — Model Arena v0 Smoke Test
// Tests: recordArenaResult, getArenaSummary, listArenaSummaries, getRecommendation
// ============================================================================

import { modelArena } from "../dist/colony/index.js";
import { getRedisClient } from "../dist/services/redis.service.js";

const redis = getRedisClient();

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
console.log("  JAGAT Colony — Model Arena v0 Smoke Test");
console.log("===============================================================\n");

// ── Pre-cleanup stale data from previous runs ───────────────────────────────
const staleIndex = await redis.smembers("colony:arena:index");
for (const entry of staleIndex) {
  const sepIdx = entry.indexOf("||");
  if (sepIdx < 0) continue;
  const mId = entry.slice(0, sepIdx);
  const tType = entry.slice(sepIdx + 2);
  await redis.del(`colony:arena:summary:${mId}:${tType}`);
  await redis.del(`colony:arena:records:${mId}:${tType}`);
  await redis.srem("colony:arena:index", entry);
}

// ── Test 1: Record results for model A ──────────────────────────────────────
console.log("-- Test 1: Record results --");

const e1 = await modelArena.recordArenaResult("qwen2.5-coder:7b", "coding", 85, 200, "benchmark");
ok("Entry created", !!e1);
ok("modelId matches", e1.modelId === "qwen2.5-coder:7b");
ok("taskType matches", e1.taskType === "coding");
ok("avgScore is 85", e1.avgScore === 85);
ok("avgLatencyMs is 200", e1.avgLatencyMs === 200);
ok("sampleCount is 1", e1.sampleCount === 1);
ok("recommendation mentions Strong", e1.recommendation.includes("Strong"));

// Record a second data point
const e1b = await modelArena.recordArenaResult("qwen2.5-coder:7b", "coding", 75, 250, "benchmark");
ok("sampleCount is 2", e1b.sampleCount === 2);
ok("avgScore is 80 ((85+75)/2)", e1b.avgScore === 80);
ok("avgLatencyMs is 225 ((200+250)/2)", e1b.avgLatencyMs === 225);

// ── Test 2: Record results for model B ──────────────────────────────────────
console.log("\n-- Test 2: Record results for model B --");

await modelArena.recordArenaResult("qwen2.5-coder:14b", "coding", 90, 400, "benchmark");
await modelArena.recordArenaResult("qwen2.5-coder:14b", "coding", 88, 380, "benchmark");

const summaryB = await modelArena.getArenaSummary("qwen2.5-coder:14b", "coding");
ok("Model B summary exists", !!summaryB);
ok("Model B avgScore is 89", summaryB.avgScore === 89);
ok("Model B sampleCount is 2", summaryB.sampleCount === 2);

// ── Test 3: Record for different task type ──────────────────────────────────
console.log("\n-- Test 3: Different task type --");

await modelArena.recordArenaResult("qwen2.5-coder:7b", "review", 60, 300, "runtime");

const reviewSummary = await modelArena.getArenaSummary("qwen2.5-coder:7b", "review");
ok("Review summary exists", !!reviewSummary);
ok("Review avgScore is 60", reviewSummary.avgScore === 60);
ok("Review recommendation mentions Acceptable", reviewSummary.recommendation.includes("Acceptable"));

// ── Test 4: getArenaSummary ─────────────────────────────────────────────────
console.log("\n-- Test 4: getArenaSummary --");

const summaryA = await modelArena.getArenaSummary("qwen2.5-coder:7b", "coding");
ok("Model A coding summary exists", !!summaryA);
ok("Model A avgScore is 80", summaryA.avgScore === 80);

const noSummary = await modelArena.getArenaSummary("nonexistent:model", "coding");
ok("Non-existent returns null", noSummary === null);

// ── Test 5: listArenaSummaries ──────────────────────────────────────────────
console.log("\n-- Test 5: listArenaSummaries --");

const allSummaries = await modelArena.listArenaSummaries();
ok("All summaries ≥ 3", allSummaries.length >= 3);

const codingOnly = await modelArena.listArenaSummaries("coding");
ok("Coding summaries = 2", codingOnly.length === 2);
ok("Sorted by score desc (first is higher)", codingOnly[0].avgScore >= codingOnly[1].avgScore);

const reviewOnly = await modelArena.listArenaSummaries("review");
ok("Review summaries = 1", reviewOnly.length === 1);

// ── Test 6: getRecommendation ───────────────────────────────────────────────
console.log("\n-- Test 6: getRecommendation --");

const codingRec = await modelArena.getRecommendation("coding");
ok("Coding recommendation exists", !!codingRec);
ok("Best model is 14b (higher score)", codingRec.modelId === "qwen2.5-coder:14b");
ok("avgScore is 89", codingRec.avgScore === 89);
ok("reason is advisory", codingRec.reason.includes("Advisory only"));

const noRec = await modelArena.getRecommendation("nonexistent_type");
ok("No data returns null", noRec === null);

// ── Test 7: Score clamping ──────────────────────────────────────────────────
console.log("\n-- Test 7: Score clamping --");

await modelArena.recordArenaResult("test:model", "clamp_test", 150, -10, "manual");
const clamped = await modelArena.getArenaSummary("test:model", "clamp_test");
ok("Score clamped to 100", clamped.avgScore === 100);
ok("Latency clamped to 0", clamped.avgLatencyMs === 0);

// ── Test 8: Weak recommendation ─────────────────────────────────────────────
console.log("\n-- Test 8: Weak recommendation --");

await modelArena.recordArenaResult("weak:model", "coding", 40, 500, "manual");
const weakSummary = await modelArena.getArenaSummary("weak:model", "coding");
ok("Weak recommendation mentions Weak", weakSummary.recommendation.includes("Weak"));

// ── Test 9: Runtime event recording (T-043) ─────────────────────────────────
console.log("\n-- Test 9: Runtime event recording (T-043) --");

await modelArena.recordRuntimeEvent("qwen2.5-coder:7b", "C5", 1234, {
  taskId: "TASK-TEST-001",
  agentRole: "builder",
  outcome: "success",
  source: "test",
});
await modelArena.recordRuntimeEvent("qwen2.5-coder:7b", "C5", 567, {
  taskId: "TASK-TEST-002",
  agentRole: "reporter",
  outcome: "failed",
  source: "test",
  errorCode: "timeout",
});
await modelArena.recordRuntimeEvent("llama3", "C4", 890);

const events = await modelArena.getRuntimeEvents(10);
ok("Runtime events returned", events.length >= 3);
ok("First event has eventId", typeof events[0].eventId === "string" && events[0].eventId.startsWith("runtime_"));
ok("First event has modelId", events[0].modelId === "llama3"); // most recent first
ok("First event has latency", events[0].latencyMs === 890);
ok("First event defaults outcome success", events[0].outcome === "success");
ok("First event defaults source worker-executor", events[0].source === "worker-executor");
ok("Second event has taskId", events[1].taskId === "TASK-TEST-002");
ok("Second event records failed outcome", events[1].outcome === "failed");
ok("Second event records safe errorCode", events[1].errorCode === "timeout");
ok("Third event has agentRole", events[2].agentRole === "builder");
ok("All events have recordedAt", events.every((e) => e.recordedAt));
ok("No raw prompt/output captured", events.every((e) => !("prompt" in e) && !("output" in e) && !("response" in e)));

// ── Test 10: Runtime event edge cases ────────────────────────────────────────
console.log("\n-- Test 10: Runtime event edge cases --");

await modelArena.recordRuntimeEvent("test:model", "test", -100); // negative latency
const edgeEvents = await modelArena.getRuntimeEvents(1);
ok("Negative latency clamped to 0", edgeEvents[0].latencyMs === 0);

// ── Cleanup ────────────────────────────────────────────────────────────────
console.log("\n-- Cleanup --");

const keys = [
  "qwen2.5-coder:7b||coding",
  "qwen2.5-coder:14b||coding",
  "qwen2.5-coder:7b||review",
  "test:model||clamp_test",
  "weak:model||coding",
];

for (const key of keys) {
  const sepIdx = key.indexOf("||");
  const mId = key.slice(0, sepIdx);
  const tType = key.slice(sepIdx + 2);
  await redis.del(`colony:arena:summary:${mId}:${tType}`);
  await redis.del(`colony:arena:records:${mId}:${tType}`);
  await redis.srem("colony:arena:index", key);
}

// Clean up runtime events
await redis.del("colony:arena:runtime:events");

console.log("  ✅ Test data cleaned up");

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

process.exit(fail > 0 ? 1 : 0);
