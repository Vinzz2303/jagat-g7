// ============================================================================
// JAGAT Colony — Evaluation Engine v0
// Quality scoring for colony task outputs.
//
// Scoring is local, deterministic, and does NOT use LLM calls.
// Score is stored as task evidence — it does NOT change approval gates.
//
// Dimensions:
//   1. Acceptance criteria coverage (0-30)
//   2. Evidence presence & quality   (0-25)
//   3. Output completeness           (0-20)
//   4. Risk markers                  (0-15)  (inverse — fewer markers = higher score)
//   5. Status consistency            (0-10)
//
// Total: 0-100
//
// Verdict:
//   ≥ 80 → "pass"
//   60-79 → "needs_review"
//   < 60 → "fail"
// ============================================================================

import { type ColonyTask, type TaskEvidence } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EvaluationDimension {
  name: string;
  score: number;
  maxScore: number;
  reason: string;
}

export interface EvaluationResult {
  taskId: string;
  evaluatedAt: string;
  totalScore: number;
  verdict: "pass" | "needs_review" | "fail";
  dimensions: EvaluationDimension[];
}

// ── Risk marker patterns ──────────────────────────────────────────────────────
// Patterns in task title, objective, or evidence that indicate elevated risk.

const RISK_PATTERNS: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /\bdelete|remove|drop\b/i, label: "destructive_action", weight: 3 },
  { pattern: /\bauth|security|token|password|secret\b/i, label: "security_sensitive", weight: 2 },
  { pattern: /\bdeploy|production|restart\b/i, label: "production_touch", weight: 3 },
  { pattern: /\bmigration|schema|database\b/i, label: "data_integrity", weight: 2 },
  { pattern: /\benv|\.env|config\b/i, label: "config_change", weight: 2 },
  { pattern: /\bdependen|package\.json|npm install\b/i, label: "dependency_change", weight: 2 },
];

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Score dimension 1: Acceptance Criteria Coverage (0-30)
 * Checks how many acceptance criteria are referenced or evidenced.
 * We do keyword overlap between criteria text and evidence descriptions.
 */
function scoreAcceptanceCriteria(task: ColonyTask): EvaluationDimension {
  const criteria = task.acceptanceCriteria;
  if (criteria.length === 0) {
    return {
      name: "acceptance_criteria_coverage",
      score: 15, // no criteria = neutral, not penalized
      maxScore: 30,
      reason: "No acceptance criteria defined; assigned neutral score.",
    };
  }

  // Build a combined text from all evidence descriptions
  const evidenceText = task.evidence
    .map((e) => `${e.description ?? ""} ${e.type ?? ""}`)
    .join(" ")
    .toLowerCase();

  let matchedCount = 0;
  const matchDetails: string[] = [];

  for (const criterion of criteria) {
    // Extract meaningful keywords (3+ chars, skip stopwords)
    const keywords = extractKeywords(criterion);
    const matched = keywords.some((kw) => evidenceText.includes(kw));
    if (matched) {
      matchedCount++;
      matchDetails.push(`✓ "${truncate(criterion, 50)}"`);
    } else {
      matchDetails.push(`✗ "${truncate(criterion, 50)}"`);
    }
  }

  const coverage = matchedCount / criteria.length;
  const score = Math.round(coverage * 30);

  return {
    name: "acceptance_criteria_coverage",
    score,
    maxScore: 30,
    reason: `${matchedCount}/${criteria.length} criteria evidenced. ${matchDetails.join("; ")}`,
  };
}

/**
 * Score dimension 2: Evidence Presence & Quality (0-25)
 * More evidence = higher score. Diversity of evidence types also counts.
 */
function scoreEvidencePresence(task: ColonyTask): EvaluationDimension {
  const evidence = task.evidence;

  if (evidence.length === 0) {
    return {
      name: "evidence_presence",
      score: 0,
      maxScore: 25,
      reason: "No evidence attached to task.",
    };
  }

  // Quantity score (0-15): max at 4+ evidence items
  const quantityScore = Math.min(evidence.length * 4, 15);

  // Diversity score (0-10): unique evidence types
  const uniqueTypes = new Set(evidence.map((e) => e.type));
  const diversityScore = Math.min(uniqueTypes.size * 3, 10);

  // Depth score: evidence with longer descriptions = better
  const avgDescLength = evidence.reduce((sum, e) => sum + (e.description?.length ?? 0), 0) / evidence.length;
  const depthBonus = avgDescLength > 50 ? 0 : -3; // short descriptions are suspicious

  const score = clamp(quantityScore + diversityScore + depthBonus, 0, 25);

  return {
    name: "evidence_presence",
    score,
    maxScore: 25,
    reason: `${evidence.length} evidence item(s), ${uniqueTypes.size} unique type(s), avg description ${Math.round(avgDescLength)} chars.`,
  };
}

