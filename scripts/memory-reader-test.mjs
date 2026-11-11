// JAGAT Colony — Memory Reader Unit Test
// Tests pure functions: formatContextForChat, extractContextReferences, truncateContent

import { strict as assert } from "node:assert";

// Import from compiled dist
const mod = await import("../dist/colony/memory-reader.js");
const { formatContextForChat, extractContextReferences } = mod;

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ❌ FAIL  ${name}: ${e.message}`);
    fail++;
  }
}

console.log("JAGAT Colony — Memory Reader Unit Test\n");

// ── Suite 1: formatContextForChat ──────────────────────────────────────────

test("formatContextForChat with empty fragments returns no-results message", () => {
  const ctx = { query: "test", fragments: [], totalFound: 0, searchMs: 5, embeddingMs: 10, categories: ["blueprint"] };
  const result = formatContextForChat(ctx);
  assert.ok(result.includes("Tidak ditemukan"));
  assert.ok(result.includes("test"));
});

test("formatContextForChat with fragments returns formatted output", () => {
  const ctx = {
    query: "sovereign architecture",
    fragments: [
      { content: "Architecture overview", source: "blueprint.pdf", title: "Blueprint", category: "blueprint", score: 0.85, docType: "pdf", trustLevel: "high" },
    ],
    totalFound: 1, searchMs: 15, embeddingMs: 20, categories: ["blueprint"],
  };
  const result = formatContextForChat(ctx);
  assert.ok(result.includes("Blueprint"));
  assert.ok(result.includes("85.0%"));
  assert.ok(result.includes("blueprint.pdf"));
});

// ── Suite 2: extractContextReferences ──────────────────────────────────────

test("extractContextReferences returns lightweight refs", () => {
  const ctx = {
    query: "test",
    fragments: [
      { content: "long content here", source: "doc.md", title: "Doc", category: "milestone", score: 0.7234, docType: "md", trustLevel: "high" },
    ],
    totalFound: 1, searchMs: 5, embeddingMs: 10, categories: ["milestone"],
  };
  const refs = extractContextReferences(ctx);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].title, "Doc");
  assert.equal(refs[0].score, 0.723); // rounded to 3 decimals
  assert.equal(refs[0].category, "milestone");
  assert.equal(refs[0].source, "doc.md");
});

test("extractContextReferences with empty fragments returns empty array", () => {
  const ctx = { query: "test", fragments: [], totalFound: 0, searchMs: 0, embeddingMs: 0, categories: [] };
  const refs = extractContextReferences(ctx);
  assert.equal(refs.length, 0);
});

// ── Suite 3: formatContextForChat — edge cases ────────────────────────────

test("formatContextForChat with multiple fragments includes all titles", () => {
  const ctx = {
    query: "architecture",
    fragments: [
      { content: "First", source: "a.pdf", title: "Alpha", category: "blueprint", score: 0.9, docType: "pdf", trustLevel: "high" },
      { content: "Second", source: "b.pdf", title: "Beta", category: "roadmap", score: 0.8, docType: "pdf", trustLevel: "high" },
    ],
    totalFound: 2, searchMs: 10, embeddingMs: 5, categories: ["blueprint", "roadmap"],
  };
  const result = formatContextForChat(ctx);
  assert.ok(result.includes("Alpha"));
  assert.ok(result.includes("Beta"));
  assert.ok(result.includes("2/2"));
});

test("formatContextForChat with sectionTitle includes section marker", () => {
  const ctx = {
    query: "test",
    fragments: [
      { content: "Content", source: "doc.md", title: "Doc", category: "milestone", score: 0.75, docType: "md", trustLevel: "medium", sectionTitle: "Phase 3" },
    ],
    totalFound: 1, searchMs: 5, embeddingMs: 3, categories: ["milestone"],
  };
  const result = formatContextForChat(ctx);
  assert.ok(result.includes("§Phase 3"));
});

test("formatContextForChat without sectionTitle omits section marker", () => {
  const ctx = {
    query: "test",
    fragments: [
      { content: "Content", source: "doc.md", title: "Doc", category: "milestone", score: 0.75, docType: "md", trustLevel: "medium" },
    ],
    totalFound: 1, searchMs: 5, embeddingMs: 3, categories: ["milestone"],
  };
  const result = formatContextForChat(ctx);
  assert.ok(!result.includes("§"));
});

// ── Suite 4: extractContextReferences — multi-fragment precision ───────────

test("extractContextReferences rounds score to 3 decimals", () => {
  const ctx = {
    query: "test",
    fragments: [
      { content: "x", source: "s", title: "T", category: "c", score: 0.123456789, docType: "md", trustLevel: "high" },
    ],
    totalFound: 1, searchMs: 0, embeddingMs: 0, categories: [],
  };
  const refs = extractContextReferences(ctx);
  assert.equal(refs[0].score, 0.123);
});

test("extractContextReferences with multiple fragments returns all", () => {
  const ctx = {
    query: "test",
    fragments: [
      { content: "a", source: "s1", title: "T1", category: "c1", score: 0.9, docType: "md", trustLevel: "high" },
      { content: "b", source: "s2", title: "T2", category: "c2", score: 0.8, docType: "pdf", trustLevel: "medium" },
      { content: "c", source: "s3", title: "T3", category: "c3", score: 0.7, docType: "md", trustLevel: "high" },
    ],
    totalFound: 3, searchMs: 0, embeddingMs: 0, categories: [],
  };
  const refs = extractContextReferences(ctx);
  assert.equal(refs.length, 3);
  assert.equal(refs[0].title, "T1");
  assert.equal(refs[2].title, "T3");
});

console.log(`\nResults: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
