#!/usr/bin/env node
/**
 * JAGAT Ops Health Check
 * Verifies the local runtime ports used by the founder/internal stack.
 */

const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const UI_URL = process.env.JAGAT_UI_URL ?? "http://127.0.0.1:50012";
const TIMEOUT_MS = Number(process.env.OPS_HEALTH_TIMEOUT_MS ?? 5000);

const checks = [
  {
    name: "Express BFF",
    url: `${BACKEND_URL}/health`,
    validate: async (res) => {
      if (!res.ok) return false;
      const body = await safeJson(res);
      return body?.status === "operational" || body?.status === "ok";
    },
  },
  {
    name: "Next.js UI",
    url: UI_URL,
    validate: async (res) => res.ok,
  },
  {
    name: "Colony API Auth Gate",
    url: `${BACKEND_URL}/colony/stats`,
    validate: async (res) => res.status === 401,
  },
  {
    name: "Qdrant Vector DB",
    url: "http://127.0.0.1:6333/collections",
    validate: async (res) => res.ok,
  },
];

let failed = 0;

console.log("===============================================================");
console.log("  JAGAT Runtime Health Check");
console.log("===============================================================");

for (const check of checks) {
  const started = performance.now();
  try {
    const res = await fetch(check.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ok = await check.validate(res.clone());
    const ms = Math.round(performance.now() - started);
    if (ok) {
      console.log(`  ✅ ${check.name} — ${res.status} (${ms}ms)`);
    } else {
      failed += 1;
      console.log(`  ❌ ${check.name} — unexpected status ${res.status} (${ms}ms)`);
    }
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ${check.name} — ${message}`);
  }
}

console.log("===============================================================");
console.log(`  Result: ${failed === 0 ? "PASS" : "FAIL"} (${checks.length - failed}/${checks.length})`);
console.log("===============================================================");

if (failed > 0) process.exitCode = 1;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
