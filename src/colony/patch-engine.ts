// ============================================================================
// JAGAT Colony — Patch Engine (C5B-2)
// Manages patch proposals from builder agent to founder review.
//
// Security model (C5B-2 hardened):
//   1. submitProposal()  — callable by builder agent (canProposePatch check)
//   2. approveProposal() — callable by command-engine on founder /patch-approve
//   3. applyPatch(proposalId, actor) — FOUNDER-ONLY, NOT exported from index.ts
//      - Re-validates all hunks against live files before writing (stale diff)
//      - Uses validatePatchPath() from worker-sandbox for ALL path operations
//      - Audit records the real founder actor, never "system"
//   4. validateHunks() — uses validatePatchPath (role-scoped, blocked patterns,
//      traversal check, JAGAT boundary) + line-range verification
//   5. Ambiguous hunk detection: if originalContent appears >1 time and the
//      line-range doesn't match the first occurrence, hunk is rejected
//
// Training data: all approved+applied proposals carry trainingDataTags and
// trainingDataReady flag for future JAGAT Monster fine-tuning pipeline.
// ============================================================================

import { dirname, join } from "node:path";
import { readFile as fsReadFile, rename, rm, writeFile } from "node:fs/promises";
import { getRedisClient } from "../services/redis.service.js";
import { emitAudit } from "./audit-engine.js";
import {
  validatePatchPath,
  SandboxError,
} from "./worker-sandbox.js";
import { getVerification } from "./verifier-engine.js";
import {
  type AgentRole,
  type PatchProposal,
  type PatchHunk,
  type PatchStatus,
  type PatchVerification,
  DEFAULT_PERMISSIONS,
  REDIS_KEYS,
} from "./types.js";

// ── Constants ────────────────────────────────────────────────────────────────

/** Proposal TTL: 48 hours before auto-expired */
const PROPOSAL_TTL_SECONDS = 48 * 60 * 60;

/** Max hunks per proposal */
const MAX_HUNKS = 20;

/** Max total chars across all hunks */
const MAX_HUNK_CHARS = 50_000;

/**
 * The agent role used when validating hunk paths.
 * Only builder agents can propose patches; their paths are scoped to src/ only.
 */
const PATCH_AGENT_ROLE: AgentRole = "builder";

// ── Error Classes ────────────────────────────────────────────────────────────

export class PatchEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PERMISSION_DENIED"
      | "HUNK_MISMATCH"
      | "HUNK_AMBIGUOUS"
      | "HUNK_LINERANGE_MISMATCH"
      | "HUNK_VALIDATION_FAILED"
      | "HUNK_PATH_DENIED"
      | "PROPOSAL_NOT_FOUND"
      | "WRONG_STATUS"
      | "TOO_MANY_HUNKS"
      | "HUNK_TOO_LARGE"
      | "HUNK_OVERLAP"
      | "APPLY_CONFLICT"
      | "APPLY_ERROR"
      | "VERIFICATION_FAILED",
  ) {
    super(message);
    this.name = "PatchEngineError";
  }
}

// ── ID Generator ─────────────────────────────────────────────────────────────

