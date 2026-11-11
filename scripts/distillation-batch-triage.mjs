/**
 * JAGAT Distillation Batch Triage
 *
 * Tahap 1 — Auto-reject: semua record dengan flag `high_risk_training_signal`
 *            (test fixtures COG-3/COG-4, safety < 0.60)
 * Tahap 2 — Print summary: semua record sisa yang butuh founder review
 *
 * Usage:
 *   node scripts/distillation-batch-triage.mjs
 *   node scripts/distillation-batch-triage.mjs --dry-run   (preview saja, tidak reject)
 */

import "dotenv/config";

const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";
const DRY_RUN = process.argv.includes("--dry-run");

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "jagat-distillation-batch-triage",
  };
}

async function fetchPendingRecords() {
  const res = await fetch(
    `${BACKEND}/colony/distillation/records?status=needs_founder_review&limit=200`,
    { headers: authHeaders(), signal: AbortSignal.timeout(15_000) }
  );
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records ?? [];
}

async function rejectRecord(recordId, reason) {
  const res = await fetch(
    `${BACKEND}/colony/distillation/records/${recordId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "rejected", reviewNote: reason }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  return res.ok;
}

function isHighRisk(record) {
  const flags = record.screening?.flags ?? [];
  const safetyScore = record.screening?.safety ?? 1;
  return (
    flags.includes("high_risk_training_signal") ||
    safetyScore < 0.60 ||
    safetyScore === 0  // safety 0.00 = tidak aman, fixture atau error screening
  );
}

function isTestFixture(record) {
  const src = (record.contextSources ?? []).map(s => (s.source ?? "").toLowerCase()).join(" ");
  const q = (record.question ?? "").toLowerCase();
  const a = (record.answer ?? "").toLowerCase();
  return (
    src.includes("cog-3") || src.includes("cog-4") ||
    q.includes("token dan deploy secret") ||
    q.includes("token dan secret boleh") ||
    a.includes("sengaja mengandung sinyal high-risk") ||
    a.includes("sengaja menyebut token")
  );
}

async function main() {
  console.log("=".repeat(60));
  console.log("JAGAT Distillation Batch Triage");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "LIVE — will reject records"}`);
  console.log("=".repeat(60));

  const records = await fetchPendingRecords();
  console.log(`\nFound ${records.length} pending record(s).\n`);

  const highRisk = records.filter(r => isHighRisk(r) || isTestFixture(r));
  const cleanRecords = records.filter(r => !isHighRisk(r) && !isTestFixture(r));

  // ── Tahap 1: Auto-reject high-risk / test fixtures ─────────────────────────
  console.log(`\n── Tahap 1: Auto-Reject (${highRisk.length} records) ─────────────────`);
  let rejected = 0;
  let errors = 0;

  for (const record of highRisk) {
    const flags = record.screening?.flags ?? [];
    const safetyScore = (record.screening?.safety ?? 0).toFixed(2);
    const isFixture = isTestFixture(record);
    const reason = isFixture
      ? `Test fixture (COG-3/COG-4) dengan sinyal high-risk. Auto-reject batch triage.`
      : `Flag high_risk_training_signal aktif, safety score ${safetyScore} < 0.60. Auto-reject batch triage.`;

    console.log(`  [${DRY_RUN ? "DRY" : "REJECT"}] ${record.recordId}`);
    console.log(`          Tags: ${(record.tags ?? []).join(", ")} | Safety: ${safetyScore} | Flags: ${flags.join(", ") || "none"}`);
    console.log(`          Q: "${(record.question ?? "").slice(0, 80)}"`);

    if (!DRY_RUN) {
      const ok = await rejectRecord(record.recordId, reason);
      if (ok) {
        rejected++;
        console.log(`          → ❌ REJECTED`);
      } else {
        errors++;
        console.log(`          → ⚠️  ERROR (skip)`);
      }
    }
  }

  if (!DRY_RUN) {
    console.log(`\nAuto-reject selesai: ${rejected} ditolak, ${errors} error.\n`);
  } else {
    console.log(`\n[DRY RUN] Akan ditolak: ${highRisk.length} records.\n`);
  }

  // ── Tahap 2: Summary records yang butuh founder review ─────────────────────
  console.log(`\n── Tahap 2: Records Butuh Founder Review (${cleanRecords.length}) ──────`);

  if (cleanRecords.length === 0) {
    console.log("  ✅ Tidak ada record yang butuh review manual!");
  } else {
    for (let i = 0; i < cleanRecords.length; i++) {
      const r = cleanRecords[i];
      const safety = (r.screening?.safety ?? 0).toFixed(2);
      const grounding = (r.screening?.grounding ?? 0).toFixed(2);
      const overall = (r.screening?.overallScore ?? 0).toFixed(2);
      const flags = (r.screening?.flags ?? []).join(", ") || "none";
      console.log(`\n  [${i + 1}/${cleanRecords.length}] ${r.recordId}`);
      console.log(`  Tags: ${(r.tags ?? []).join(", ")}`);
      console.log(`  Overall: ${overall} | Safety: ${safety} | Grounding: ${grounding} | Flags: ${flags}`);
      console.log(`  Q: "${(r.question ?? "").slice(0, 100)}"`);
      console.log(`  A: "${(r.answer ?? "").slice(0, 120)}..."`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total pending     : ${records.length}`);
  console.log(`Auto-reject       : ${highRisk.length} (high-risk/test fixtures)`);
  console.log(`Butuh review      : ${cleanRecords.length}`);
  if (!DRY_RUN && rejected > 0) {
    console.log(`\nJalankan 'npm run distillation:review' untuk review ${cleanRecords.length} record sisanya.`);
  }
}

main().catch(err => {
  console.error("Triage failed:", err.message);
  process.exit(1);
});