/**
 * Score dimension 3: Output Completeness (0-20)
 * Checks if the task has been fully processed through the pipeline.
 */
function scoreOutputCompleteness(task: ColonyTask): EvaluationDimension {
  let score = 0;
  const reasons: string[] = [];

  // Has objective been defined? (+4)
  if (task.objective && task.objective.length > 10) {
    score += 4;
    reasons.push("+4 objective defined");
  }

  // Has source of truth been referenced? (+4)
  if (task.sourceOfTruth && task.sourceOfTruth.length > 0) {
    score += 4;
    reasons.push("+4 source of truth referenced");
  }

  // Has description been written? (+3)
  if (task.description && task.description.length > 20) {
    score += 3;
    reasons.push("+3 description provided");
  }

  // Has at least one evidence with URL/path? (+5)
  const evidenceWithPath = task.evidence.filter((e) => e.url && e.url.length > 0);
  if (evidenceWithPath.length > 0) {
    score += 5;
    reasons.push(`+5 evidence with artifact reference (${evidenceWithPath.length})`);
  }

  // Has tags for categorization? (+2)
  if (task.tags && task.tags.length > 0) {
    score += 2;
    reasons.push("+2 tagged");
  }

  // Has estimated minutes? (+2)
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    score += 2;
    reasons.push("+2 estimated");
  }

  return {
    name: "output_completeness",
    score: clamp(score, 0, 20),
    maxScore: 20,
    reason: reasons.join("; ") || "No completeness indicators found.",
  };
}

/**
 * Score dimension 4: Risk Markers (0-15)
 * INVERSE scoring: fewer risk markers = higher score.
 * This does NOT penalize risky tasks — it flags if risk markers are present
 * without corresponding evidence of mitigation.
 */
function scoreRiskMarkers(task: ColonyTask): EvaluationDimension {
  const text = `${task.title} ${task.objective} ${task.description ?? ""}`.toLowerCase();
  const evidenceText = task.evidence.map((e) => e.description ?? "").join(" ").toLowerCase();

  const detectedRisks: string[] = [];
  let totalRiskWeight = 0;

  for (const rp of RISK_PATTERNS) {
    if (rp.pattern.test(text)) {
      // Risk detected in task definition — check if evidence addresses it
      const mitigationKeywords = getMitigationKeywords(rp.label);
      const hasMitigation = mitigationKeywords.some((mk) => evidenceText.includes(mk));

      if (hasMitigation) {
        detectedRisks.push(`⚠ ${rp.label} (mitigated)`);
      } else {
        detectedRisks.push(`🔴 ${rp.label} (unmitigated)`);
        totalRiskWeight += rp.weight;
      }
    }
  }

  // No risk markers detected = full score
  if (detectedRisks.length === 0) {
    return {
      name: "risk_markers",
      score: 15,
      maxScore: 15,
      reason: "No risk markers detected in task definition.",
    };
  }

  // Score decreases with unmitigated risk weight (max penalty = 15)
  const penalty = Math.min(totalRiskWeight, 15);
  const score = clamp(15 - penalty, 0, 15);

  return {
    name: "risk_markers",
    score,
    maxScore: 15,
    reason: `Detected: ${detectedRisks.join(", ")}. Unmitigated weight: ${totalRiskWeight}.`,
  };
}

/**
 * Score dimension 5: Status Consistency (0-10)
 * Checks if the task status is consistent with its evidence and state.
 */
function scoreStatusConsistency(task: ColonyTask): EvaluationDimension {
  let score = 0;
  const reasons: string[] = [];

  // Task in "done" should have evidence (+5)
  if (task.status === "done" && task.evidence.length > 0) {
    score += 5;
    reasons.push("+5 done with evidence");
  } else if (task.status === "done" && task.evidence.length === 0) {
    score += 0;
    reasons.push("+0 done without evidence (inconsistent)");
  }

  // Task in "review" should have evidence (+3)
  if (task.status === "review" && task.evidence.length > 0) {
    score += 3;
    reasons.push("+3 review with evidence");
  } else if (task.status === "review" && task.evidence.length === 0) {
    score += 0;
    reasons.push("+0 review without evidence (inconsistent)");
  }

  // Task in "blocked" should have blockedReason (+2)
  if (task.status === "blocked" && task.blockedReason && task.blockedReason.length > 0) {
    score += 2;
    reasons.push("+2 blocked with reason");
  } else if (task.status === "blocked" && (!task.blockedReason || task.blockedReason.length === 0)) {
    score += 0;
    reasons.push("+0 blocked without reason (inconsistent)");
  }

  // Task not in terminal state — neutral (+3)
  if (task.status !== "done" && task.status !== "archived") {
    score += 3;
    reasons.push("+3 non-terminal status (neutral)");
  }

  // Task has been updated recently (within 24h) (+2)
  const lastUpdate = new Date(task.lastUpdate).getTime();
  const now = Date.now();
  if (now - lastUpdate < 24 * 60 * 60 * 1000) {
    score += 2;
    reasons.push("+2 recently updated");
  }

  return {
    name: "status_consistency",
    score: clamp(score, 0, 10),
    maxScore: 10,
    reason: reasons.join("; ") || "No consistency indicators.",
  };
}