async function nextProposalId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.patchSequence());
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PATCH-${date}-${String(seq).padStart(4, "0")}`;
}

// ── Permission Check ─────────────────────────────────────────────────────────

function assertCanPropose(agentRole: AgentRole): void {
  // Defense-in-depth: validate permissions object exists before accessing
  // (matches guard pattern in agent-registry.ts, scheduler-queue.ts, autonomous-policy.ts)
  const permissions = DEFAULT_PERMISSIONS[agentRole];
  if (!permissions) {
    throw new PatchEngineError(
      `Unknown agent role '${agentRole}' — cannot check patch proposal permission`,
      "PERMISSION_DENIED",
    );
  }
  if (!permissions.canProposePatch) {
    throw new PatchEngineError(
      `Agent role '${agentRole}' does not have canProposePatch permission`,
      "PERMISSION_DENIED",
    );
  }
}

function formatFailedChecks(verification: PatchVerification): string {
  const failedChecks = verification.checks
    .filter((c) => c.passed === false)
    .map((c) => `${c.name} (exit ${c.exitCode})`);
  return failedChecks.length > 0 ? failedChecks.join(", ") : "unknown failed check";
}

function assertVerificationPolicyAllowsAction(
  proposal: PatchProposal,
  verification: PatchVerification | null,
  action: "approval" | "apply",
): void {
  if (verification?.status === "failed") {
    throw new PatchEngineError(
      `Proposal ${proposal.proposalId} has failed verification: ${formatFailedChecks(verification)}. Fix verification before ${action}.`,
      "VERIFICATION_FAILED",
    );
  }

  if (proposal.estimatedRisk === "high" && verification?.status !== "verified") {
    const status = verification?.status ?? "missing";
    throw new PatchEngineError(
      `High-risk proposal ${proposal.proposalId} requires passed verification before ${action}. Current verification: ${status}.`,
      "VERIFICATION_FAILED",
    );
  }
}

// ── Hunk Path Security ────────────────────────────────────────────────────────

/**
 * Validate that a hunk's filePath passes all security checks.
 * Uses validatePatchPath from worker-sandbox — the single source of truth
 * for path security. Applies builder role scope (src/ only).
 *
 * @throws PatchEngineError with code HUNK_PATH_DENIED
 */
function validateHunkPath(rawPath: string): string {
  try {
    return validatePatchPath(rawPath, PATCH_AGENT_ROLE);
  } catch (err) {
    const detail = err instanceof SandboxError
      ? `${err.code}: ${err.message}`
      : String(err);
    throw new PatchEngineError(
      `Hunk path denied — ${detail} (path: ${rawPath})`,
      "HUNK_PATH_DENIED",
    );
  }
}

// ── Line-Offset Helpers ───────────────────────────────────────────────────────

/**
 * Compute the byte offset of the START of a 1-indexed line within a file string.
 * Used to anchor hunk replacement to the declared line range.
 *
 * Returns the offset of the first char on that line.
 * If lineNumber exceeds the line count, returns content.length.
 */
function computeLineStartOffset(content: string, lineNumber: number): number {
  if (lineNumber <= 1) return 0;
  let offset = 0;
  let remaining = lineNumber - 1;
  while (remaining > 0) {
    const nl = content.indexOf("\n", offset);
    if (nl === -1) return content.length;
    offset = nl + 1;
    remaining--;
  }
  return offset;
}

/**
 * Compute the byte offset of the END of a 1-indexed line within a file string.
 * "End" = position just after the newline on that line, or content.length if last.
 */
function computeLineEndOffset(content: string, lineNumber: number): number {
  const start = computeLineStartOffset(content, lineNumber);
  const nl = content.indexOf("\n", start);
  return nl === -1 ? content.length : nl + 1;
}

// ── Hunk Content + Line-Range Validation ────────────────────────────────────

/**
 * Validate each hunk's originalContent against the actual file on disk.
 *
 * Security checks:
 *   1. Path security via validatePatchPath (role-scope, BLOCKED_PATTERNS, traversal, JAGAT boundary)
 *   2. originalContent must exist verbatim in file (HUNK_MISMATCH)
 *   3. Byte-window range check: search for originalContent within the byte range
 *      of [startLine..endLine]. If not found in window:
 *      - count total occurrences in file
 *      - >1 occurrence → HUNK_AMBIGUOUS (agent must correct line range)
 *      - =1 occurrence → HUNK_LINERANGE_MISMATCH (wrong range)
 *
 * Returns { fileCache, resolvedPaths }:
 *   fileCache     — resolvedPath → file content (same snapshot used in applyPatch, TOCTOU-safe)
 *   resolvedPaths — hunk.filePath → resolvedPath (avoids double validateHunkPath in apply)
 */
async function validateHunks(
  hunks: PatchHunk[],
): Promise<{ fileCache: Map<string, string>; resolvedPaths: Map<string, string> }> {
  if (hunks.length > MAX_HUNKS) {
    throw new PatchEngineError(`Too many hunks: ${hunks.length} (max ${MAX_HUNKS})`, "TOO_MANY_HUNKS");
  }

  let totalChars = 0;
  for (const hunk of hunks) totalChars += hunk.originalContent.length + hunk.proposedContent.length;
  if (totalChars > MAX_HUNK_CHARS) {
    throw new PatchEngineError(`Hunk content too large: ${totalChars} chars (max ${MAX_HUNK_CHARS})`, "HUNK_TOO_LARGE");
  }

  const fileCache = new Map<string, string>();     // resolvedPath → content
  const resolvedPaths = new Map<string, string>(); // hunk.filePath → resolvedPath
  const fileRanges = new Map<string, Array<{ startLine: number; endLine: number; filePath: string }>>();

  for (const hunk of hunks) {
    // Step 1: Path security
    const resolvedPath = validateHunkPath(hunk.filePath);
    resolvedPaths.set(hunk.filePath, resolvedPath);
    const ranges = fileRanges.get(resolvedPath) ?? [];
    ranges.push({ startLine: hunk.startLine, endLine: hunk.endLine, filePath: hunk.filePath });
    fileRanges.set(resolvedPath, ranges);

    if (!fileCache.has(resolvedPath)) {
      try {
        fileCache.set(resolvedPath, await fsReadFile(resolvedPath, "utf-8"));
      } catch {
        throw new PatchEngineError(`Cannot read file for hunk validation: ${hunk.filePath}`, "HUNK_VALIDATION_FAILED");
      }
    }

    const fileContent = fileCache.get(resolvedPath)!;
    const fileLineCount = fileContent.split("\n").length;

    // Step 2: Global existence check
    if (!fileContent.includes(hunk.originalContent)) {
      throw new PatchEngineError(
        `Hunk mismatch in ${hunk.filePath}: originalContent not found in file. ` +
        `First 100 chars: "${hunk.originalContent.slice(0, 100)}"`,
        "HUNK_MISMATCH",
      );
    }

    // Step 3: Basic range sanity
    if (hunk.startLine < 1 || hunk.startLine > hunk.endLine || hunk.startLine > fileLineCount) {
      throw new PatchEngineError(
        `Hunk line range invalid for ${hunk.filePath}: startLine=${hunk.startLine}, endLine=${hunk.endLine}, fileLines=${fileLineCount}`,
        "HUNK_LINERANGE_MISMATCH",
      );
    }

    // Step 4: Byte-window range check
    // Compute the byte range covered by [startLine..endLine] and search within it.
    const windowStart = computeLineStartOffset(fileContent, hunk.startLine);
    const windowEnd = computeLineEndOffset(fileContent, hunk.endLine);
    const idxInWindow = fileContent.indexOf(hunk.originalContent, windowStart);
    const foundInWindow = idxInWindow !== -1 && idxInWindow < windowEnd;

    if (!foundInWindow) {
      // Count all occurrences to give the right error
      let count = 0;
      let pos = 0;
      while (true) {
        const idx = fileContent.indexOf(hunk.originalContent, pos);
        if (idx === -1) break;
        count++;
        pos = idx + 1;
      }
      if (count > 1) {
        throw new PatchEngineError(
          `Hunk ambiguous in ${hunk.filePath}: originalContent appears ${count} times in file ` +
          `but declared line range (${hunk.startLine}–${hunk.endLine}) does not contain any occurrence. ` +
          `Correct the line range to point at the exact occurrence to replace.`,
          "HUNK_AMBIGUOUS",
        );
      }
      throw new PatchEngineError(
        `Hunk line range mismatch in ${hunk.filePath}: originalContent not found at lines ` +
        `${hunk.startLine}–${hunk.endLine}. Content exists elsewhere in file — check startLine/endLine.`,
        "HUNK_LINERANGE_MISMATCH",
      );
    }
  }

  for (const [resolvedPath, ranges] of fileRanges) {
    const sortedRanges = [...ranges].sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
    for (let index = 1; index < sortedRanges.length; index++) {
      const previous = sortedRanges[index - 1];
      const current = sortedRanges[index];
      if (!previous || !current) continue;
      if (current.startLine <= previous.endLine) {
        throw new PatchEngineError(
          `Hunk overlap in ${resolvedPath}: ` +
          `${previous.filePath}(${previous.startLine}-${previous.endLine}) overlaps ` +
          `${current.filePath}(${current.startLine}-${current.endLine})`,
          "HUNK_OVERLAP",
        );
      }
    }
  }

  return { fileCache, resolvedPaths };
}

type AtomicWritePlan = {
  targetPath: string;
  tempPath: string;
  backupPath: string;
};

async function writeFilesAtomically(fileUpdates: Map<string, string>): Promise<void> {
  const stamp = `${Date.now()}-${process.pid}`;
  const plans: AtomicWritePlan[] = [];
  const activatedBackups: AtomicWritePlan[] = [];

  for (const [targetPath, content] of fileUpdates) {
    const dir = dirname(targetPath);
    const tempPath = join(dir, `.colony-patch-${stamp}-${plans.length}.tmp`);
    const backupPath = join(dir, `.colony-patch-${stamp}-${plans.length}.bak`);
    await writeFile(tempPath, content, "utf-8");
    plans.push({ targetPath, tempPath, backupPath });
  }

  try {
    for (const plan of plans) {
      await rename(plan.targetPath, plan.backupPath);
      activatedBackups.push(plan);
      try {
        await rename(plan.tempPath, plan.targetPath);
      } catch (error) {
        await rename(plan.backupPath, plan.targetPath);
        throw error;
      }
    }

    for (const plan of activatedBackups) {
      await rm(plan.backupPath, { force: true });
    }
  } catch (error) {
    for (let index = activatedBackups.length - 1; index >= 0; index--) {
      const plan = activatedBackups[index];
      if (!plan) continue;
      await rm(plan.targetPath, { force: true }).catch(() => undefined);
      await rename(plan.backupPath, plan.targetPath).catch(() => undefined);
    }
    throw error;
  } finally {
    for (const plan of plans) {
      await rm(plan.tempPath, { force: true }).catch(() => undefined);
      await rm(plan.backupPath, { force: true }).catch(() => undefined);
    }
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function submitProposal(params: {
  taskId: string;
  agentRole: AgentRole;
  agentName: string;
  title: string;
  rationale: string;
  hunks: PatchHunk[];
  estimatedRisk: "low" | "medium" | "high";
  contextFiles: string[];
  searchQueries: string[];
  evidenceSummary: string;
  trainingDataTags?: string[];
}): Promise<PatchProposal> {
  // Permission check
  assertCanPropose(params.agentRole);

  // Validate hunks against live files (path security + content + line range)
  await validateHunks(params.hunks);

  const redis = getRedisClient();
  const proposalId = await nextProposalId();
  const now = new Date().toISOString();

  const proposal: PatchProposal = {
    proposalId,
    taskId: params.taskId,
    agentRole: params.agentRole,
    agentName: params.agentName,
    title: params.title,
    rationale: params.rationale,
    hunks: params.hunks,
    filesAffected: [...new Set(params.hunks.map((h) => h.filePath))],
    estimatedRisk: params.estimatedRisk,
    contextFiles: params.contextFiles,
    searchQueries: params.searchQueries,
    evidenceSummary: params.evidenceSummary,
    status: "pending",
    createdAt: now,
    submittedAt: now,
    trainingDataTags: params.trainingDataTags ?? [],
    trainingDataReady: false,
  };

  // Store in Redis
  await redis.set(
    REDIS_KEYS.patchProposal(proposalId),
    JSON.stringify(proposal),
    "EX",
    PROPOSAL_TTL_SECONDS,
  );
  await redis.rpush(REDIS_KEYS.patchByTask(params.taskId), proposalId);
  await redis.sadd(REDIS_KEYS.pendingPatches(), proposalId);
  await redis.sadd(REDIS_KEYS.patchIndex(), proposalId);

  // Audit trail
  await emitAudit({
    actor: `agent:${params.agentRole}`,
    actorRole: params.agentRole,
    action: "patch.propose",
    resource: `task:${params.taskId}`,
    detail: {
      proposalId,
      title: params.title,
      filesAffected: proposal.filesAffected,
      hunkCount: params.hunks.length,
      estimatedRisk: params.estimatedRisk,
    },
  });

  console.log(
    `[Colony:PatchEngine] ${params.agentRole} submitted proposal ${proposalId} ` +
    `for task ${params.taskId} (${proposal.filesAffected.length} files, ${params.hunks.length} hunks)`,
  );

  return proposal;
}

export async function getProposal(proposalId: string): Promise<PatchProposal | null> {
  const redis = getRedisClient();
  const raw = await redis.get(REDIS_KEYS.patchProposal(proposalId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatchProposal;
  } catch {
    console.warn(`[Colony:PatchEngine] Corrupted proposal data for ${proposalId}, skipping`);
    return null;
  }
}

export async function listPendingProposals(): Promise<PatchProposal[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.pendingPatches());
  const proposals: PatchProposal[] = [];

  for (const id of ids) {
    const proposal = await getProposal(id);
    if (!proposal) {
      // Key TTL expired — clean up stale reference and audit
      await redis.srem(REDIS_KEYS.pendingPatches(), id);
      await redis.srem(REDIS_KEYS.patchIndex(), id);
      await emitAudit({
        actor: "Colony System",
        actorRole: "system",
        action: "patch.expired",
        resource: `patch:${id}`,
        detail: { reason: "redis_ttl_expired", cleanedFrom: "pendingPatches" },
      }).catch(() => undefined);
      continue;
    }
    if (proposal.status === "pending") {
      proposals.push(proposal);
    } else {
      // Status no longer pending — remove from set
      await redis.srem(REDIS_KEYS.pendingPatches(), id);
    }
  }

  return proposals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function listProposalsByTask(taskId: string): Promise<PatchProposal[]> {
  const redis = getRedisClient();
  const ids = await redis.lrange(REDIS_KEYS.patchByTask(taskId), 0, -1);
  const proposals: PatchProposal[] = [];

  for (const id of ids) {
    const proposal = await getProposal(id);
    if (proposal) proposals.push(proposal);
  }

  return proposals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ── Founder Actions ──────────────────────────────────────────────────────────

/**
 * Mark a proposal as approved. Does NOT apply — just gates the status.
 * Call applyPatch(proposalId, actor) after this to write to disk.
 */
export async function approveProposal(
  proposalId: string,
  reviewedBy: string,
  reviewNote?: string,
  trainingDataReady?: boolean,
): Promise<PatchProposal> {
  const redis = getRedisClient();
  const proposal = await getProposal(proposalId);

  if (!proposal) {
    throw new PatchEngineError(`Proposal ${proposalId} not found`, "PROPOSAL_NOT_FOUND");
  }
  if (proposal.status !== "pending") {
    throw new PatchEngineError(
      `Proposal ${proposalId} is not pending (current: ${proposal.status})`,
      "WRONG_STATUS",
    );
  }

  // v0D verifier policy is enforced by assertVerificationPolicyAllowsAction().
  const verification = await getVerification(proposalId);
  assertVerificationPolicyAllowsAction(proposal, verification, "approval");

  proposal.status = "approved";
  proposal.reviewedAt = new Date().toISOString();
  proposal.reviewedBy = reviewedBy;
  proposal.reviewNote = reviewNote;
  proposal.trainingDataReady = trainingDataReady ?? false;

  await redis.set(
    REDIS_KEYS.patchProposal(proposalId),
    JSON.stringify(proposal),
    "EX",
    PROPOSAL_TTL_SECONDS,
  );
  await redis.srem(REDIS_KEYS.pendingPatches(), proposalId);

  await emitAudit({
    actor: reviewedBy,
    actorRole: "founder",
    action: "patch.approve",
    resource: `patch:${proposalId}`,
    detail: {
      taskId: proposal.taskId,
      filesAffected: proposal.filesAffected,
      trainingDataReady: proposal.trainingDataReady,
      reviewNote,
    },
  });

  return proposal;
}

/**
 * Reject a proposal. No file changes.
 */
export async function rejectProposal(
  proposalId: string,
  reviewedBy: string,
  reviewNote?: string,
): Promise<PatchProposal> {
  const redis = getRedisClient();
  const proposal = await getProposal(proposalId);

  if (!proposal) {
    throw new PatchEngineError(`Proposal ${proposalId} not found`, "PROPOSAL_NOT_FOUND");
  }
  if (proposal.status !== "pending") {
    throw new PatchEngineError(
      `Proposal ${proposalId} is not pending (current: ${proposal.status})`,
      "WRONG_STATUS",
    );
  }

  proposal.status = "rejected";
  proposal.reviewedAt = new Date().toISOString();
  proposal.reviewedBy = reviewedBy;
  proposal.reviewNote = reviewNote;

  await redis.set(
    REDIS_KEYS.patchProposal(proposalId),
    JSON.stringify(proposal),
    "EX",
    PROPOSAL_TTL_SECONDS,
  );
  await redis.srem(REDIS_KEYS.pendingPatches(), proposalId);

  await emitAudit({
    actor: reviewedBy,
    actorRole: "founder",
    action: "patch.reject",
    resource: `patch:${proposalId}`,
    detail: {
      taskId: proposal.taskId,
      filesAffected: proposal.filesAffected,
      reviewNote,
    },
  });

  console.log(`[Colony:PatchEngine] Proposal ${proposalId} rejected by ${reviewedBy}`);
  return proposal;
}

/**
 * Apply an approved patch to disk.
 *
 * ⚠️  FOUNDER-ONLY. NOT exported from index.ts.
 * Only reachable via command-engine /patch-approve.
 *
 * Security layers:
 *   1. status must be "approved"
 *   2. All hunk paths re-validated via validatePatchPath (full sandbox check)
 *   3. All hunks re-validated against live files (stale diff protection)
 *   4. Replacement only happens at the exact line range position
 *   5. Audit records the real `actor` (founder name), not "system"
 *
 * @param proposalId  The proposal to apply
 * @param actor       The founder identity executing this (from session/command context)
 */
export async function applyPatch(proposalId: string, actor: string): Promise<PatchProposal> {
  const redis = getRedisClient();
  const proposal = await getProposal(proposalId);

  if (!proposal) {
    throw new PatchEngineError(`Proposal ${proposalId} not found`, "PROPOSAL_NOT_FOUND");
  }
  if (proposal.status !== "approved") {
    throw new PatchEngineError(
      `Proposal ${proposalId} is not approved (current: ${proposal.status})`,
      "WRONG_STATUS",
    );
  }

  const verification = await getVerification(proposalId);
  assertVerificationPolicyAllowsAction(proposal, verification, "apply");

  // Re-validate hunks: path security + content + line range (stale diff protection)
  let fileCache: Map<string, string>;
  let resolvedPaths: Map<string, string>;
  try {
    ({ fileCache, resolvedPaths } = await validateHunks(proposal.hunks));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Validation error";
    proposal.status = "apply_failed";
    proposal.applyError = `Stale diff at apply time: ${msg}`;
    await redis.set(REDIS_KEYS.patchProposal(proposalId), JSON.stringify(proposal), "EX", PROPOSAL_TTL_SECONDS);

    await emitAudit({
      actor,
      actorRole: "founder",
      action: "patch.apply_failed",
      resource: `patch:${proposalId}`,
      detail: { error: proposal.applyError, stage: "re-validation", actor },
    });

    throw new PatchEngineError(`Stale diff detected: ${msg}`, "APPLY_CONFLICT");
  }

  // Apply hunks: group by resolved path, apply LINE-ANCHORED replacement.
  // fileCache contains the same snapshot used during validation (TOCTOU-safe).
  //
  // Replacement is anchored to startLine: we compute the byte offset of startLine
  // and search for originalContent from that offset forward.
  // This guarantees we replace the occurrence inside the declared line window,
  // not the first occurrence in the file (which may be earlier for repeated content).
  const fileUpdates = new Map<string, string>();
  const hunksByPath = new Map<string, PatchHunk[]>();

  for (const hunk of proposal.hunks) {
    const resolvedPath = resolvedPaths.get(hunk.filePath)!;
    const bucket = hunksByPath.get(resolvedPath) ?? [];
    bucket.push(hunk);
    hunksByPath.set(resolvedPath, bucket);
  }

  for (const [resolvedPath, hunks] of hunksByPath) {
    let content = fileCache.get(resolvedPath)!;
    const orderedHunks = [...hunks].sort((a, b) => b.startLine - a.startLine || b.endLine - a.endLine);

    for (const hunk of orderedHunks) {
      // Search from startLine offset ? anchors to the exact occurrence in the declared window
      const windowStart = computeLineStartOffset(content, hunk.startLine);
      const idx = content.indexOf(hunk.originalContent, windowStart);

      if (idx === -1) {
        // Extremely unlikely ? validateHunks just passed ? race condition guard
        proposal.status = "apply_failed";
        proposal.applyError = `originalContent not found from line ${hunk.startLine} at apply time in ${hunk.filePath}`;
        await redis.set(REDIS_KEYS.patchProposal(proposalId), JSON.stringify(proposal), "EX", PROPOSAL_TTL_SECONDS);
        await emitAudit({
          actor, actorRole: "founder", action: "patch.apply_failed",
          resource: `patch:${proposalId}`,
          detail: { error: proposal.applyError, file: hunk.filePath, actor },
        });
        throw new PatchEngineError(`Apply error: ${proposal.applyError}`, "APPLY_ERROR");
      }

      content = content.slice(0, idx) + hunk.proposedContent + content.slice(idx + hunk.originalContent.length);
    }

    fileUpdates.set(resolvedPath, content);
  }

  try {
    await writeFilesAtomically(fileUpdates);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    proposal.status = "apply_failed";
    proposal.applyError = `Atomic write failed: ${message}`;
    await redis.set(REDIS_KEYS.patchProposal(proposalId), JSON.stringify(proposal), "EX", PROPOSAL_TTL_SECONDS);
    await emitAudit({
      actor,
      actorRole: "founder",
      action: "patch.apply_failed",
      resource: `patch:${proposalId}`,
      detail: { error: proposal.applyError, stage: "atomic-write", actor },
    });
    throw new PatchEngineError(`Apply error: ${proposal.applyError}`, "APPLY_ERROR");
  }

  for (const filePath of fileUpdates.keys()) {
    console.log(`[Colony:PatchEngine] Applied patch to ${filePath} (actor: ${actor})`);
  }

  // Update proposal status
  proposal.status = "applied";
  proposal.appliedAt = new Date().toISOString();
  await redis.set(
    REDIS_KEYS.patchProposal(proposalId),
    JSON.stringify(proposal),
    "EX",
    PROPOSAL_TTL_SECONDS,
  );

  await emitAudit({
    actor,
    actorRole: "founder",
    action: "patch.apply",
    resource: `patch:${proposalId}`,
    detail: {
      taskId: proposal.taskId,
      filesAffected: proposal.filesAffected,
      hunkCount: proposal.hunks.length,
      trainingDataReady: proposal.trainingDataReady,
      actor,
    },
  });

  console.log(
    `[Colony:PatchEngine] Proposal ${proposalId} applied by ${actor}: ` +
    `${proposal.filesAffected.length} files modified`,
  );

  return proposal;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** Status emoji map */
const STATUS_EMOJI: Record<PatchStatus, string> = {
  draft: "📝",
  pending: "⏳",
  approved: "✅",
  rejected: "❌",
  applied: "🚀",
  apply_failed: "💥",
  expired: "⌛",
};

/**
 * Format a proposal for display in chat or /patch-view command.
 */
export function formatProposalSummary(proposal: PatchProposal): string {
  const emoji = STATUS_EMOJI[proposal.status];
  const riskEmoji = proposal.estimatedRisk === "low" ? "🟢" : proposal.estimatedRisk === "medium" ? "🟡" : "🔴";

  return [
    `${emoji} **${proposal.proposalId}** — ${proposal.title}`,
    `Agent: ${proposal.agentName} | Task: ${proposal.taskId} | Risk: ${riskEmoji} ${proposal.estimatedRisk}`,
    `Files: ${proposal.filesAffected.join(", ")}`,
    `Status: **${proposal.status}**${proposal.reviewedBy ? ` (${proposal.reviewedBy})` : ""}`,
    proposal.reviewNote ? `Note: ${proposal.reviewNote}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Format full diff view for /patch-view command.
 */
