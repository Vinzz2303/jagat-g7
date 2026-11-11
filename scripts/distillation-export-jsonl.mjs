/**
 * Distillation Export — JSONL format
 * Exports all accepted + auto_accepted distillation records as training data.
 *
 * Usage: node scripts/distillation-export-jsonl.mjs
 *   Output piped to stdout as JSONL, redirect to file as needed.
 */

import "dotenv/config";

const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";
const FORMAT = process.env.EXPORT_FORMAT ?? "jsonl";

const response = await fetch(`${BACKEND}/colony/distillation/export?format=${FORMAT}`, {
  headers: {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "cli-export",
  },
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  const errorText = await response.text().catch(() => response.statusText);
  console.error(`Export failed (${response.status}): ${errorText}`);
  process.exit(1);
}

const text = await response.text();
process.stdout.write(text);
