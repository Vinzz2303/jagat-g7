/**
 * T-042 Context Benchmark — Retrieval Precision Smoke Test
 * 
 * Validates Qdrant collections, point counts, metadata integrity,
 * and basic search relevance. Advisory only — does not gate deployment.
 * 
 * Usage: node scripts/context-benchmark-retrieval.mjs
 */

import http from "node:http";
const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    }).on("error", reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = new URL(url);
    const req = http.request({
      hostname: opts.hostname, port: opts.port, path: opts.pathname,
      method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, reason) { failed++; console.log(`  ❌ ${label}: ${reason}`); }

async function run() {
  console.log("=== Context Benchmark — Retrieval Precision Smoke Test ===\n");

  // 1. Qdrant health
  console.log("--- Qdrant Health ---");
  try {
    const { status } = await httpGet(`${QDRANT_URL}/healthz`);
    if (status === 200) ok("Qdrant reachable");
    else fail("Qdrant health", `status ${status}`);
  } catch (e) {
    fail("Qdrant health", e.message);
    console.log("\n❌ Cannot reach Qdrant. Aborting.\n");
    process.exit(1);
  }

  // 2. List collections
  console.log("\n--- Collections ---");
  const { status: colStatus, data: colData } = await httpGet(`${QDRANT_URL}/collections`);
  if (colStatus !== 200 || !colData?.result?.collections) {
    fail("List collections", `status ${colStatus}`);
    process.exit(1);
  }
  const collections = colData.result.collections;
  if (collections.length > 0) ok(`${collections.length} collection(s) found`);
  else fail("Collections exist", "0 collections");

  // 3. Per-collection stats
  console.log("\n--- Collection Stats ---");
  let totalPoints = 0;
  for (const col of collections) {
    const name = col.name;
    const { status, data } = await httpGet(`${QDRANT_URL}/collections/${name}`);
    if (status === 200 && data?.result) {
      const pts = data.result.points_count ?? 0;
      const vecSize = data.result.config?.params?.vectors?.size ?? "unknown";
      totalPoints += pts;
      console.log(`  📦 ${name}: ${pts} points, vector dim ${vecSize}`);
    } else {
      fail(`Collection ${name} stats`, `status ${status}`);
    }
  }
  if (totalPoints > 0) ok(`Total ${totalPoints} points across all collections`);
  else fail("Total points", "0 points in all collections");

  // 4. Sample metadata check
  console.log("\n--- Metadata Integrity ---");
  const sampleCol = collections[0]?.name;
  if (sampleCol) {
    const { status, data } = await httpPost(`${QDRANT_URL}/collections/${sampleCol}/points/scroll`,
      { limit: 5, with_payload: true, with_vector: false });
    if (status === 200 && data?.result?.points) {
      const points = data.result.points;
      let withSource = 0;
      let withCategory = 0;
      let withTitle = 0;
      for (const pt of points) {
        const pl = pt.payload || {};
        if (pl.source || pl.provenance) withSource++;
        if (pl.category) withCategory++;
        if (pl.title) withTitle++;
      }
      if (points.length > 0) ok(`${points.length} sample points retrieved from ${sampleCol}`);
      if (withSource > 0) ok(`${withSource}/${points.length} points have source/provenance`);
      else fail("Source metadata", `0/${points.length} points have source/provenance`);
      if (withCategory > 0) ok(`${withCategory}/${points.length} points have category`);
      else console.log(`  ⚠️  ${withCategory}/${points.length} points have category (may be normal)`);
      if (withTitle > 0) ok(`${withTitle}/${points.length} points have title`);
      else console.log(`  ⚠️  ${withTitle}/${points.length} points have title (may be normal)`);
    } else {
      fail("Scroll sample", `status ${status}`);
    }
  }

  // 5. Search relevance
  console.log("\n--- Search Relevance ---");
  const searchCol = collections.find(c => c.name.includes("jagat") || c.name.includes("memory") || c.name.includes("default"))?.name || sampleCol;
  if (searchCol) {
    const { status, data } = await httpPost(`${QDRANT_URL}/collections/${searchCol}/points/scroll`, {
      limit: 3,
      with_payload: true,
      with_vector: false,
      filter: {
        should: [
          { key: "category", match: { text: "technical" } },
          { key: "category", match: { text: "operational" } },
          { key: "source", match: { text: "JAGAT" } },
        ],
      },
    });
    if (status === 200 && data?.result?.points?.length > 0) {
      ok(`Filtered search returned ${data.result.points.length} result(s) from ${searchCol}`);
      for (const pt of data.result.points.slice(0, 3)) {
        const pl = pt.payload || {};
        console.log(`    → id=${pt.id?.slice?.(0, 12) || pt.id}... source=${pl.source || "n/a"} category=${pl.category || "n/a"} title=${(pl.title || "n/a").slice(0, 50)}`);
      }
    } else {
      console.log(`  ⚠️  No filtered results (may need different collection or filter terms)`);
    }
  }

  // Summary
  console.log("\n===============================================================");
  console.log(`  Result: ${passed} PASS / ${failed} FAIL`);
  console.log("===============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