export function formatProposalDetail(proposal: PatchProposal): string {
  const lines: string[] = [
    formatProposalSummary(proposal),
    "",
    `📋 **Rationale:**`,
    proposal.rationale,
    "",
    `🔍 **Context Files Read:** ${proposal.contextFiles.length}`,
    ...proposal.contextFiles.map((f) => `  • ${f.split("/").slice(-2).join("/")}`),
    "",
    `📝 **Diff Hunks (${proposal.hunks.length}):**`,
  ];

  for (let i = 0; i < proposal.hunks.length; i++) {
    const hunk = proposal.hunks[i]!;
    lines.push(
      ``,
      `**Hunk ${i + 1}:** ${hunk.filePath} (lines ${hunk.startLine}–${hunk.endLine})`,
      "```diff",
      hunk.unifiedDiff,
      "```",
    );
  }

  if (proposal.trainingDataTags.length > 0) {
    lines.push("", `🏷️ Training tags: ${proposal.trainingDataTags.join(", ")}`);
    lines.push(`📚 Training ready: ${proposal.trainingDataReady ? "✅ Yes" : "🔒 No"}`);
  }

  return lines.join("\n");
}

/**
 * Format a list of proposals for /patch-log command.
 */
export function formatProposalList(proposals: PatchProposal[]): string {
  if (proposals.length === 0) {
    return "📭 Tidak ada patch proposals.";
  }

  return proposals.map((p) => {
    const emoji = STATUS_EMOJI[p.status];
    const riskEmoji = p.estimatedRisk === "low" ? "🟢" : p.estimatedRisk === "medium" ? "🟡" : "🔴";
    return `${emoji} **${p.proposalId}** ${riskEmoji} — ${p.title}\n   Task: ${p.taskId} | Files: ${p.filesAffected.join(", ")}`;
  }).join("\n\n");
}

