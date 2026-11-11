// ============================================================================
// JAGAT Colony — Verifier Gate v0 Smoke Test
// Tests: createVerification, recordCheck, getVerification, isProposalVerified,
//        suggestVerificationCommands, whitelist enforcement
// ============================================================================

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
console.log("  JAGAT Colony — Verifier Gate v0 Smoke Test");
console.log("===============================================================\n");

// ── Test 1: Create verification ─────────────────────────────────────────────
console.log("-- Test 1: Create verification --");

const proposalId1 = "PATCH-TEST-VERIFY-001";
const v1 = await verifierEngine.createVerification(proposalId1);

ok("Verification created", !!v1);
ok("proposalId matches", v1.proposalId === proposalId1);
ok("status is pending", v1.status === "pending");
ok("checks is empty array", v1.checks.length === 0);
ok("verifiedAt is null", v1.verifiedAt === null);
ok("createdAt is ISO string", !isNaN(Date.parse(v1.createdAt)));

// Idempotency
const v1Again = await verifierEngine.createVerification(proposalId1);
ok("Idempotent: same proposalId returned", v1Again.proposalId === proposalId1);

// ── Test 2: Record passing check ────────────────────────────────────────────
console.log("\n-- Test 2: Record passing check --");

const v2 = await verifierEngine.recordCheck(proposalId1, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 0,
  stdout: "(no output)",
  stderr: "",
  executedAt: new Date().toISOString(),
});

ok("After typecheck pass: status is verified", v2.status === "verified");
ok("verifiedAt is set", v2.verifiedAt !== null);
ok("1 check recorded", v2.checks.length === 1);
ok("Check name is typecheck", v2.checks[0].name === "typecheck");
ok("Check passed is true", v2.checks[0].passed === true);
ok("Check exitCode is 0", v2.checks[0].exitCode === 0);

// ── Test 3: Record failing check ────────────────────────────────────────────
console.log("\n-- Test 3: Record failing check --");

const proposalId2 = "PATCH-TEST-VERIFY-002";
await verifierEngine.createVerification(proposalId2);

const v3 = await verifierEngine.recordCheck(proposalId2, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 2,
  stdout: "",
  stderr: "src/colony/test.ts(10,5): error TS2322: Type mismatch",
  executedAt: new Date().toISOString(),
});

ok("After typecheck fail: status is failed", v3.status === "failed");
ok("verifiedAt is null", v3.verifiedAt === null);
ok("Check passed is false", v3.checks[0].passed === false);
ok("stderr preserved", v3.checks[0].stderr.includes("TS2322"));

// ── Test 4: Multiple checks — mixed results ─────────────────────────────────
console.log("\n-- Test 4: Multiple checks --");

const proposalId3 = "PATCH-TEST-VERIFY-003";
await verifierEngine.createVerification(proposalId3);

// First check passes
await verifierEngine.recordCheck(proposalId3, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 0,
  stdout: "",
  stderr: "",
});

// Second check fails
const v4 = await verifierEngine.recordCheck(proposalId3, {
  name: "build",
  command: "npm run build",
  exitCode: 1,
  stdout: "",
  stderr: "Build error",
});

ok("2 checks recorded", v4.checks.length === 2);
ok("Overall status is failed (one check failed)", v4.status === "failed");

// ── Test 5: All checks pass ─────────────────────────────────────────────────
console.log("\n-- Test 5: All checks pass --");

const proposalId4 = "PATCH-TEST-VERIFY-004";
await verifierEngine.createVerification(proposalId4);

await verifierEngine.recordCheck(proposalId4, {
  name: "typecheck",
  command: "npm run typecheck",
  exitCode: 0,
  stdout: "",
  stderr: "",
});

const v5 = await verifierEngine.recordCheck(proposalId4, {
  name: "build",
  command: "npm run build",
  exitCode: 0,
  stdout: "tsc",
  stderr: "",
});

ok("2 checks, both pass", v5.checks.length === 2);
ok("Overall status is verified", v5.status === "verified");
ok("verifiedAt is set", v5.verifiedAt !== null);

// ── Test 6: getVerification ─────────────────────────────────────────────────
console.log("\n-- Test 6: getVerification --");

const fetched = await verifierEngine.getVerification(proposalId1);
ok("getVerification returns record", !!fetched);
ok("proposalId matches", fetched.proposalId === proposalId1);

const notFound = await verifierEngine.getVerification("PATCH-NONEXISTENT");
ok("Returns null for non-existent", notFound === null);

// ── Test 7: isProposalVerified ──────────────────────────────────────────────
console.log("\n-- Test 7: isProposalVerified --");

ok("proposalId1 (all pass) is verified", await verifierEngine.isProposalVerified(proposalId1));
ok("proposalId2 (failed) is NOT verified", !(await verifierEngine.isProposalVerified(proposalId2)));
ok("proposalId4 (all pass) is verified", await verifierEngine.isProposalVerified(proposalId4));
ok("Non-existent is NOT verified", !(await verifierEngine.isProposalVerified("PATCH-NONEXISTENT")));

// ── Test 8: suggestVerificationCommands ─────────────────────────────────────
console.log("\n-- Test 8: suggestVerificationCommands --");

const tsSuggestions = verifierEngine.suggestVerificationCommands(["src/colony/test.ts"]);
ok("TS file → suggests typecheck", tsSuggestions.includes("npm run typecheck"));
ok("TS file → suggests build", tsSuggestions.includes("npm run build"));

const testSuggestions = verifierEngine.suggestVerificationCommands(["scripts/test.mjs"]);
ok("Test file → suggests npm test", testSuggestions.includes("npm test"));

const noSuggestions = verifierEngine.suggestVerificationCommands(["README.md"]);
ok("README → no suggestions", noSuggestions.length === 0);

// ── Test 9: Whitelist enforcement ───────────────────────────────────────────
console.log("\n-- Test 9: Whitelist enforcement --");

try {
  await verifierEngine.recordCheck(proposalId1, {
    name: "evil",
    command: "rm -rf /",
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
  ok("Should reject non-whitelisted command", false);
} catch (e) {
  ok("Rejects non-whitelisted command", e.message.includes("not in the verifier whitelist"));
}

try {
  await verifierEngine.recordCheck(proposalId1, {
    name: "evil2",
    command: "curl http://evil.com",
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
  ok("Should reject curl command", false);
} catch (e) {
  ok("Rejects curl command", e.message.includes("not in the verifier whitelist"));
}

// ── Test 10: listVerifications ──────────────────────────────────────────────
console.log("\n-- Test 10: listVerifications --");

const all = await verifierEngine.listVerifications();
ok("listVerifications returns ≥ 4", all.length >= 4);

// ── Cleanup ────────────────────────────────────────────────────────────────
console.log("\n-- Cleanup --");

for (const pid of [proposalId1, proposalId2, proposalId3, proposalId4]) {
  await redis.del(`${PREFIX}verification:${pid}`);
  await redis.srem(`${PREFIX}verifications:index`, pid);
}

console.log("  ✅ Test data cleaned up");

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

process.exit(fail > 0 ? 1 : 0);
