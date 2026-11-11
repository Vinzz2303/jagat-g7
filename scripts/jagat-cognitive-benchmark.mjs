/**
 * JAGAT Cognitive Benchmark — 10-Area Memory Test
 *
 * Menguji apakah JAGAT bisa menjawab dari memori Qdrant dengan benar untuk:
 * 1.  Arsitektur         — 4-layer JAGAT G7 stack
 * 2.  Roadmap            — Fase eksekusi Phase 1-6
 * 3.  Risiko             — Risk register aktif
 * 4.  Next Action        — Prioritas teknis berikutnya
 * 5.  Revenue/Commercial — Paket produk yang bisa dijual
 * 6.  Colony             — Colony unit dan peran
 * 7.  Agent Boundary     — Boundary Kiting AI / Ting AI / G7 Motherbox
 * 8.  Model Routing      — Garuda Ladder & routing decision
 * 9.  Coding Plan        — Patch engine dan decision log
 * 10. Identity           — Founder dan identitas JAGAT
 *
 * Setiap area diverifikasi dengan:
 * - contextSources (harus ada retrieval dari Qdrant)
 * - keyword check di jawaban
 * - optional citation extraction
 *
 * Optional auto-capture ke distillation pool (set COG4_AUTO_CAPTURE=true).
 *
 * Usage:
 *   node scripts/jagat-cognitive-benchmark.mjs
 *   COG4_AUTO_CAPTURE=true node scripts/jagat-cognitive-benchmark.mjs
 */

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "ops");

const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";
const AUTO_CAPTURE = process.env.COG4_AUTO_CAPTURE === "true";

// ── 10 Cognitive Areas ───────────────────────────────────────────────────────

const BENCHMARK_CASES = [
  {
    area: "1. Arsitektur",
    question: "Jelaskan arsitektur teknis JAGAT G7 — stack infrastruktur, layer memory, dan inference engine yang digunakan.",
    requiredKeywords: ["qdrant", "redis", "ollama", "express"],
    requiredSources: [], // any wave 1/2/3 source is acceptable
    mustHaveContext: true,
    timeoutMs: 250_000,
    tags: ["arsitektur", "infrastructure", "benchmark"],
    benchmarkName: "jagat-cognitive-arsitektur",
  },
  {
    area: "2. Roadmap",
    question: "Apa saja fase eksekusi JAGAT G7 dari Phase 1 sampai Phase 6? Sebutkan nama fase dan status masing-masing.",
    requiredKeywords: [["phase", "fase", "tahap"], ["sovereign", "berdaulat"]],
    requiredSources: [],
    mustHaveContext: true,
    tags: ["roadmap", "phase", "benchmark"],
    benchmarkName: "jagat-cognitive-roadmap",
  },
  {
    area: "3. Risiko Aktif",
    question: "Apa risiko aktif yang tercatat di JAGAT G7 Risk Register? Sebutkan minimal 3 risiko beserta statusnya.",
    requiredKeywords: [["r-", "risiko", "risk"], ["latency", "latensi", "kinerja", "mitigasi"]],
    requiredSources: [],
    mustHaveContext: true,
    tags: ["risk", "risk-register", "benchmark"],
    benchmarkName: "jagat-cognitive-risiko",
  },
  {
    area: "4. Next Action",
    question: "Apa prioritas teknis dan produk berikutnya untuk JAGAT G7? Sebutkan task mana yang harus dikerjakan dan mengapa.",
    requiredKeywords: [["backlog", "prioritas", "task", "tugas"], ["phase", "fase", "tahap"]],
    requiredSources: [],
    mustHaveContext: true,
    tags: ["next-action", "backlog", "benchmark"],
    benchmarkName: "jagat-cognitive-next-action",
  },
  {
    area: "5. Revenue & Commercial",
    question: "Paket produk apa saja yang bisa dijual JAGAT G7 sekarang, termasuk Website Cepat? Sebutkan nama paket, harga/biaya/pricing, dan delivery scope-nya.",
    requiredKeywords: ["paket", ["harga", "biaya", "pricing", "quoted_price"], ["website", "situs", "landing page"]],
    requiredSources: ["jagat-g7-commercial-readiness-minimum"],
    mustHaveContext: true,
    filters: { source: "jagat-g7-commercial-readiness-minimum" },
    tags: ["revenue", "commercial", "benchmark"],
    benchmarkName: "jagat-cognitive-revenue",
  },
  {
    area: "6. Colony & Unit",
    question: "Apa itu Colony JAGAT G7 dan apa saja unit-unit di dalamnya? Jawab dengan menyebut label unit planner, builder, reviewer, dan reporter secara eksplisit beserta perannya.",
    requiredKeywords: ["colony", ["planner", "perencana", "penyusun"], ["builder", "coder", "pembangun"], ["reviewer", "qa", "peninjau"], ["reporter", "laporan", "pelapor"]],
    requiredSources: [],
    mustHaveContext: true,
    tags: ["colony", "benchmark"],
    benchmarkName: "jagat-cognitive-colony",
  },
  {
    area: "7. Agent Boundary",
    question: "Apa perbedaan boundary antara Kiting AI, Ting AI, dan G7 Motherbox? Apa yang boleh dan tidak boleh dilakukan masing-masing?",
    requiredKeywords: ["kiting", "ting", "motherbox"],
    requiredSources: ["jagat-g7-agent-boundary-design"],
    mustHaveContext: true,
    tags: ["agent-boundary", "phase-4", "benchmark"],
    benchmarkName: "jagat-cognitive-agent-boundary",
  },
  {
    area: "8. Model Routing",
    question: "Berdasarkan jagat-garuda-ladder-results, ringkas hasil Garuda Ladder untuk 7B dan 14B: score 66/100 dan 67/100, level L2 Cakra, speed, serta rekomendasi tugas yang tepat.",
    requiredKeywords: ["garuda", ["l2", "cakra", "level 2", "level2", "66/100", "67/100"], "7b"],
    requiredSources: ["jagat-garuda-ladder-results"],
    mustHaveContext: true,
    filters: { source: "jagat-garuda-ladder-results" },
    tags: ["garuda-ladder", "model-routing", "benchmark"],
    benchmarkName: "jagat-cognitive-model-routing",
  },
  {
    area: "9. Coding Plan",
    question: "Bagaimana cara Colony mengajukan dan mereview patch kode? Apa saja keputusan penting yang sudah terkunci di Decision Log?",
    requiredKeywords: [["patch", "perbaikan", "perubahan kode"], ["decision", "keputusan", "d-"]],
    requiredSources: [],
    mustHaveContext: true,
    tags: ["coding-plan", "decision-log", "benchmark"],
    benchmarkName: "jagat-cognitive-coding-plan",
  },
  {
    area: "10. Identity & Sovereignty",
    question: "Siapa yang mendirikan JAGAT G7 dan apa visi utamanya? Jelaskan mengapa JAGAT menggunakan infrastruktur berdaulat sendiri.",
    requiredKeywords: [["faturachman", "kahfi", "founder", "pendiri"], ["berdaulat", "sovereign", "mandiri", "kedaulatan"]],
    requiredSources: [],
    mustHaveContext: false, // identity works even without context (LLM knows from system prompt)
    tags: ["identity", "sovereignty", "benchmark"],
    benchmarkName: "jagat-cognitive-identity",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "jagat-cognitive-benchmark",
  };
}