// ── F4: Training Data Export ────────────────────────────────────────────────

/**
 * List ALL proposals from the patchIndex set (not just pending).
 * Returns proposals sorted newest-first.
 */
export async function listAllProposals(): Promise<PatchProposal[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.patchIndex());
  const proposals: PatchProposal[] = [];

  for (const id of ids) {
    const proposal = await getProposal(id);
    if (proposal) {
      proposals.push(proposal);
    } else {
      // Key TTL expired — clean up stale index reference
      await redis.srem(REDIS_KEYS.patchIndex(), id);
      await emitAudit({
        actor: "Colony System",
        actorRole: "system",
        action: "patch.expired",
        resource: `patch:${id}`,
        detail: { reason: "redis_ttl_expired", cleanedFrom: "patchIndex" },
      }).catch(() => undefined);
    }
  }

  return proposals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Training data record — one record per approved+applied patch hunk.
 *
 * Format follows instruction-tuning conventions:
 *   instruction = what was asked (rationale + context)
 *   input       = original code / context files read
 *   output      = proposed code change
 *   metadata    = provenance for audit
 */
export interface TrainingRecord {
  id: string;                  // proposalId-hunkIndex
  instruction: string;         // rationale + evidence summary
  input: string;               // original code (hunk originalContent)
  output: string;              // proposed code (hunk proposedContent)
  filePath: string;            // where the change was applied
  lineRange: string;           // "startLine-endLine"
  unifiedDiff: string;         // raw diff
  tags: string[];              // trainingDataTags
  metadata: {
    proposalId: string;
    taskId: string;
    agentRole: string;
    agentName: string;
    estimatedRisk: string;
    contextFiles: string[];
    searchQueries: string[];
    reviewedBy?: string;
    reviewNote?: string;
    appliedAt?: string;
    createdAt: string;
  };
}