// ── Utility functions ─────────────────────────────────────────────────────────

function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "dan", "atau", "yang",
    "untuk", "dari", "dengan", "ini", "itu", "pada", "di", "ke", "oleh",
    "adalah", "akan", "tidak", "bisa", "harus", "jika", "maka", "serta",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopwords.has(w));
}

function getMitigationKeywords(riskLabel: string): string[] {
  const map: Record<string, string[]> = {
    destructive_action: ["backup", "rollback", "reversible", "recover", "safe"],
    security_sensitive: ["authenticated", "authorized", "validated", "encrypted", "hashed", "guard"],
    production_touch: ["staging", "tested", "verified", "dry-run", "safe"],
    data_integrity: ["migration", "backup", "validated", "transaction", "rollback"],
    config_change: ["reversible", "default", "documented", "tested"],
    dependency_change: ["audit", "lockfile", "tested", "compatible", "peer"],
  };
  return map[riskLabel] ?? [];
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ── Main evaluation function ──────────────────────────────────────────────────

/**
 * Evaluate a colony task and return a quality score (0-100).
 *
 * This is a deterministic, local scoring function. No LLM calls.
 * The score is advisory — it does NOT change approval gates.
 *
 * Usage:
 *   const result = evaluateTask(task);
 *   // Store result as evidence or in Redis
 */
export function evaluateTask(task: ColonyTask): EvaluationResult {
  const dimensions: EvaluationDimension[] = [
    scoreAcceptanceCriteria(task),
    scoreEvidencePresence(task),
    scoreOutputCompleteness(task),
    scoreRiskMarkers(task),
    scoreStatusConsistency(task),
  ];

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);

  let verdict: EvaluationResult["verdict"];
  if (totalScore >= 80) {
    verdict = "pass";
  } else if (totalScore >= 60) {
    verdict = "needs_review";
  } else {
    verdict = "fail";
  }

  return {
    taskId: task.taskId,
    evaluatedAt: new Date().toISOString(),
    totalScore,
    verdict,
    dimensions,
  };
}

/**
 * Convert an EvaluationResult into a TaskEvidence entry
 * that can be stored via taskEngine.addEvidence().
 */
export function evaluationToEvidence(result: EvaluationResult): TaskEvidence & { type: "other" } {
  const dimSummary = result.dimensions
    .map((d) => `${d.name}: ${d.score}/${d.maxScore}`)
    .join("; ");

  return {
    type: "other",
    description: `[quality_score] ${result.totalScore}/100 (${result.verdict}) — ${dimSummary}`,
    timestamp: result.evaluatedAt,
    agentRole: "reporter", // evaluation is an ops/reporter function
    quality_score: result.totalScore,
    quality_verdict: result.verdict,
    quality_dimensions: result.dimensions.map((d) => ({
      name: d.name,
      score: d.score,
      maxScore: d.maxScore,
      reason: d.reason,
    })),
  };
}

// ── Batch evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate multiple tasks and return results sorted by score (ascending).
 * Useful for triage: lowest scores first.
 */
export function evaluateTasksBatch(tasks: ColonyTask[]): EvaluationResult[] {
  return tasks
    .map((t) => evaluateTask(t))
    .sort((a, b) => a.totalScore - b.totalScore);
}

/**
 * Get a summary of evaluation results for reporting.
 */
export function formatEvaluationSummary(result: EvaluationResult): string {
  const lines = [
    `📊 Evaluation: ${result.taskId}`,
    `Score: ${result.totalScore}/100 — ${result.verdict.toUpperCase()}`,
    "",
  ];

  for (const d of result.dimensions) {
    const bar = "█".repeat(Math.round((d.score / d.maxScore) * 10)) +
                "░".repeat(10 - Math.round((d.score / d.maxScore) * 10));
    lines.push(`  ${bar} ${d.score}/${d.maxScore} ${d.name}`);
    lines.push(`    ${d.reason}`);
  }

  return lines.join("\n");
}
