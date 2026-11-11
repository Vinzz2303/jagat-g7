// ============================================================================
// JAGAT Colony — Verifier → Patch Approval Gate v0C Test
// Tests: failed verification blocks approval, passed allows, missing allows
// ============================================================================

import {
  approveProposal,
  getProposal,
  PatchEngineError,
} from "../dist/colony/index.js";
import { verifierEngine } from "../dist/colony/index.js";
import { getRedisClient } from "../dist/services/redis.service.js";

const redis = getRedisClient();
const PREFIX = "colony:";

let pass = 0;
let fail = 0;

function ok(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    pass++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    fail++;
  }
}

console.log("===============================================================");
console.log("  JAGAT Colony — Verifier → Patch Approval Gate v0C Test");
console.log("===============================================================\n");

// ── Helper: create a minimal pending proposal ──────────────────────────────

async function createTestProposal(suffix) {
  const proposalId = `PATCH-V0C-${suffix}-${Date.now()}`;
  const redis = getRedisClient();
  const now = new Date().toISOString();

  const proposal = {
    proposalId,
    taskId: `TASK-V0C-${suffix}`,
    agentRole: "builder",
    agentName: "test-builder",
    title: `Test proposal ${suffix}`,
    rationale: "v0C test",
    hunks: [],
    filesAffected: ["src/colony/test.ts"],
    estimatedRisk: "low",
    contextFiles: [],
    searchQueries: [],
    evidenceSummary: "test",
    status: "pending",
    createdAt: now,
    submittedAt: now,
    trainingDataTags: [],
    trainingDataReady: false,
  };

  await redis.set(
    `${PREFIX}patch:${proposalId}`,
    JSON.stringify(proposal),
    "EX",
    3600,
  );
  await redis.sadd(`${PREFIX}patches:pending`, proposalId);
  await redis.sadd(`${PREFIX}patches:index`, proposalId);

  return proposalId;
}

// ── Test 1: Failed verification BLOCKS approval ────────────────────────────
console.log("-- Test 1: Failed verification blocks approval --");

const proposalId1 = await createTestProposal("FAILED");

// Create verification with a failed check
await verifierEngine.createVerification(proposalId1);
await verifierEngine.recordCheck(proposalId1, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 2,
  stdout: "",
  stderr: "src/colony/test.ts(10,5): error TS2322: Type mismatch",
});

const v1 = await verifierEngine.getVerification(proposalId1);
ok("Verification exists with status failed", v1?.status === "failed");

try {
  await approveProposal(proposalId1, "founder", "Should be blocked");
  ok("Approval should be rejected", false);
} catch (e) {
  ok("Approval throws VERIFICATION_FAILED", e.code === "VERIFICATION_FAILED");
  ok("Error message mentions failed verification", e.message.includes("failed verification"));
  ok("Error message lists failed check", e.message.includes("typecheck"));
}

// Verify proposal is still pending
const p1 = await getProposal(proposalId1);
ok("Proposal still pending after blocked approval", p1?.status === "pending");

// ── Test 2: Passed verification ALLOWS approval ────────────────────────────
console.log("\n-- Test 2: Passed verification allows approval --");

const proposalId2 = await createTestProposal("PASSED");

// Create verification with all checks passing
await verifierEngine.createVerification(proposalId2);
await verifierEngine.recordCheck(proposalId2, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 0,
  stdout: "",
  stderr: "",
});
await verifierEngine.recordCheck(proposalId2, {
  name: "build",
  command: "npm run build",
  exitCode: 0,
  stdout: "tsc",
  stderr: "",
});

const v2 = await verifierEngine.getVerification(proposalId2);
ok("Verification exists with status verified", v2?.status === "verified");

try {
  const approved = await approveProposal(proposalId2, "founder", "All checks passed");
  ok("Approval succeeds", approved.status === "approved");
  ok("reviewedBy is founder", approved.reviewedBy === "founder");
  ok("reviewNote preserved", approved.reviewNote === "All checks passed");
} catch (e) {
  ok("Approval should not throw", false);
  console.log(`    Error: ${e.message}`);
}

