// ============================================================================
// JAGAT Context Budget Manager Smoke Test
// Tests T-042: source priority, trust, recency, token/char budget, and dedupe.
// ============================================================================

import {
  selectContextWithinBudget,
  scoreContextCandidate,
} from "../dist/services/context-budget-manager.js";

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

function candidate(overrides) {
  return {
    content: "JAGAT context fragment content.",
    source: "ops/unknown.md",
    title: "Unknown",
    category: "product",
    trustLevel: "internal_draft",
    createdAt: "2026-01-01",
    score: 0.75,
    ...overrides,
  };
}

const now = new Date("2026-06-10T00:00:00.000Z");

console.log("===============================================================");
console.log("  JAGAT Context Budget Manager Smoke Test");
console.log("===============================================================\n");

console.log("-- Test 1: strategic metadata can outrank raw score --");
const strategic = candidate({
  source: "ops/DECISION_LOG.md",
  title: "Decision Log",
  category: "decision",
  trustLevel: "founder_verified",
  createdAt: "2026-06-08",
  score: 0.7,
});
const noisy = candidate({
  source: "external/blog.md",
  title: "External Note",
  category: "commercial",
  trustLevel: "external_reference",
  createdAt: "2024-01-01",
  score: 0.92,
});
const result1 = selectContextWithinBudget([noisy, strategic], {
  maxFragments: 2,
  maxChars: 1_000,
  minScore: 0.5,
  now,
});
ok("decision/founder context selected first", result1.selected[0]?.source === "ops/DECISION_LOG.md");
ok("strategic final score is higher than noisy score", scoreContextCandidate(strategic, { now }) > scoreContextCandidate(noisy, { now }));

console.log("\n-- Test 2: maxFragments is enforced --");
const result2 = selectContextWithinBudget([
  candidate({ source: "ops/A.md", chunkIndex: 0, score: 0.9 }),
  candidate({ source: "ops/B.md", chunkIndex: 0, score: 0.88 }),
  candidate({ source: "ops/C.md", chunkIndex: 0, score: 0.86 }),
], {
  maxFragments: 2,
  maxChars: 1_000,
  minScore: 0.5,
  now,
});
ok("only two fragments selected", result2.selected.length === 2);
ok("one fragment rejected by budget", result2.rejected.some((item) => item.reason === "budget_exhausted"));

console.log("\n-- Test 3: maxChars is enforced --");
const result3 = selectContextWithinBudget([
  candidate({ source: "ops/short.md", chunkIndex: 0, content: "short content", score: 0.8 }),
  candidate({ source: "ops/large.md", chunkIndex: 0, content: "x".repeat(300), score: 0.79 }),
], {
  maxFragments: 5,
  maxChars: 100,
  minScore: 0.5,
  now,
});
ok("short fragment is selected", result3.selected.some((item) => item.source === "ops/short.md"));
ok("large fragment rejected by char budget", result3.rejected.some((item) => item.item.source === "ops/large.md" && item.reason === "budget_exhausted"));

console.log("\n-- Test 4: recency boosts otherwise similar candidates --");
const recent = candidate({ source: "ops/recent.md", chunkIndex: 0, createdAt: "2026-06-09", score: 0.72 });
const old = candidate({ source: "ops/old.md", chunkIndex: 0, createdAt: "2023-01-01", score: 0.72 });
const result4 = selectContextWithinBudget([old, recent], {
  maxFragments: 2,
  maxChars: 1_000,
  minScore: 0.5,
  now,
});
ok("recent candidate wins tie", result4.selected[0]?.source === "ops/recent.md");

console.log("\n-- Test 5: duplicate source chunk is rejected --");
const result5 = selectContextWithinBudget([
  candidate({ source: "ops/duplicate.md", chunkIndex: 1, score: 0.85 }),
  candidate({ source: "ops/duplicate.md", chunkIndex: 1, score: 0.84 }),
], {
  maxFragments: 5,
  maxChars: 1_000,
  minScore: 0.5,
  now,
});
ok("only one duplicate chunk selected", result5.selected.length === 1);
ok("duplicate rejection recorded", result5.rejected.some((item) => item.reason === "duplicate_source_chunk"));

console.log(`\nResult: ${pass} passed, ${fail} failed.`);
if (fail > 0) {
  process.exit(1);
}
