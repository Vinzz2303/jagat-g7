// ============================================================================
// JAGAT Colony - High-Risk Verifier Policy Smoke Test
// Tests T-041: high-risk patches require passed verification before approval/apply.
// ============================================================================

import { readFileSync } from "node:fs";
import {
  submitProposal,
  getProposal,
  approveProposal,
  applyPatch,
} from "../dist/colony/patch-engine.js";
import { verifierEngine } from "../dist/colony/index.js";
import { getRedisClient } from "../dist/services/redis.service.js";

const redis = getRedisClient();
const PREFIX = "colony:";
const FIXTURE_ABS = "c:/JAGAT/src/colony/__fixtures__/c5b2-patch-fixture.txt";
const FIXTURE_REL = "src/colony/__fixtures__/c5b2-patch-fixture.txt";
const ORIGINAL_CONTENT = readFileSync(FIXTURE_ABS, "utf-8");
const ORIGINAL_LINE = "line1: unique content here";
const ACTOR = "Faturachman Al Kahfi";
const runKey = `T041-${Date.now()}`;

let pass = 0;
let fail = 0;
const createdProposalIds = [];
const createdTaskIds = [];

function ok(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}`);
    fail++;
  }
}

async function expectVerificationError(label, fn, expectedText) {
  try {
    await fn();
    ok(label, false);
  } catch (error) {
    ok(label, error?.code === "VERIFICATION_FAILED" && String(error.message).includes(expectedText));
  }
}

async function submitFixtureProposal(label, estimatedRisk) {
  const taskId = `${runKey}-${label}`;
  createdTaskIds.push(taskId);
  const proposal = await submitProposal({
    taskId,
    agentRole: "builder",
    agentName: "Builder Test",
    title: `T041 ${label}`,
    rationale: "Verify high-risk verifier policy",
    estimatedRisk,
    contextFiles: [FIXTURE_REL],
    searchQueries: ["T041 high-risk verifier policy"],
    evidenceSummary: "Fixture proposal for verifier policy smoke test.",
    hunks: [{
      filePath: FIXTURE_REL,
      startLine: 1,
      endLine: 1,
      originalContent: ORIGINAL_LINE,
      proposedContent: `${ORIGINAL_LINE} ${label}`,
      unifiedDiff: `--- a/${FIXTURE_REL}\n+++ b/${FIXTURE_REL}\n@@ -1 +1 @@\n-${ORIGINAL_LINE}\n+${ORIGINAL_LINE} ${label}`,
    }],
  });
  createdProposalIds.push(proposal.proposalId);
  return proposal;
}

async function forceStatus(proposalId, status) {
  const raw = await redis.get(`${PREFIX}patch:${proposalId}`);
  if (!raw) throw new Error(`Missing proposal ${proposalId}`);
  const proposal = JSON.parse(raw);
  proposal.status = status;
  await redis.set(`${PREFIX}patch:${proposalId}`, JSON.stringify(proposal), "EX", 48 * 60 * 60);
  if (status !== "pending") {
    await redis.srem(`${PREFIX}patch:pending`, proposalId);
  }
}

async function cleanup() {
  for (const proposalId of createdProposalIds) {
    await redis.del(`${PREFIX}patch:${proposalId}`);
    await redis.srem(`${PREFIX}patch:index`, proposalId);
    await redis.srem(`${PREFIX}patch:pending`, proposalId);
    await redis.del(`${PREFIX}verification:${proposalId}`);
    await redis.srem(`${PREFIX}verifications:index`, proposalId);
  }
  for (const taskId of createdTaskIds) {
    await redis.del(`${PREFIX}patch:by_task:${taskId}`);
  }
}

console.log("===============================================================");
console.log("  JAGAT Colony - High-Risk Verifier Policy Smoke Test");
console.log("===============================================================\n");

await cleanup();

try {
  console.log("-- Test 1: high-risk missing verification is blocked --");
  const highMissing = await submitFixtureProposal("missing", "high");
  await expectVerificationError(
    "high-risk missing verification blocks approval",
    () => approveProposal(highMissing.proposalId, ACTOR),
    "requires passed verification",
  );
  const highMissingAfter = await getProposal(highMissing.proposalId);
  ok("blocked high-risk proposal remains pending", highMissingAfter?.status === "pending");

  console.log("\n-- Test 2: high-risk pending verification is blocked --");
  const highPending = await submitFixtureProposal("pending", "high");
  await verifierEngine.createVerification(highPending.proposalId);
  await expectVerificationError(
    "high-risk pending verification blocks approval",
    () => approveProposal(highPending.proposalId, ACTOR),
    "Current verification: pending",
  );

  console.log("\n-- Test 3: high-risk failed verification is blocked --");
  const highFailed = await submitFixtureProposal("failed", "high");
  await verifierEngine.recordCheck(highFailed.proposalId, {
    name: "typecheck",
    command: "npm run typecheck",
    exitCode: 2,
    stdout: "",
    stderr: "typecheck failed",
  });
  await expectVerificationError(
    "high-risk failed verification blocks approval",
    () => approveProposal(highFailed.proposalId, ACTOR),
    "failed verification",
  );

  console.log("\n-- Test 4: high-risk verified proposal can be approved --");
  const highVerified = await submitFixtureProposal("verified", "high");
  await verifierEngine.recordCheck(highVerified.proposalId, {
    name: "typecheck",
    command: "npm run typecheck",
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
  const approvedHigh = await approveProposal(highVerified.proposalId, ACTOR, "verified high-risk");
  ok("verified high-risk proposal is approved", approvedHigh.status === "approved");

  console.log("\n-- Test 5: low-risk missing verification keeps baseline behavior --");
  const lowMissing = await submitFixtureProposal("low", "low");
  const approvedLow = await approveProposal(lowMissing.proposalId, ACTOR, "low-risk baseline");
  ok("low-risk missing verification can be approved", approvedLow.status === "approved");

  console.log("\n-- Test 6: apply backstop blocks legacy approved high-risk without verification --");
  const legacyHigh = await submitFixtureProposal("legacy-apply", "high");
  await forceStatus(legacyHigh.proposalId, "approved");
  await expectVerificationError(
    "applyPatch blocks legacy approved high-risk without verification",
    () => applyPatch(legacyHigh.proposalId, ACTOR),
    "requires passed verification",
  );
  ok("fixture file was not modified by blocked apply", readFileSync(FIXTURE_ABS, "utf-8") === ORIGINAL_CONTENT);
} finally {
  console.log("\n-- Cleanup --");
  await cleanup();
  console.log("  cleanup complete");
}

console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
console.log("===============================================================");

process.exit(fail > 0 ? 1 : 0);
