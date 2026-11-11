/**
 * C5B-2 Live Test — Residual Blocker Fix Verification
 *
 * Tests the residual blocker (line-anchored replacement):
 *   R1. Apply MUST replace the occurrence at the declared line range,
 *       not the first occurrence in the file.
 *   R2. When fixture has two identical lines, proposal targeting occurrence 2
 *       must leave occurrence 1 unchanged.
 *
 * Also retests all previous blockers:
 *   B1. applyPatch not in index.ts public surface
 *   B2. Path security via validatePatchPath (attack tests)
 *   B3. Real actor in audit trail
 *   B4. Line-range + ambiguity validation
 *   B5. Safe apply/reject with fixture file + restore in finally
 *
 * Rules:
 *   - No failed-- / passed++ counter manipulation
 *   - No printing ❌ FAIL for a test that ends as PASS
 *   - Process exits with code 1 if any test fails
 *   - Fixture always restored in finally
 *
 * Fixture layout (5 lines, LF endings):
 *   line1: unique content here
 *   line2: repeated content TARGET
 *   line3: middle unique
 *   line4: repeated content TARGET
 *   line5: end unique
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  submitProposal,
  getProposal,
  listPendingProposals,
  approveProposal,
  rejectProposal,
  PatchEngineError,
  formatProposalDetail,
  formatProposalList,
} from "../dist/colony/patch-engine.js";
// applyPatch: imported DIRECTLY — it is NOT in index.ts (blocker 1)
import { applyPatch } from "../dist/colony/patch-engine.js";
import { agentRegistry, chatEngine, commandEngine } from "../dist/colony/index.js";
// Blocker 1 check: applyPatch must NOT appear in the public colony index
import * as colonyIndex from "../dist/colony/index.js";
import { DEFAULT_PERMISSIONS } from "../dist/colony/types.js";
import { getRedisClient, disconnectRedis } from "../dist/services/redis.service.js";

// ── Fixture ───────────────────────────────────────────────────────────────────
const FIXTURE_ABS = "c:/JAGAT/src/colony/__fixtures__/c5b2-patch-fixture.txt";
const FIXTURE_REL = "src/colony/__fixtures__/c5b2-patch-fixture.txt";
const INITIAL_CONTENT = readFileSync(FIXTURE_ABS, "utf-8");

// Fixture layout (must match file on disk):
// line1: unique content here        (line 1)
// repeated content TARGET           (line 2)  ← identical
// line3: middle unique              (line 3)
// repeated content TARGET           (line 4)  ← identical
// line5: end unique                 (line 5)
const REPEATED = "repeated content TARGET";
const REPLACED_OCC2 = "repeated content REPLACED_OCC2";
const FIXTURE_DIR = "c:/JAGAT/src/colony/__fixtures__";

// ── Test harness ──────────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;

function pass(label) {
  console.log(`  ✅ PASS: ${label}`);
  totalPassed++;
}

function failTest(label, details) {
  console.error(`  ❌ FAIL: ${label}${details ? ` — ${details}` : ""}`);
  totalFailed++;
}

async function expectError(label, fn, expectedCode) {
  try {
    await fn();
    failTest(label, `Expected ${expectedCode} but no error thrown`);
  } catch (err) {
    const code = err?.code ?? err?.name ?? "UNKNOWN";
    if (code === expectedCode) {
      pass(label);
    } else {
      failTest(label, `Expected ${expectedCode}, got ${code}: ${err?.message}`);
    }
  }
}

const TASK_ID = `C5B2-TEST-${Date.now().toString(36)}`;
const ACTOR = "Faturachman Al Kahfi";

try {
  await agentRegistry.seedDefaultAgents();
  const rooms = await chatEngine.seedDefaultRooms();
  const room = rooms.find((r) => r.name === "Colony HQ") ?? rooms[0];
  if (!room) throw new Error("No Colony HQ room");

  // ════════════════════════════════════════════════════════════════════
  // BLOCKER 1: applyPatch isolated from index.ts
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── B1: applyPatch isolation from index.ts ────");
  if (!("applyPatch" in colonyIndex)) {
    pass("applyPatch is NOT exported from colony/index.ts");
  } else {
    failTest("applyPatch isolation", "applyPatch is reachable from public index!");
  }

  // ════════════════════════════════════════════════════════════════════
  // BLOCKER 2: Path security (attack tests)
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── B2: Path security attack tests ────");

  await expectError(
    "A1: ../ops/DECISION_LOG.md traversal → HUNK_PATH_DENIED",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "A1", rationale: "attack", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: "../ops/DECISION_LOG.md", startLine: 1, endLine: 1, originalContent: "x", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_PATH_DENIED",
  );

  await expectError(
    "A2: c:/JAGAT/ops/... outside builder scope → HUNK_PATH_DENIED",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "A2", rationale: "attack", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: "c:/JAGAT/ops/DECISION_LOG.md", startLine: 1, endLine: 1, originalContent: "x", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_PATH_DENIED",
  );

  await expectError(
    "A3: auth.ts blocked pattern → HUNK_PATH_DENIED",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "A3", rationale: "attack", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: "src/colony/auth.ts", startLine: 1, endLine: 1, originalContent: "x", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_PATH_DENIED",
  );

  await expectError(
    "A4: src/.env blocked extension → HUNK_PATH_DENIED",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "A4", rationale: "attack", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: "src/.env", startLine: 1, endLine: 1, originalContent: "x", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_PATH_DENIED",
  );

  // ════════════════════════════════════════════════════════════════════
  // BLOCKER 4: Line-range + ambiguity validation
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── B4: Line-range and ambiguity validation ────");

  await expectError(
    "Hallucinated content → HUNK_MISMATCH",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "Hallucination", rationale: "test", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: FIXTURE_REL, startLine: 1, endLine: 1, originalContent: "THIS_DOES_NOT_EXIST_IN_ANY_FILE_EVER_C5B2", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_MISMATCH",
  );

  // REPEATED appears on line 2 AND line 4. State line range as line 5 (neither) → HUNK_AMBIGUOUS
  await expectError(
    "A5: Ambiguous content (lines 2+4), range=5-5 → HUNK_AMBIGUOUS",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "Ambiguity", rationale: "test", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: FIXTURE_REL, startLine: 5, endLine: 5, originalContent: REPEATED, proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_AMBIGUOUS",
  );

  // "unique content here" is only on line 1. State range as line 3-3 → HUNK_LINERANGE_MISMATCH
  await expectError(
    "A6: Single occurrence at line 1, range=3-3 → HUNK_LINERANGE_MISMATCH",
    () => submitProposal({
      taskId: TASK_ID, agentRole: "builder", agentName: "Builder",
      title: "Wrong range", rationale: "test", estimatedRisk: "low",
      contextFiles: [], searchQueries: [], evidenceSummary: "",
      hunks: [{ filePath: FIXTURE_REL, startLine: 3, endLine: 3, originalContent: "unique content here", proposedContent: "y", unifiedDiff: "" }],
    }), "HUNK_LINERANGE_MISMATCH",
  );

  // ════════════════════════════════════════════════════════════════════
  // RESIDUAL BLOCKER R1: Line-anchored apply — second occurrence only
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── R1: Line-anchored apply (second occurrence only) ────");

  // Verify fixture is in expected state before test
  const fixtureLines = readFileSync(FIXTURE_ABS, "utf-8").split("\n");
  if (
    fixtureLines[1] === REPEATED &&
    fixtureLines[3] === REPEATED
  ) {
    pass("R1 pre: Fixture has REPEATED on lines 2 and 4");
  } else {
    failTest("R1 pre: Fixture state mismatch", `line2='${fixtureLines[1]}', line4='${fixtureLines[3]}'`);
  }

  // Submit proposal targeting ONLY line 4 (second occurrence)
  const proposalOcc2 = await submitProposal({
    taskId: TASK_ID + "-occ2",
    agentRole: "builder",
    agentName: "Builder / Coder Agent",
    title: "Replace second occurrence only",
    rationale: "Line-anchored apply test: target line 4, leave line 2 unchanged",
    hunks: [{
      filePath: FIXTURE_REL,
      startLine: 4,
      endLine: 4,
      originalContent: REPEATED,
      proposedContent: REPLACED_OCC2,
      unifiedDiff: `--- a/${FIXTURE_REL}\n+++ b/${FIXTURE_REL}\n@@ -4,1 +4,1 @@\n-${REPEATED}\n+${REPLACED_OCC2}`,
    }],
    estimatedRisk: "low",
    contextFiles: [FIXTURE_REL],
    searchQueries: ["repeated content"],
    evidenceSummary: "R1 line-anchored apply test",
  });

  if (proposalOcc2.status === "pending" && proposalOcc2.proposalId.startsWith("PATCH-")) {
    pass("R1: Proposal for second occurrence submitted (status=pending)");
  } else {
    failTest("R1: Proposal submit failed", `status=${proposalOcc2.status}`);
  }

  // Approve and apply
  await approveProposal(proposalOcc2.proposalId, ACTOR, "R1 test approve", false);
  const applied = await applyPatch(proposalOcc2.proposalId, ACTOR);

  if (applied.status === "applied") {
    pass("R1: Applied proposal status = 'applied'");
  } else {
    failTest("R1: Applied proposal status wrong", `status=${applied.status}`);
  }

  const afterContent = readFileSync(FIXTURE_ABS, "utf-8");
  const afterLines = afterContent.split("\n");

  // Line 2 (index 1) must be UNCHANGED — still the original REPEATED string
  if (afterLines[1] === REPEATED) {
    pass("R1: Line 2 (occurrence 1) is UNCHANGED after apply");
  } else {
    failTest("R1: Line 2 was modified!", `got: '${afterLines[1]}'`);
  }

  // Line 4 (index 3) must be REPLACED
  if (afterLines[3] === REPLACED_OCC2) {
    pass("R1: Line 4 (occurrence 2) is REPLACED correctly");
  } else {
    failTest("R1: Line 4 not replaced", `got: '${afterLines[3]}'`);
  }

  // Restore fixture for subsequent tests
  writeFileSync(FIXTURE_ABS, INITIAL_CONTENT, "utf-8");

  console.log("\n???? F1: Same-file ordering + overlap rejection ????");

  const proposalOrdered = await submitProposal({
    taskId: TASK_ID + "-ordered",
    agentRole: "builder",
    agentName: "Builder / Coder Agent",
    title: "Apply later hunk before earlier hunk in same file",
    rationale: "Top-of-file deletion must not break a lower hunk anchored to original line numbers",
    hunks: [
      {
        filePath: FIXTURE_REL,
        startLine: 1,
        endLine: 1,
        originalContent: "line1: unique content here\n",
        proposedContent: "",
        unifiedDiff: `--- a/${FIXTURE_REL}\n+++ b/${FIXTURE_REL}\n@@ -1,1 +0,0 @@\n-line1: unique content here`,
      },
      {
        filePath: FIXTURE_REL,
        startLine: 4,
        endLine: 4,
        originalContent: REPEATED,
        proposedContent: "repeated content ORDERED_OK",
        unifiedDiff: `--- a/${FIXTURE_REL}\n+++ b/${FIXTURE_REL}\n@@ -4,1 +4,1 @@\n-${REPEATED}\n+repeated content ORDERED_OK`,
      },
    ],
    estimatedRisk: "low",
    contextFiles: [FIXTURE_REL],
    searchQueries: ["same file multi hunk ordering"],
    evidenceSummary: "F1 ordering test",
  });

  await approveProposal(proposalOrdered.proposalId, ACTOR, "F1 ordering approve", false);
  const appliedOrdered = await applyPatch(proposalOrdered.proposalId, ACTOR);
  const orderedContent = readFileSync(FIXTURE_ABS, "utf-8");

  if (appliedOrdered.status === "applied") {
    pass("F1: Same-file ordered proposal applied");
  } else {
    failTest("F1: Same-file ordered proposal status wrong", appliedOrdered.status);
  }

  if (!orderedContent.includes("line1: unique content here") && orderedContent.includes("repeated content ORDERED_OK")) {
    pass("F1: Lower hunk still applied correctly after top-of-file deletion");
  } else {
    failTest("F1: Same-file ordering result wrong", orderedContent);
  }

  writeFileSync(FIXTURE_ABS, INITIAL_CONTENT, "utf-8");

  await expectError(
    "F1: Overlapping hunks rejected with HUNK_OVERLAP",
    () => submitProposal({
      taskId: TASK_ID + "-overlap",
      agentRole: "builder",
      agentName: "Builder / Coder Agent",
      title: "Overlap should fail",
      rationale: "Two hunks target same line range in one file",
      hunks: [
        {
          filePath: FIXTURE_REL,
          startLine: 1,
          endLine: 1,
          originalContent: "line1: unique content here",
          proposedContent: "line1: first overlap",
          unifiedDiff: "",
        },
        {
          filePath: FIXTURE_REL,
          startLine: 1,
          endLine: 1,
          originalContent: "line1: unique content here",
          proposedContent: "line1: second overlap",
          unifiedDiff: "",
        },
      ],
      estimatedRisk: "low",
      contextFiles: [FIXTURE_REL],
      searchQueries: ["hunk overlap"],
      evidenceSummary: "F1 overlap test",
    }),
    "HUNK_OVERLAP",
  );

  // ════════════════════════════════════════════════════════════════════
  // BLOCKER 5: Safe apply/reject with unique-content fixture hunk
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── B5: Safe apply/reject ────");

  // "line1: unique content here" is only on line 1
  const UNIQUE_LINE1 = "line1: unique content here";
  const REPLACED_UNIQUE = "line1: unique content REPLACED_B5";

  const proposalB5 = await submitProposal({
    taskId: TASK_ID + "-b5",
    agentRole: "builder",
    agentName: "Builder / Coder Agent",
    title: "B5 unique line apply test",
    rationale: "Safe apply test targeting unique content on line 1",
    hunks: [{
      filePath: FIXTURE_REL,
      startLine: 1,
      endLine: 1,
      originalContent: UNIQUE_LINE1,
      proposedContent: REPLACED_UNIQUE,
      unifiedDiff: `--- a/${FIXTURE_REL}\n+++ b/${FIXTURE_REL}\n@@ -1,1 +1,1 @@\n-${UNIQUE_LINE1}\n+${REPLACED_UNIQUE}`,
    }],
    estimatedRisk: "low",
    contextFiles: [], searchQueries: [], evidenceSummary: "B5 test",
  });

  if (proposalB5.status === "pending") {
    pass("B5: Valid proposal submitted");
  } else {
    failTest("B5: Submit failed", `status=${proposalB5.status}`);
  }

  await approveProposal(proposalB5.proposalId, ACTOR, "B5 approve");
  const appliedB5 = await applyPatch(proposalB5.proposalId, ACTOR);

  const b5Content = readFileSync(FIXTURE_ABS, "utf-8");
  if (b5Content.includes(REPLACED_UNIQUE) && !b5Content.includes(UNIQUE_LINE1)) {
    pass("B5: Fixture modified correctly after apply");
  } else {
    failTest("B5: Fixture content wrong after apply", `has replaced: ${b5Content.includes(REPLACED_UNIQUE)}, has original: ${b5Content.includes(UNIQUE_LINE1)}`);
  }

  if (appliedB5.status === "applied") {
    pass("B5: Applied status = 'applied'");
  } else {
    failTest("B5: Applied status wrong", appliedB5.status);
  }

  const leftoverPatchArtifacts = readdirSync(FIXTURE_DIR).filter((name) => name.includes('.colony-patch-'));
  if (leftoverPatchArtifacts.length === 0) {
    pass("F2: Atomic write cleanup leaves no temp/backup files");
  } else {
    failTest("F2: Atomic write cleanup leaked temp files", leftoverPatchArtifacts.join(", "));
  }

  // BLOCKER 3: Audit actor check
  console.log("\n──── B3: Audit actor verification ────");
  const redis = getRedisClient();
  const auditKeys = await redis.keys("colony:audit:*");
  let foundApplyAudit = false;
  let auditActor = null;
  for (const key of auditKeys) {
    const entries = await redis.lrange(key, 0, -1);
    for (const raw of entries) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.action === "patch.apply" && parsed.resource === `patch:${appliedB5.proposalId}`) {
          foundApplyAudit = true;
          auditActor = parsed.actor ?? parsed.detail?.actor;
        }
      } catch { /* skip */ }
    }
  }

  if (foundApplyAudit) {
    pass("B3: patch.apply audit entry exists");
  } else {
    failTest("B3: patch.apply audit entry NOT found");
  }

  if (auditActor === ACTOR) {
    pass(`B3: Audit actor = real founder name ("${auditActor}")`);
  } else {
    failTest("B3: Audit actor wrong", `got: "${auditActor}", expected: "${ACTOR}"`);
  }

  // Restore before reject test
  writeFileSync(FIXTURE_ABS, INITIAL_CONTENT, "utf-8");

  // Reject test: file unchanged
  const proposalReject = await submitProposal({
    taskId: TASK_ID + "-reject",
    agentRole: "builder",
    agentName: "Builder / Coder Agent",
    title: "Reject test",
    rationale: "Verify reject leaves file unchanged",
    hunks: [{
      filePath: FIXTURE_REL,
      startLine: 1,
      endLine: 1,
      originalContent: UNIQUE_LINE1,
      proposedContent: "SHOULD NEVER APPEAR IN FILE",
      unifiedDiff: "",
    }],
    estimatedRisk: "low",
    contextFiles: [], searchQueries: [], evidenceSummary: "",
  });

  const beforeReject = readFileSync(FIXTURE_ABS, "utf-8");
  const rejectResult = await commandEngine.executeCommand(
    { command: "patch-reject", args: [proposalReject.proposalId, "B5-reject-test"], raw: "" },
    ACTOR, "founder", room.roomId,
  );
  const afterReject = readFileSync(FIXTURE_ABS, "utf-8");

  if (rejectResult.success) {
    pass("B5: /patch-reject returns success");
  } else {
    failTest("B5: /patch-reject failed", rejectResult.message);
  }

  if (beforeReject === afterReject) {
    pass("B5: Fixture UNCHANGED after reject");
  } else {
    failTest("B5: Fixture was modified by reject!");
  }

  const rejectedProposal = await getProposal(proposalReject.proposalId);
  if (rejectedProposal?.status === "rejected") {
    pass("B5: Rejected proposal status = 'rejected'");
  } else {
    failTest("B5: Rejected proposal status wrong", rejectedProposal?.status);
  }

  // ════════════════════════════════════════════════════════════════════
  // CANARY: canApplyPatch = false for all roles
  // ════════════════════════════════════════════════════════════════════
  console.log("\n──── CANARY: canApplyPatch = false for all roles ────");
  for (const role of ["director", "planner", "researcher", "builder", "reviewer", "reporter"]) {
    if (DEFAULT_PERMISSIONS[role].canApplyPatch === false) {
      pass(`canApplyPatch=false for '${role}'`);
    } else {
      failTest(`canApplyPatch for '${role}'`, "expected false, got true");
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`C5B-2 Live Test: ${totalPassed} PASS, ${totalFailed} FAIL`);

  if (totalFailed > 0) {
    console.error("SOME TESTS FAILED — see above");
    process.exitCode = 1;
  } else {
    console.log("ALL TESTS PASS ✅");
    console.log(JSON.stringify({
      ok: true,
      passed: totalPassed,
      failed: totalFailed,
      blockers: {
        B1_applyPatch_not_in_index: !("applyPatch" in colonyIndex),
        B2_path_security: true,
        B3_real_actor_in_audit: auditActor === ACTOR,
        B4_linerange_ambiguity: true,
        B5_safe_apply_reject: true,
        F1_same_file_ordering: true,
        F1_overlap_rejected: true,
        F2_atomic_cleanup: true,
        R1_line_anchored_replace: true,
      },
    }, null, 2));
  }

} finally {
  // Always restore fixture
  writeFileSync(FIXTURE_ABS, INITIAL_CONTENT, "utf-8");
  const restored = readFileSync(FIXTURE_ABS, "utf-8");
  if (restored === INITIAL_CONTENT) {
    console.log("\n🔄 Fixture restored to initial state");
  } else {
    console.error("\n⚠️  WARNING: Fixture restore failed");
  }
  await disconnectRedis();
}
