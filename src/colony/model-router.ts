// ============================================================================
// JAGAT Colony — Model Router
// Menentukan model mana yang tepat untuk setiap task berdasarkan Garuda Ladder.
// Routing hanya informatif/advisory — tidak mengubah infrastructure atau env.
// ============================================================================

import type { AgentRole, ColonyTask } from "./types.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type GarudaLevel = "L1" | "L2" | "L3" | "L4" | "L5";
export type ModelHost = "remote" | "local" | "external";

export interface ModelRoutingDecision {
  /** Garuda Ladder level required for this task */
  garudaLevel: GarudaLevel;
  /** Human-readable name for logging */
  garudaLevelName: string;
  /** Recommended model string (or descriptive name for external) */
  recommendedModel: string;
  /** Where to run the model */
  host: ModelHost;
  /** Whether this task can be served by local Ollama workers */
  locallyServable: boolean;
  /** Primary reason for routing decision */
  reason: string;
  /** Routing rules that triggered */
  triggeredRules: string[];
}

// ── Garuda Ladder Constants ──────────────────────────────────────────────────

const LEVEL_NAMES: Record<GarudaLevel, string> = {
  L1: "Bara (Draft Worker)",
  L2: "Cakra (Coding Worker)",
  L3: "Wisesa (Reviewer)",
  L4: "Garuda (Architect)",
  L5: "Garuda Inti (Sovereign Core)",
};

/**
 * Models available on Server B (Tailscale 100.107.244.82).
 * These are the only models that can be served locally without Codex/frontier.
 */
const REMOTE_MODELS = {
  fast: "qwen2.5-coder:7b",   // L1-L2: drafting, light coding — 5.25 tok/s
  review: "qwen2.5-coder:14b", // L2-L3: deeper coding/review — 2.59 tok/s
} as const;

/**
 * High-risk keyword patterns. If a task matches these, it escalates to L3+
 * regardless of assigned role. These signals indicate founder-gate is needed.
 */
const HIGH_RISK_PATTERNS =
  /\b(deploy|deployment|billing|credential|secret|token|auth|security|production|bypass|exploit|admin|password|api[_-]?key|env|dotenv|openclaw)\b/i;

/**
 * Security-sensitive Colony files. Tasks that reference these patterns in
 * title/objective should always escalate to L4+.
 */
const SECURITY_FILE_PATTERNS =
  /\b(auth-engine|access-architecture|gap-audit|risk-register|colony-handoff|patch-engine|applyPatch)\b/i;

/**
 * Roles that are always light-weight documentation/reporting.
 * These are safe to route to L1 by default regardless of keywords.
 */
const REPORTER_ROLES = new Set<AgentRole>(["reporter"]);

/**
 * Roles that may need L2-L3 depending on task content.
 */
const CODER_ROLES = new Set<AgentRole>(["builder", "reviewer"]);

// ── Core Routing Logic ───────────────────────────────────────────────────────

/**
 * Determine the appropriate Garuda Ladder level and model for a Colony task.
 *
 * Rules (in priority order — matches actual code order):
 * 1. founderApprovalRequired → L4 minimum (always external/Codex)
 * 2. SECURITY_FILE_PATTERNS in title/objective → L4 (external)
 * 3. HIGH_RISK_PATTERNS in title/objective → L3 minimum (external)
 * 4. Reporter roles → L1 (fast remote)
 * 5. Planner/researcher → L2 (fast remote)
 * 6. Builder/reviewer + high priority → L3 (external)
 * 7. Builder/reviewer + normal/low priority → L2 (review remote)
 * 8. Director → L4 (always architect-level)
 * 9. Default → L1 (fast remote)
 */
