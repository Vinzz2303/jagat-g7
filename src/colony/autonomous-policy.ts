// ============================================================================
// JAGAT Colony — Autonomous Policy Guard
// Runtime rules for deciding which tasks may run without founder approval.
// ============================================================================

import {
  DEFAULT_PERMISSIONS,
  type AgentRole,
  type ColonyPhase,
  type TaskPriority,
} from "./types.js";

export type AutonomyRiskLevel = "low" | "medium" | "high";
export type AutonomyExecutionMode = "autonomous_allowed" | "founder_approval_required";

export interface TaskAutonomyInput {
  assignedAgent: AgentRole;
  phase: ColonyPhase;
  priority: TaskPriority;
  title?: string;
  objective?: string;
  tags?: string[];
}

export interface TaskAutonomyPolicy {
  riskLevel: AutonomyRiskLevel;
  founderApprovalRequired: boolean;
  executionMode: AutonomyExecutionMode;
  reasons: string[];
}

const HIGH_RISK_KEYWORDS = [
  "apply",
  "patch",
  "write",
  "delete",
  "auth",
  "secret",
  "token",
  "env",
  "production",
  "deploy",
  "scheduler",
  "worker",
  "payment",
  "billing",
];
const BUILDER_PROPOSAL_OPT_IN_TAG = "founder-approved-low-risk-patch-proposal";

export function assessTaskAutonomyPolicy(input: TaskAutonomyInput): TaskAutonomyPolicy {
  // Defense-in-depth: verify permissions exist (task-engine validates at creation, but guard here too).
  const permissions = DEFAULT_PERMISSIONS[input.assignedAgent];
  if (!permissions) {
    return {
      riskLevel: "high",
      founderApprovalRequired: true,
      executionMode: "founder_approval_required",
      reasons: [`unknown_agent_role:${input.assignedAgent}`],
    };
  }
  const reasons: string[] = [];
  const scopedBuilderProposal = input.assignedAgent === "builder"
    && input.phase === "C6"
    && input.priority === "low"
    && (input.tags ?? []).includes(BUILDER_PROPOSAL_OPT_IN_TAG);

  if (input.priority === "critical" || input.priority === "high") {
    reasons.push(`priority:${input.priority}`);
  }

  if (permissions.canWriteCode && !scopedBuilderProposal) reasons.push("agent_can_write_code");
  if (permissions.canRunBuild && !scopedBuilderProposal) reasons.push("agent_can_run_build");
  if (permissions.canProposePatch && !scopedBuilderProposal) reasons.push("agent_can_propose_patch");
  if (permissions.canApplyPatch) reasons.push("agent_can_apply_patch");

  const searchable = [
    input.title ?? "",
    input.objective ?? "",
    ...(input.tags ?? []),
  ].join(" ").toLowerCase();

  const blockedKeywords = scopedBuilderProposal
    ? HIGH_RISK_KEYWORDS.filter((keyword) => keyword !== "patch" && keyword !== "write")
    : HIGH_RISK_KEYWORDS;
  for (const keyword of blockedKeywords) {
    if (searchable.includes(keyword)) {
      reasons.push(`keyword:${keyword}`);
    }
  }

  if (input.phase === "C5" || (input.phase === "C6" && !scopedBuilderProposal)) {
    reasons.push(`phase:${input.phase}`);
  }

  const founderApprovalRequired = reasons.some((reason) =>
    reason.startsWith("priority:")
    || reason === "agent_can_write_code"
    || reason === "agent_can_run_build"
    || reason === "agent_can_propose_patch"
    || reason === "agent_can_apply_patch"
    || reason === "phase:C6"
    || reason.startsWith("keyword:"),
  );

  const riskLevel: AutonomyRiskLevel = scopedBuilderProposal && !founderApprovalRequired
    ? "low"
    : founderApprovalRequired
    ? "high"
    : permissions.canReadCodebase || permissions.canSearchCodebase
      ? "medium"
      : "low";

  return {
    riskLevel,
    founderApprovalRequired,
    executionMode: founderApprovalRequired ? "founder_approval_required" : "autonomous_allowed",
    reasons,
  };
}