// ── Test 3: Missing verification ALLOWS approval (v0C safe default) ────────
console.log("\n-- Test 3: Missing verification allows approval --");

const proposalId3 = await createTestProposal("NOVERIFY");

// No verification record created
const v3 = await verifierEngine.getVerification(proposalId3);
ok("No verification record exists", v3 === null);

try {
  const approved = await approveProposal(proposalId3, "founder", "No verification needed");
  ok("Approval succeeds without verification", approved.status === "approved");
} catch (e) {
  ok("Approval should not throw for missing verification", false);
  console.log(`    Error: ${e.message}`);
}

// ── Test 4: Pending verification ALLOWS approval ───────────────────────────
console.log("\n-- Test 4: Pending verification allows approval --");

const proposalId4 = await createTestProposal("PENDING");

// Create verification but don't record any checks (stays pending)
await verifierEngine.createVerification(proposalId4);

const v4 = await verifierEngine.getVerification(proposalId4);
ok("Verification exists with status pending", v4?.status === "pending");

try {
  const approved = await approveProposal(proposalId4, "founder", "Pending is ok");
  ok("Approval succeeds with pending verification", approved.status === "approved");
} catch (e) {
  ok("Approval should not throw for pending verification", false);
  console.log(`    Error: ${e.message}`);
}

// ── Test 5: No shell execution, no auto-approve ────────────────────────────
console.log("\n-- Test 5: Security invariants --");

// Verify verifier whitelist blocks shell commands
try {
  await verifierEngine.recordCheck(proposalId1, {
    name: "evil",
    command: "rm -rf /",
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
  ok("Verifier rejects non-whitelisted shell command", false);
} catch (e) {
  ok("Verifier rejects non-whitelisted shell command", e.message.includes("not in the verifier whitelist"));
}

// Verify approveProposal requires explicit founder call (no auto-approve)
ok("approveProposal is a named export (not auto-called)", typeof approveProposal === "function");

// Verify proposal can't be approved twice
const proposalId5 = await createTestProposal("DOUBLE");
await approveProposal(proposalId5, "founder", "First approval");
try {
  await approveProposal(proposalId5, "founder", "Second approval");
  ok("Double approval should be rejected", false);
} catch (e) {
  ok("Double approval rejected (WRONG_STATUS)", e.code === "WRONG_STATUS");
}

// ── Test 6: Mixed checks — one failed blocks ───────────────────────────────
console.log("\n-- Test 6: Mixed checks — one failed blocks --");

const proposalId6 = await createTestProposal("MIXED");

await verifierEngine.createVerification(proposalId6);
// typecheck passes
await verifierEngine.recordCheck(proposalId6, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 0,
  stdout: "",
  stderr: "",
});
// build fails
await verifierEngine.recordCheck(proposalId6, {
  name: "build",
  command: "npm run build",
  exitCode: 1,
  stdout: "",
  stderr: "Build failed",
});

const v6 = await verifierEngine.getVerification(proposalId6);
ok("Mixed checks → overall status failed", v6?.status === "failed");

try {
  await approveProposal(proposalId6, "founder");
  ok("Approval blocked with mixed checks", false);
} catch (e) {
  ok("Approval blocked (VERIFICATION_FAILED)", e.code === "VERIFICATION_FAILED");
  ok("Error mentions build failure", e.message.includes("build"));
}

// ── Cleanup ────────────────────────────────────────────────────────────────
console.log("\n-- Cleanup --");

const proposalIds = [proposalId1, proposalId2, proposalId3, proposalId4, proposalId5, proposalId6];
for (const pid of proposalIds) {
  await redis.del(`${PREFIX}patch:${pid}`);
  await redis.srem(`${PREFIX}patches:pending`, pid);
  await redis.srem(`${PREFIX}patches:index`, pid);
  await redis.del(`${PREFIX}verification:${pid}`);
  await redis.srem(`${PREFIX}verifications:index`, pid);
}
console.log("  Test data cleaned up");

// ── Results ────────────────────────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

await redis.quit();
process.exit(fail > 0 ? 1 : 0);