/**
 * Export training data from all proposals that are:
 *   1. status === "applied"
 *   2. trainingDataReady === true
 *
 * Each hunk becomes one training record.
 * Optional filters: tags, taskId, minDate.
 */
export async function exportTrainingData(filters?: {
  tags?: string[];
  taskId?: string;
  since?: string;   // ISO 8601 date — only proposals created after this
}): Promise<{ records: TrainingRecord[]; stats: TrainingExportStats }> {
  const allProposals = await listAllProposals();

  // Filter: applied + training-ready
  let candidates = allProposals.filter(
    (p) => p.status === "applied" && p.trainingDataReady === true,
  );

  // Optional tag filter (proposal must have at least one matching tag)
  if (filters?.tags && filters.tags.length > 0) {
    const filterTags = new Set(filters.tags.map((t) => t.toLowerCase()));
    candidates = candidates.filter((p) =>
      p.trainingDataTags.some((t) => filterTags.has(t.toLowerCase())),
    );
  }

  // Optional task filter
  if (filters?.taskId) {
    candidates = candidates.filter((p) => p.taskId === filters.taskId);
  }

  // Optional date filter
  if (filters?.since) {
    const sinceMs = new Date(filters.since).getTime();
    candidates = candidates.filter((p) => new Date(p.createdAt).getTime() >= sinceMs);
  }

  // Expand hunks into training records
  const records: TrainingRecord[] = [];

  for (const proposal of candidates) {
    for (let i = 0; i < proposal.hunks.length; i++) {
      const hunk = proposal.hunks[i]!;

      const instruction = [
        `Task: ${proposal.title}`,
        `Rationale: ${proposal.rationale}`,
        proposal.evidenceSummary ? `Evidence: ${proposal.evidenceSummary}` : "",
      ].filter(Boolean).join("\n");

      records.push({
        id: `${proposal.proposalId}-H${i + 1}`,
        instruction,
        input: hunk.originalContent,
        output: hunk.proposedContent,
        filePath: hunk.filePath,
        lineRange: `${hunk.startLine}-${hunk.endLine}`,
        unifiedDiff: hunk.unifiedDiff,
        tags: proposal.trainingDataTags,
        metadata: {
          proposalId: proposal.proposalId,
          taskId: proposal.taskId,
          agentRole: proposal.agentRole,
          agentName: proposal.agentName,
          estimatedRisk: proposal.estimatedRisk,
          contextFiles: proposal.contextFiles,
          searchQueries: proposal.searchQueries,
          reviewedBy: proposal.reviewedBy,
          reviewNote: proposal.reviewNote,
          appliedAt: proposal.appliedAt,
          createdAt: proposal.createdAt,
        },
      });
    }
  }

  const stats: TrainingExportStats = {
    totalProposalsScanned: allProposals.length,
    appliedAndReady: candidates.length,
    totalRecords: records.length,
    uniqueTags: [...new Set(records.flatMap((r) => r.tags))],
    uniqueFiles: [...new Set(records.map((r) => r.filePath))],
    dateRange: records.length > 0
      ? {
          oldest: records[records.length - 1]!.metadata.createdAt,
          newest: records[0]!.metadata.createdAt,
        }
      : null,
  };

  return { records, stats };
}

export interface TrainingExportStats {
  totalProposalsScanned: number;
  appliedAndReady: number;
  totalRecords: number;
  uniqueTags: string[];
  uniqueFiles: string[];
  dateRange: { oldest: string; newest: string } | null;
}

/**
 * Format training export stats for display in chat / command output.
 */
export function formatTrainingExportSummary(stats: TrainingExportStats): string {
  return [
    "📚 **Training Data Export Summary**",
    "",
    `Total proposals scanned: **${stats.totalProposalsScanned}**`,
    `Applied + training-ready: **${stats.appliedAndReady}**`,
    `Total training records: **${stats.totalRecords}**`,
    stats.uniqueTags.length > 0
      ? `Tags: ${stats.uniqueTags.join(", ")}`
      : "Tags: (none)",
    stats.uniqueFiles.length > 0
      ? `Files touched: ${stats.uniqueFiles.length}`
      : "",
    stats.dateRange
      ? `Date range: ${stats.dateRange.oldest.slice(0, 10)} → ${stats.dateRange.newest.slice(0, 10)}`
      : "No records found.",
  ].filter(Boolean).join("\n");
}
