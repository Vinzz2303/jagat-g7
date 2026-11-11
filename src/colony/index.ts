// ============================================================================
// JAGAT Colony — Module Index
// Re-export semua colony engine components
// ============================================================================

export * from "./types.js";
export * as taskEngine from "./task-engine.js";
export * as missionEngine from "./mission-engine.js";
export * as agentRegistry from "./agent-registry.js";
export * as chatEngine from "./chat-engine.js";
export * as approvalEngine from "./approval-engine.js";
export * as auditEngine from "./audit-engine.js";
export * as commandEngine from "./command-engine.js";
export * as agentSimulator from "./agent-simulator.js";
export * as memoryReader from "./memory-reader.js";
export * as directiveEngine from "./directive-engine.js";
export * as autonomousPolicy from "./autonomous-policy.js";
export * as schedulerQueue from "./scheduler-queue.js";
export * as schedulerLoop from "./scheduler-loop.js";
export * as reporterEngine from "./reporter-engine.js";
export * as distillationEngine from "./distillation-engine.js";
export * as modelRouter from "./model-router.js";
export * as evaluationEngine from "./evaluation-engine.js";
export * as lessonEngine from "./lesson-engine.js";
export * as verifierEngine from "./verifier-engine.js";
export * as modelArena from "./model-arena.js";
// C5B: Worker execution layer
export * as workerSandbox from "./worker-sandbox.js";
export * as workerExecutor from "./worker-executor.js";
// WhatsApp notification layer
export * as whatsappAdapter from "./whatsapp-adapter.js";
export * as notificationDispatcher from "./notification-dispatcher.js";

// C5B-2: Patch proposal engine — EXPLICIT allowlist.
// applyPatch() is intentionally NOT re-exported here.
// It is only reachable via command-engine which imports patch-engine.js directly.
export {
  // Proposal lifecycle (agent-safe)
  submitProposal,
  getProposal,
  listPendingProposals,
  listProposalsByTask,
  approveProposal,
  rejectProposal,
  // Formatting (display only)
  formatProposalSummary,
  formatProposalDetail,
  formatProposalList,
  // F4: Training data export
  listAllProposals,
  exportTrainingData,
  formatTrainingExportSummary,
  // Types
  type TrainingRecord,
  type TrainingExportStats,
  // Error class
  PatchEngineError,
} from "./patch-engine.js";
