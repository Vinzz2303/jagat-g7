/**
 * Distillation Pool Summary
 * Tampilkan ringkasan pool: total records, per-status count, top tags, exportable.
 *
 * Usage:
 *   node scripts/distillation-pool-summary.mjs
 */

import "dotenv/config";

const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "distillation-pool-summary",
  };
}

async function fetchRecords(status, limit = 100) {
  const url = status
    ? `${BACKEND}/colony/distillation/records?status=${status}&limit=${limit}`
    : `${BACKEND}/colony/distillation/records?limit=${limit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Distillation API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.records ?? [];
}

async function fetchExportStats() {
  const response = await fetch(`${BACKEND}/colony/distillation/export`, {
    method: "GET",
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.stats ?? null;
}

function countTags(records) {
  const tagCount = new Map();
  for (const record of records) {
    for (const tag of record.tags ?? []) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }
  return [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => `${tag} (${count})`);
}

async function main() {
  console.log("=".repeat(60));
  console.log("JAGAT Distillation Pool Summary");
  console.log(`Backend: ${BACKEND}`);
  console.log("=".repeat(60));

  const statuses = ["pending_review", "auto_accepted", "needs_founder_review", "accepted", "rejected"];
  const counts = {};
  let allRecords = [];

  for (const status of statuses) {
    try {
      const records = await fetchRecords(status);
      counts[status] = records.length;
      allRecords = [...allRecords, ...records];
    } catch {
      counts[status] = 0;
    }
  }

  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  const exportable = (counts["accepted"] ?? 0) + (counts["auto_accepted"] ?? 0);
  const exportStats = await fetchExportStats().catch(() => null);

  const topTags = countTags(allRecords);

  console.log("\n📊 STATUS COUNTS");
  for (const [status, count] of Object.entries(counts)) {
    const bar = "█".repeat(Math.min(count, 30));
    console.log(`  ${status.padEnd(24)} ${String(count).padStart(4)} ${bar}`);
  }
  console.log(`  ${"TOTAL".padEnd(24)} ${String(total).padStart(4)}`);

  console.log("\n✅ EXPORTABLE FOR TRAINING");
  console.log(`  accepted + auto_accepted: ${exportable} records`);
  if (exportStats) {
    console.log(`  Unique tags in export:    ${exportStats.uniqueTags?.length ?? 0}`);
  }

  if (topTags.length > 0) {
    console.log("\n🏷️  TOP TAGS");
    for (const tag of topTags) {
      console.log(`  ${tag}`);
    }
  }

  console.log("\n💡 NEXT STEPS");
  if (counts["needs_founder_review"] > 0) {
    console.log(`  ⚠️  ${counts["needs_founder_review"]} record(s) awaiting founder review → Colony UI /colony tab`);
  }
  if (counts["pending_review"] > 0) {
    console.log(`  🔄 ${counts["pending_review"]} record(s) not yet screened → POST /colony/distillation/records/:id/screen`);
  }
  if (exportable === 0) {
    console.log("  📭 Pool is empty — run cognitive benchmark to populate.");
    console.log("     COG4_AUTO_CAPTURE=true node scripts/jagat-cognitive-benchmark.mjs");
  } else {
    console.log(`  📦 ${exportable} record(s) ready to export as training data.`);
    console.log("     GET /colony/distillation/export?format=jsonl");
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((error) => {
  console.error("Summary failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
