// ============================================================================
// JAGAT Colony — Verifier Gate Engine v0
// Records verification evidence for patch proposals.
//
// This is NOT a shell executor. It records verification results.
// Commands are run externally (by founder or command engine), and results
// are stored here as evidence.
//
// Allowed commands (whitelist):
//   - npm run typecheck
//   - npm run build
//   - npm test
//
// Security:
//   - No shell access
//   - No auto-approve
//   - No auto-run
//   - Failed verification = evidence stored, patch NOT deleted
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import {
  type PatchVerification,
  type VerificationCheck,
  REDIS_KEYS,
} from "./types.js";

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum stdout/stderr length to store (chars) */
const MAX_OUTPUT_CHARS = 2000;

/** Allowed commands whitelist */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "npm run typecheck",
  "npm run build",
  "npm test",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_OUTPUT_CHARS - 20) + "\n... [truncated]";
}

/**
 * Derive suggested verification commands from a proposal's file paths.
 * Returns commands from the whitelist that are relevant.
 */
export function suggestVerificationCommands(changedFilePaths: string[]): string[] {
  const suggestions: string[] = [];

  // Always suggest typecheck for any TypeScript change
  const hasTsFile = changedFilePaths.some(
    (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
  );
  if (hasTsFile) {
    suggestions.push("npm run typecheck");
  }

  // Suggest build for any source change
  const hasSrcFile = changedFilePaths.some(
    (p) => p.startsWith("src/") || p.startsWith("jagat-ui/src/"),
  );
  if (hasSrcFile) {
    suggestions.push("npm run build");
  }

  // Suggest test for test files
  const hasTestFile = changedFilePaths.some(
    (p) => p.includes(".test.") || p.includes(".spec.") || p.includes("scripts/"),
  );
  if (hasTestFile) {
    suggestions.push("npm test");
  }

  // Deduplicate
  return [...new Set(suggestions)];
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Create a verification record for a proposal.
 * Idempotent: if one already exists, returns the existing one.
 */
export async function createVerification(proposalId: string): Promise<PatchVerification> {
  const redis = getRedisClient();

  // Idempotency
  const existing = await getVerification(proposalId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const verification: PatchVerification = {
    proposalId,
    status: "pending",
    checks: [],
    verifiedAt: null,
    createdAt: now,
  };

  await redis.set(REDIS_KEYS.verification(proposalId), JSON.stringify(verification));
  await redis.sadd(REDIS_KEYS.verificationIndex(), proposalId);

  return verification;
}

/**
 * Record a verification check result.
 *
 * The command MUST be in the allowed whitelist.
 * The check result is stored as evidence — it does NOT trigger any action.
 *
 * @param proposalId - The patch proposal ID
 * @param check - The check result to record
 * @returns Updated verification record
 */
export async function recordCheck(
  proposalId: string,
  check: Omit<VerificationCheck, "passed"> & { passed?: boolean },
): Promise<PatchVerification> {
  const redis = getRedisClient();

  // Validate command is allowed
  if (!ALLOWED_COMMANDS.has(check.command)) {
    throw new Error(
      `Command "${check.command}" is not in the verifier whitelist. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}`,
    );
  }

  // Get or create verification
  let verification = await getVerification(proposalId);
  if (!verification) {
    verification = await createVerification(proposalId);
  }

  // Determine passed status from exit code if not explicitly set
  const passed = check.passed ?? (check.exitCode === 0);

  // Build the full check record
  const fullCheck: VerificationCheck = {
    name: check.name,
    command: check.command,
    exitCode: check.exitCode,
    stdout: truncateOutput(check.stdout),
    stderr: truncateOutput(check.stderr),
    passed,
    executedAt: check.executedAt ?? new Date().toISOString(),
  };

  // Update or append check (by name — one check per name)
  const existingIdx = verification.checks.findIndex((c) => c.name === check.name);
  if (existingIdx >= 0) {
    verification.checks[existingIdx] = fullCheck;
  } else {
    verification.checks.push(fullCheck);
  }

  // Recalculate overall status
  const allExecuted = verification.checks.every((c) => c.passed !== null);
  const anyFailed = verification.checks.some((c) => c.passed === false);

  if (anyFailed) {
    verification.status = "failed";
    verification.verifiedAt = null;
  } else if (allExecuted && verification.checks.length > 0) {
    verification.status = "verified";
    verification.verifiedAt = new Date().toISOString();
  } else {
    verification.status = "pending";
    verification.verifiedAt = null;
  }

  await redis.set(REDIS_KEYS.verification(proposalId), JSON.stringify(verification));

  return verification;
}

/**
 * Get the verification record for a proposal.
 */
export async function getVerification(proposalId: string): Promise<PatchVerification | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.verification(proposalId));
  return data ? (JSON.parse(data) as PatchVerification) : null;
}

/**
 * Check if a proposal has been verified (all checks passed).
 */
export async function isProposalVerified(proposalId: string): Promise<boolean> {
  const verification = await getVerification(proposalId);
  return verification?.status === "verified";
}

/**
 * List all verification records.
 */
export async function listVerifications(): Promise<PatchVerification[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.verificationIndex());

  const results: PatchVerification[] = [];
  for (const id of ids) {
    const v = await getVerification(id);
    if (v) results.push(v);
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