function extractSourceCitations(text) {
  const matches = text.matchAll(/\[Sumber:\s*([^\]]+)\]/gi);
  return [...new Set([...matches].map((m) => m[1].trim().toLowerCase()))];
}

async function runResearch(question, timeoutMs = 180_000, filters) {
  const response = await fetch(`${BACKEND}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: question, filters }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`/research failed (${response.status}): ${errorText}`);
  }

  const streamText = await response.text();
  const events = streamText
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.replace(/^data:\s*/m, ""))
    .map((payload) => {
      try {
        return JSON.parse(payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const metaEvent = events.find((event) => event.type === "meta");
  const doneEvent = [...events].reverse().find((event) => event.type === "done");
  const analysis = events
    .filter((event) => event.type === "token")
    .map((event) => String(event.data ?? ""))
    .join("");

  return {
    ...(metaEvent?.data ?? {}),
    analysis,
    response: analysis,
    timing: doneEvent?.data?.timing,
  };
}

function checkKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.map((kw) => {
    // Support synonym arrays: ["sovereign", "berdaulat"] = OR logic
    if (Array.isArray(kw)) {
      const found = kw.some((synonym) => lower.includes(synonym.toLowerCase()));
      const matchedSynonym = kw.find((synonym) => lower.includes(synonym.toLowerCase()));
      return {
        keyword: kw.join(" | "),
        found,
        matchedSynonym: matchedSynonym ?? null,
      };
    }
    return {
      keyword: kw,
      found: lower.includes(kw.toLowerCase()),
      matchedSynonym: lower.includes(kw.toLowerCase()) ? kw : null,
    };
  });
}

function checkSources(contextSources, requiredSources) {
  if (requiredSources.length === 0) return { checked: false, allPresent: true, found: [], missing: [] };
  const foundSources = contextSources.map((s) => s.source?.toLowerCase() ?? "");
  const found = requiredSources.filter((rs) => foundSources.some((fs) => fs.includes(rs)));
  const missing = requiredSources.filter((rs) => !found.includes(rs));
  return { checked: true, allPresent: missing.length === 0, found, missing };
}

async function captureToDistillation(caseConfig, answer, contextSources, score) {
  if (!AUTO_CAPTURE) return null;
  if (answer.length < 120) return null;
  if (/system prompt|DIREKTIF RISET|Threshold Kemiripan/i.test(answer)) return null;

  try {
    const citations = extractSourceCitations(answer);
    const normalizedSources = contextSources.map((s) => ({
      title: s.title,
      source: s.source,
      category: s.category,
      score: s.score,
      denseScore: s.denseScore,
      sparseScore: s.sparseScore,
      chunkIndex: s.chunkIndex,
      sectionTitle: s.sectionTitle,
      retrievalMode: s.retrievalMode,
      matchedKeywords: s.matchedKeywords,
    }));

    const created = await fetch(`${BACKEND}/colony/distillation/records`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        question: caseConfig.question,
        answer,
        contextSources: normalizedSources,
        citations,
        tags: [...new Set(["cognitive-benchmark", ...caseConfig.tags])],
        benchmarkName: caseConfig.benchmarkName,
        benchmarkPassed: score >= 0.6,
        score,
        notes: `Auto-captured from jagat-cognitive-benchmark. Area: ${caseConfig.area}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!created.ok) return null;
    const createdData = await created.json();
    const recordId = createdData.record?.recordId;
    if (!recordId) return null;

    // Screen immediately
    const screened = await fetch(`${BACKEND}/colony/distillation/records/${recordId}/screen`, {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    const screenedData = screened.ok ? await screened.json() : null;
    return {
      recordId,
      status: screenedData?.record?.status ?? "unknown",
      overallScore: screenedData?.record?.screening?.overallScore,
    };
  } catch {
    return null;
  }
}

// ── Main Benchmark Runner ────────────────────────────────────────────────────

async function runBenchmark() {
  console.log("=".repeat(60));
  console.log("JAGAT Cognitive Benchmark — 10 Area Memory Test");
  console.log(`Backend: ${BACKEND}`);
  console.log(`Auto-capture: ${AUTO_CAPTURE ? "ON" : "OFF"}`);
  console.log("=".repeat(60));
  console.log("");

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const caseConfig of BENCHMARK_CASES) {
    console.log(`\n── ${caseConfig.area} ──────────────────────────────────`);
    console.log(`Q: ${caseConfig.question.slice(0, 100)}...`);

    const startMs = Date.now();
    let result;

    try {
      const data = await runResearch(caseConfig.question, caseConfig.timeoutMs, caseConfig.filters);
      const elapsedMs = Date.now() - startMs;

      const answer = data.analysis ?? data.response ?? "";
      const contextSources = data.contextSources ?? [];
      const contextCount = data.contextDocumentsUsed ?? contextSources.length ?? 0;

      // Checks
      const keywordChecks = checkKeywords(answer, caseConfig.requiredKeywords);
      const sourceCheck = checkSources(contextSources, caseConfig.requiredSources);
      const hasContext = contextCount > 0;
      const contextPass = !caseConfig.mustHaveContext || hasContext;
      const keywordsPass = keywordChecks.every((k) => k.found);
      const sourcesPass = sourceCheck.allPresent;
      const passed = contextPass && keywordsPass && sourcesPass;

      // Score
      const keywordScore = keywordChecks.filter((k) => k.found).length / Math.max(1, keywordChecks.length);
      const contextScore = hasContext ? 1 : (caseConfig.mustHaveContext ? 0 : 0.5);
      const score = Math.round((keywordScore * 0.6 + contextScore * 0.4) * 100) / 100;

      // Print result
      console.log(`   Context docs: ${contextCount} | Time: ${elapsedMs}ms`);
      console.log(`   Keywords: ${keywordChecks.map((k) => `${k.found ? "✓" : "✗"} ${k.keyword}`).join(", ")}`);
      if (sourceCheck.checked) {
        console.log(`   Required sources: ${sourceCheck.found.join(", ") || "none"} | Missing: ${sourceCheck.missing.join(", ") || "none"}`);
      }
      console.log(`   Score: ${score} | ${passed ? "✅ PASS" : "❌ FAIL"}`);

      // Preview
      const preview = answer.replace(/\n+/g, " ").slice(0, 120);
      console.log(`   Preview: "${preview}..."`);

      // Auto-capture
      let capture = null;
      if (AUTO_CAPTURE && passed) {
        capture = await captureToDistillation(caseConfig, answer, contextSources, score);
        if (capture) {
          console.log(`   Distillation: ${capture.recordId} → ${capture.status} (score: ${capture.overallScore})`);
        }
      }

      if (passed) totalPassed += 1;
      else totalFailed += 1;

      result = {
        area: caseConfig.area,
        question: caseConfig.question,
        passed,
        score,
        contextDocumentsUsed: contextCount,
        keywordChecks,
        sourceCheck,
        answerLength: answer.length,
        elapsedMs,
        capture,
        answerPreview: answer.slice(0, 300),
      };
    } catch (error) {
      const elapsedMs = Date.now() - startMs;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ ERROR: ${msg}`);
      totalFailed += 1;

      result = {
        area: caseConfig.area,
        question: caseConfig.question,
        passed: false,
        score: 0,
        contextDocumentsUsed: 0,
        keywordChecks: [],
        sourceCheck: { checked: false, allPresent: false, found: [], missing: [] },
        answerLength: 0,
        elapsedMs,
        capture: null,
        error: msg,
        answerPreview: "",
      };
    }

    results.push(result);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const avgScore = Math.round((totalScore / results.length) * 100) / 100;

  console.log("\n" + "=".repeat(60));
  console.log("HASIL BENCHMARK");
  console.log("=".repeat(60));
  console.log(`PASS: ${totalPassed}/${results.length} | FAIL: ${totalFailed}/${results.length}`);
  console.log(`Average Score: ${avgScore}`);
  console.log(`Status: ${totalPassed === results.length ? "🏆 ALL PASS" : totalPassed >= 7 ? "✅ MAJORITY PASS" : "⚠️ NEEDS IMPROVEMENT"}`);
  console.log("=".repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.area} — score: ${r.score}, ctx: ${r.contextDocumentsUsed}, ${r.elapsedMs}ms`);
  }

  // ── Write Report ──────────────────────────────────────────────────────────
  const report = {
    benchmarkName: "jagat-cognitive-benchmark",
    generatedAt: new Date().toISOString(),
    backend: BACKEND,
    autoCaptureEnabled: AUTO_CAPTURE,
    summary: {
      total: results.length,
      passed: totalPassed,
      failed: totalFailed,
      averageScore: avgScore,
      status: totalPassed === results.length ? "all_pass" : totalPassed >= 7 ? "majority_pass" : "needs_improvement",
    },
    results,
  };

  const reportJsonPath = path.join(REPORT_DIR, "JAGAT_COGNITIVE_BENCHMARK_RESULTS.json");
  const reportMdPath = path.join(REPORT_DIR, "JAGAT_COGNITIVE_BENCHMARK_RESULTS.md");

  await writeFile(reportJsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(reportMdPath, renderMarkdownReport(report), "utf8");

  console.log(`\nReport: ${path.relative(ROOT, reportMdPath)}`);

  if (report.summary.status === "needs_improvement") {
    process.exit(1);
  }
}

function renderMarkdownReport(report) {
  const rows = report.results.map((r) =>
    `| ${r.area} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.score} | ${r.contextDocumentsUsed} | ${r.elapsedMs}ms |`
  );

  return [
    "# JAGAT Cognitive Benchmark Results",
    "",
    `Generated: ${report.generatedAt}`,
    `Backend: ${report.backend}`,
    `Auto-capture: ${report.autoCaptureEnabled ? "ON" : "OFF"}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Total Areas | ${report.summary.total} |`,
    `| Passed | ${report.summary.passed} |`,
    `| Failed | ${report.summary.failed} |`,
    `| Average Score | ${report.summary.averageScore} |`,
    `| Status | ${report.summary.status} |`,
    "",
    "## Results Per Area",
    "",
    "| Area | Result | Score | Context Docs | Time |",
    "| --- | --- | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Policy",
    "",
    "- Score >= 0.60 with contextDocs > 0 = PASS for grounded areas.",
    "- Identity area passes even without context (LLM sovereign identity).",
    "- Required sources must be present in contextSources for areas 5, 7, 8.",
    "- Run with COG4_AUTO_CAPTURE=true to send PASS answers to distillation pool.",
    "",
    "## Improvement Guide",
    "",
    "- FAIL on context (0 docs): Run Wave 3 ingest or check Qdrant health.",
    "- FAIL on keywords: Check if relevant documents are in Qdrant collection.",
    "- FAIL on required sources: Check if specific Wave 3 document was ingested.",
    "",
  ].join("\n");
}

runBenchmark().catch((error) => {
  console.error("Benchmark failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
