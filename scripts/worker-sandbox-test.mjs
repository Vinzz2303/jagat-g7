// ============================================================================
// JAGAT Colony — Worker Sandbox Unit Test
// Tests pure functions: validatePatchPath, SandboxError, getSandboxConfig,
// byte tracking, formatWorkerReport — no Redis required.
// ============================================================================

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Import from compiled dist (same pattern as colony-engine-hardening-test)
const {
  validatePatchPath,
  SandboxError,
  JAGAT_ROOT,
  getSandboxConfig,
  getTaskBytesUsed,
  resetTaskBytes,
  formatWorkerReport,
} = require("../dist/colony/worker-sandbox.js");

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${name}`);
    failed++;
  }
}

function assertThrows(fn, expectedCode, name) {
  try {
    fn();
    console.log(`  ❌ FAIL  ${name} (expected throw, got none)`);
    failed++;
  } catch (err) {
    if (err instanceof SandboxError && (!expectedCode || err.code === expectedCode)) {
      console.log(`  ✅ PASS  ${name}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL  ${name} (expected code=${expectedCode}, got code=${err?.code}, message=${err?.message})`);
      failed++;
    }
  }
}

console.log("===============================================================");
console.log("  JAGAT Colony — Worker Sandbox Unit Test");
console.log("===============================================================\n");

// ── Suite 1: JAGAT_ROOT constant ───────────────────────────────────────────
console.log("🏠 Suite 1: JAGAT_ROOT constant");
assert(typeof JAGAT_ROOT === "string", "JAGAT_ROOT is a string");
assert(JAGAT_ROOT.includes("jagat"), "JAGAT_ROOT contains 'jagat'");
assert(!JAGAT_ROOT.includes("\\"), "JAGAT_ROOT uses forward slashes");

// ── Suite 2: getSandboxConfig ──────────────────────────────────────────────
console.log("\n⚙️  Suite 2: getSandboxConfig");
const config = getSandboxConfig();
assert(config.maxFileSize === 100 * 1024, "maxFileSize is 100KB");
assert(config.maxTaskBytes === 500 * 1024, "maxTaskBytes is 500KB");
assert(Array.isArray(config.blockedPatterns), "blockedPatterns is array");
assert(config.blockedPatterns.length > 10, "blockedPatterns has 10+ entries");
assert(config.blockedPatterns.includes(".env"), "blockedPatterns includes .env");
assert(config.blockedPatterns.includes(".git"), "blockedPatterns includes .git");
assert(config.blockedPatterns.includes("node_modules"), "blockedPatterns includes node_modules");
assert(Array.isArray(config.defaultAllowedRoots), "defaultAllowedRoots is array");
assert(config.allowedRootsByRole.builder !== undefined, "builder role has roots");
assert(config.allowedRootsByRole.reviewer !== undefined, "reviewer role has roots");
assert(config.allowedRootsByRole.researcher !== undefined, "researcher role has roots");
assert(config.allowedRootsByRole.planner !== undefined, "planner role has roots");

// ── Suite 3: validatePatchPath — valid paths ───────────────────────────────
console.log("\n✅ Suite 3: validatePatchPath — valid paths");
const validPath = validatePatchPath("src/colony/task-engine.ts", "builder");
assert(typeof validPath === "string", "returns normalized path string");
assert(validPath.includes("task-engine.ts"), "path contains file name");

const validOps = validatePatchPath("ops/colony-autonomous-log.md", "researcher");
assert(validOps.includes("colony-autonomous-log"), "researcher can access ops/");

const validPlanner = validatePatchPath("ops/DECISION_LOG.md", "planner");
assert(validPlanner.includes("decision_log"), "planner can access ops/");

const validUI = validatePatchPath("jagat-ui/src/app/page.tsx", "builder");
assert(validUI.includes("page.tsx"), "builder can access jagat-ui/src/");

// ── Suite 4: validatePatchPath — path traversal ────────────────────────────
console.log("\n🚫 Suite 4: validatePatchPath — path traversal");
assertThrows(() => validatePatchPath("../etc/passwd", "builder"), "PATH_OUTSIDE_SANDBOX", "traversal ../etc/passwd rejected");
assertThrows(() => validatePatchPath("src/../../../etc/passwd", "builder"), "PATH_OUTSIDE_SANDBOX", "deep traversal rejected");

// ── Suite 5: validatePatchPath — blocked patterns ──────────────────────────
console.log("\n🔒 Suite 5: validatePatchPath — blocked patterns");
assertThrows(() => validatePatchPath("src/.env", "builder"), "BLOCKED_PATTERN", ".env file blocked");
assertThrows(() => validatePatchPath("src/.git/config", "builder"), "BLOCKED_PATTERN", ".git directory blocked");
assertThrows(() => validatePatchPath("src/node_modules/foo.js", "builder"), "BLOCKED_PATTERN", "node_modules blocked");
assertThrows(() => validatePatchPath("src/server.key", "builder"), "BLOCKED_PATTERN", ".key extension blocked");
assertThrows(() => validatePatchPath("src/cert.pem", "builder"), "BLOCKED_PATTERN", ".pem extension blocked");
assertThrows(() => validatePatchPath("src/auth.ts", "builder"), "BLOCKED_PATTERN", "auth.ts blocked");
assertThrows(() => validatePatchPath("src/cookie-signer.ts", "builder"), "BLOCKED_PATTERN", "cookie-signer blocked");

// ── Suite 6: validatePatchPath — role-based access ─────────────────────────
console.log("\n🛡️  Suite 6: validatePatchPath — role-based access");
// Builder cannot access ops/
assertThrows(() => validatePatchPath("ops/DECISION_LOG.md", "builder"), "PATH_OUTSIDE_SANDBOX", "builder cannot access ops/");
// Reviewer cannot access ops/
assertThrows(() => validatePatchPath("ops/DECISION_LOG.md", "reviewer"), "PATH_OUTSIDE_SANDBOX", "reviewer cannot access ops/");
// Researcher CAN access ops/
assert(validatePatchPath("ops/DECISION_LOG.md", "researcher") !== null, "researcher can access ops/");
// Planner CAN access ops/
assert(validatePatchPath("ops/DECISION_LOG.md", "planner") !== null, "planner can access ops/");
// Unknown role uses default roots
assertThrows(() => validatePatchPath("ops/DECISION_LOG.md", "unknown_role"), "PATH_OUTSIDE_SANDBOX", "unknown role cannot access ops/");

// ── Suite 7: validatePatchPath — absolute path handling ────────────────────
console.log("\n📍 Suite 7: validatePatchPath — absolute path");
const absPath = validatePatchPath("C:/JAGAT/src/colony/types.ts", "builder");
assert(absPath.includes("types.ts"), "absolute Windows path accepted and normalized");

// ── Suite 8: SandboxError class ────────────────────────────────────────────
console.log("\n💥 Suite 8: SandboxError class");
const err = new SandboxError("test error", "BLOCKED_PATTERN");
assert(err instanceof Error, "SandboxError extends Error");
assert(err instanceof SandboxError, "instanceof SandboxError works");
assert(err.name === "SandboxError", "name is SandboxError");
assert(err.code === "BLOCKED_PATTERN", "code preserved");
assert(err.message === "test error", "message preserved");

// ── Suite 9: Byte tracking ─────────────────────────────────────────────────
console.log("\n📊 Suite 9: Byte tracking");
const testTaskId = "test-byte-tracking-" + Date.now();
resetTaskBytes(testTaskId);
assert(getTaskBytesUsed(testTaskId) === 0, "initial bytes is 0");

// ── Suite 10: formatWorkerReport ───────────────────────────────────────────
console.log("\n📝 Suite 10: formatWorkerReport");
const emptyReport = formatWorkerReport([]);
assert(emptyReport.includes("Tidak ada"), "empty report has info message");

const sampleReport = formatWorkerReport([
  { actionId: "WA-1", taskId: "t1", agentRole: "builder", type: "file_read", target: "src/foo.ts", status: "completed", timestamp: "2026-01-01T00:00:00Z", bytesRead: 1024, resultSummary: "Read 50 lines" },
  { actionId: "WA-2", taskId: "t1", agentRole: "builder", type: "search", target: "src/", status: "denied", timestamp: "2026-01-01T00:01:00Z", resultSummary: "Permission denied" },
]);
assert(sampleReport.includes("Worker Action Log"), "report has title");
assert(sampleReport.includes("2 operations"), "report has count");
assert(sampleReport.includes("file_read"), "report lists file_read");
assert(sampleReport.includes("1024B"), "report shows bytes");
assert(sampleReport.includes("✅"), "report has success emoji");
assert(sampleReport.includes("🚫"), "report has denied emoji");

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`  Results: ${passed} PASS / ${failed} FAIL`);
console.log("===============================================================");

process.exit(failed > 0 ? 1 : 0);