export function routeModelForTask(task: ColonyTask): ModelRoutingDecision {
  const haystack = `${task.title} ${task.objective} ${task.tags?.join(" ") ?? ""}`.toLowerCase();
  const triggered: string[] = [];

  // Rule 1: Founder approval required → always external
  if (task.founderApprovalRequired) {
    triggered.push("founder_approval_required");
    return buildDecision("L4", "external", "Codex/MiMo (founder-gated)", false,
      "Task requires founder approval — external frontier model only.", triggered);
  }

  // Rule 2: Security file references → L4 external
  if (SECURITY_FILE_PATTERNS.test(haystack)) {
    triggered.push("security_file_reference");
    return buildDecision("L4", "external", "Codex/MiMo (security-sensitive)", false,
      "Task references security-sensitive Colony files — requires frontier model review.", triggered);
  }

  // Rule 3: High-risk keyword → L3 external
  if (HIGH_RISK_PATTERNS.test(haystack)) {
    triggered.push("high_risk_keyword");
    return buildDecision("L3", "external", "Codex/MiMo (high-risk keyword)", false,
      "Task contains high-risk keyword — requires senior review before execution.", triggered);
  }

  // Rule 4: Reporter roles → always L1 (safe to auto-route)
  if (REPORTER_ROLES.has(task.assignedAgent)) {
    triggered.push("reporter_role");
    return buildDecision("L1", "remote", REMOTE_MODELS.fast, true,
      "Reporter/ops tasks are always light-weight drafting.", triggered);
  }

  // Rule 5: Planner / researcher → L2 (fast remote)
  if (task.assignedAgent === "planner" || task.assignedAgent === "researcher") {
    triggered.push("planner_researcher_role");
    return buildDecision("L2", "remote", REMOTE_MODELS.fast, true,
      "Planner/researcher tasks use fast remote worker for context analysis.", triggered);
  }

  // Rule 6: Builder / reviewer + high priority → L3 (external — current L2 models 0/20 on instruction discipline)
  if (CODER_ROLES.has(task.assignedAgent) && task.priority === "high") {
    triggered.push("coder_high_priority");
    return buildDecision("L3", "external", "Codex/MiMo (high-priority coding)", false,
      "High-priority coding/review tasks require L3+ Wisesa reviewer — remote models are L2 Cakra only.", triggered);
  }

  // Rule 7: Builder / reviewer + normal/low priority → L2 (review remote)
  if (CODER_ROLES.has(task.assignedAgent)) {
    triggered.push("coder_normal_priority");
    return buildDecision("L2", "remote", REMOTE_MODELS.review, true,
      "Normal-priority coding/review uses 14B remote worker (L2 Cakra).", triggered);
  }

  // Rule 8: Director → L4 (always architect-level)
  if (task.assignedAgent === "director") {
    triggered.push("director_role");
    return buildDecision("L4", "external", "Codex/MiMo (architecture decision)", false,
      "Director-level decisions require L4 Garuda architect-level reasoning.", triggered);
  }

  // Default: L1 fast remote
  triggered.push("default");
  return buildDecision("L1", "remote", REMOTE_MODELS.fast, true,
    "Default routing to fast remote worker.", triggered);
}

/**
 * Convenience: check if a task can be served by the local Ollama/remote workers,
 * or if it must be deferred to external frontier model (Codex, MiMo).
 */
export function isLocallyServable(task: ColonyTask): boolean {
  return routeModelForTask(task).locallyServable;
}

/**
 * Return a short human-readable routing summary for logging and audit.
 */
export function formatRoutingDecision(decision: ModelRoutingDecision): string {
  const servable = decision.locallyServable ? "locally-servable" : "external-required";
  return `[ModelRouter] ${decision.garudaLevel} ${decision.garudaLevelName} → ${decision.recommendedModel} (${decision.host}, ${servable}) — ${decision.reason}`;
}

// ── Private Helpers ──────────────────────────────────────────────────────────

function buildDecision(
  level: GarudaLevel, // already typed; note: all callers pass hardcoded literals
  host: ModelHost,
  model: string,
  locallyServable: boolean,
  reason: string,
  triggeredRules: string[],
): ModelRoutingDecision {
  return {
    garudaLevel: level,
    garudaLevelName: LEVEL_NAMES[level],
    recommendedModel: model,
    host,
    locallyServable,
    reason,
    triggeredRules,
  };
}
