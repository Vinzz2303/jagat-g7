const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const REPORT_JSON = "ops/phase3f_reports/hybrid_search_smoke_report.json";
const REPORT_MD = "ops/phase3f_reports/HYBRID_SEARCH_SMOKE_REPORT.md";

async function readMeta(topic, filters) {
  const controller = new AbortController();
  const response = await fetch(`${BACKEND_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, filters }),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const parsed = JSON.parse(line.slice(6));
      if (parsed.type === "meta") {
        controller.abort();
        return parsed.data;
      }
    }
  }

  throw new Error("Meta event not received.");
}

function assertHybridMeta(name, meta, expected = {}) {
  if (!meta) throw new Error(`${name}: meta kosong.`);
  if (meta.retrievalMode !== "hybrid") throw new Error(`${name}: retrievalMode bukan hybrid.`);
  if (meta.contextDocumentsUsed < 1) throw new Error(`${name}: tidak ada context yang dipakai.`);
  if (!Array.isArray(meta.contextSources) || meta.contextSources.length < 1) {
    throw new Error(`${name}: contextSources kosong.`);
  }

  if (expected.category) {
    const bad = meta.contextSources.filter((source) => source.category !== expected.category);
    if (bad.length > 0) throw new Error(`${name}: filter category bocor: ${JSON.stringify(bad)}`);
  }

  const hasSignal = meta.contextSources.some((source) =>
    source.denseScore > 0 ||
    source.sparseScore > 0 ||
    source.retrievalMode === "hybrid" ||
    source.retrievalMode === "sparse" ||
    source.retrievalMode === "dense"
  );

  if (!hasSignal) throw new Error(`${name}: tidak ada dense/sparse signal.`);
}

const cases = [
  {
    name: "Hybrid retrieval umum",
    topic: "Qdrant Redis BFF Express.js",
  },
  {
    name: "Filter category milestone",
    topic: "Engineering Master System Prompt Berlapis Garuda 7",
    filters: { category: "milestone" },
    expected: { category: "milestone" },
  },
];

const results = [];

for (const item of cases) {
  const meta = await readMeta(item.topic, item.filters);
  assertHybridMeta(item.name, meta, item.expected);
  results.push({
    name: item.name,
    topic: item.topic,
    filters: item.filters ?? null,
    contextDocumentsUsed: meta.contextDocumentsUsed,
    retrievalMode: meta.retrievalMode,
    contextSources: meta.contextSources,
  });
  console.log(`PASS: ${item.name} (${meta.contextDocumentsUsed} fragmen)`);
}

await (await import("node:fs/promises")).mkdir("ops/phase3f_reports", { recursive: true });
await (await import("node:fs/promises")).writeFile(REPORT_JSON, JSON.stringify({
  phase: "3F",
  generated_at: new Date().toISOString(),
  status: "passed",
  cases: results,
}, null, 2), "utf8");
await (await import("node:fs/promises")).writeFile(REPORT_MD, [
  "# JAGAT G7 Phase 3F - Hybrid Search Smoke Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Summary",
  "",
  "- Status: passed",
  `- Cases: ${results.length}`,
  "- Retrieval mode: hybrid",
  "",
  "## Cases",
  "",
  "| Case | Context Used | Filters | Top Sources |",
  "| --- | ---: | --- | --- |",
  ...results.map((result) => {
    const topSources = result.contextSources
      .slice(0, 3)
      .map((source) => `${source.source}#${source.chunkIndex ?? "?"} (${source.retrievalMode})`)
      .join(", ");
    return `| ${result.name} | ${result.contextDocumentsUsed} | ${JSON.stringify(result.filters ?? {})} | ${topSources} |`;
  }),
  "",
].join("\n"), "utf8");

console.log("[Phase 3F] Hybrid search smoke passed.");
