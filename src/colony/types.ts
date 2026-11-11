// ============================================================================
// JAGAT Colony — Core Type Definitions
// Sovereign Internal Workforce Engine — Entity & State Machine
// ============================================================================
//
// Definisi ini mengikuti JAGAT_COLONY_MASTERPLAN.md dan
// JAGAT_COLONY_ACCESS_ARCHITECTURE.md secara ketat.
//
// Hierarki otoritas:
//   1. Founder direct instruction
//   2. Decision log terbaru
//   3. Execution masterplan
//   4. Jagat_G7.md
//   5. Backlog dan weekly loop
//   6. Dokumen memori pendukung
// ============================================================================

// ── Task State Machine ──────────────────────────────────────────────────────
// Setiap pekerjaan colony wajib memiliki salah satu status berikut.

export const TASK_STATUSES = [
  "queued",
  "planning",
  "approved",
  "running",
  "review",
  "blocked",
  "done",
  "archived",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// Valid state transitions — colony tasks tidak boleh melompat status sembarangan
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["planning", "archived"],
  planning: ["approved", "blocked", "archived"],
  approved: ["running", "blocked", "archived"],
  running: ["review", "blocked", "archived"],
  review: ["done", "running", "blocked", "archived"],
  blocked: ["queued", "planning", "approved", "running", "archived"],
  done: ["archived"],
  archived: [], // terminal state
};

// ── Task Priority ───────────────────────────────────────────────────────────

export const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// ── Colony Agent Roles ──────────────────────────────────────────────────────
// Per masterplan: 6 unit colony resmi

export const AGENT_ROLES = [
  "director",       // menerjemahkan arahan founder → mission → workstream
  "planner",        // menyusun urutan kerja, deteksi dependency
  "researcher",     // baca dokumen, kelola ingest, kurasi knowledge
  "builder",        // implementasi task teknis, buat patch, build & verify
  "reviewer",       // periksa hasil builder, audit risiko, cek regresi
  "reporter",       // tulis progres ke log, perbarui status, laporan
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

// ── Agent Status ────────────────────────────────────────────────────────────

export const AGENT_STATUSES = ["idle", "working", "paused", "offline", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// ── Human Roles ─────────────────────────────────────────────────────────────
// Per access architecture

export const HUMAN_ROLES = [
  "founder",            // Faturachman Al Kahfi — otoritas tertinggi
  "executive_product",  // eksekutif produk/operasi
  "executive_infra",    // eksekutif infrastruktur/kapital
  "internal_ops",       // admin internal terbatas
] as const;

export type HumanRole = (typeof HUMAN_ROLES)[number];

// ── Execution Phase ─────────────────────────────────────────────────────────
// Colony phases per masterplan C1-C7

export const COLONY_PHASES = [
  "C1", // Operating Model Lock
  "C2", // Founder Command Center
  "C3", // Internal Chat Room
  "C4", // Colony Task Engine
  "C5", // Worker Execution
  "C6", // 24/7 Scheduler
  "C7", // Voice / Meeting Layer
] as const;

export type ColonyPhase = (typeof COLONY_PHASES)[number];

// ── Core Entities ───────────────────────────────────────────────────────────

/**
 * Mission — arahan strategis dari founder yang dipecah menjadi workstreams & tasks
 */
export interface Mission {
  id: string;
  title: string;
  objective: string;
  phase: ColonyPhase;
  status: "active" | "completed" | "paused" | "cancelled";
  priority: TaskPriority;
  createdBy: string;           // founder ID
  createdAt: string;           // ISO 8601
  updatedAt: string;
  targetDate?: string;         // ISO 8601
  workstreamIds: string[];     // linked workstream IDs
  notes?: string;
  outcomeSummary?: MissionOutcomeSummary;
}

/**
 * MissionOutcomeSummary — rangkuman hasil mission saat completed
 * Generated automatically by completeMissionWithSummary()
 */
export interface MissionOutcomeSummary {
  completedAt: string;         // ISO 8601
  totalTasks: number;
  doneCount: number;
  blockedCount: number;
  reviewCount: number;
  runningCount: number;
  queuedCount: number;
  archivedCount: number;
  avgQualityScore: number | null;  // rata-rata quality_score dari evidence, null jika tidak ada
  qualityScoreCount: number;       // berapa task yang punya quality_score
  topQualityScore: number | null;
  lowestQualityScore: number | null;
  blockedReasons: string[];        // semua blockedReason dari blocked tasks
  summary: string;                 // human-readable summary
}

/**
 * ColonyTask — artefak wajib per task sesuai masterplan
 * Setiap task minimal menyimpan field-field yang didefinisikan di sini.
 */
export interface ColonyTask {
  taskId: string;
  /** Optimistic concurrency revision in the optional durable ledger. */
  ledgerVersion?: number;
  title: string;
  objective: string;
  phase: ColonyPhase;
  sourceOfTruth: string;        // dokumen referensi utama
  assignedAgent: AgentRole;
  status: TaskStatus;
  priority: TaskPriority;
  acceptanceCriteria: string[];
  dependencies: string[];       // task IDs yang harus selesai lebih dulu
  evidence: TaskEvidence[];     // bukti penyelesaian
  lastUpdate: string;           // ISO 8601
  founderApprovalRequired: boolean;
  // Extended fields
  missionId?: string;           // linked mission
  description?: string;
  blockedReason?: string;       // wajib diisi jika status = blocked
  createdAt: string;
  createdBy: string;
  tags?: string[];
  estimatedMinutes?: number;
  /** Memory context documents used when creating this task (from colony memory bridge) */
  contextDocumentsUsed?: Array<{
    title: string;
    source: string;
    category: string;
    score: number;
  }>;
}

/**
 * TaskEvidence — bukti penyelesaian task (wajib untuk status 'done')
 */
export interface TaskEvidence {
  type: "code_change" | "document" | "test_result" | "review_verdict" | "screenshot" | "log" | "other";
  description: string;
  url?: string;                 // path atau URL ke artefak
  timestamp: string;            // ISO 8601
  agentRole: AgentRole;
  // Optional quality metadata (populated by evaluation engine)
  quality_score?: number;
  quality_verdict?: string;
  quality_dimensions?: Array<{ name: string; score: number; maxScore: number; reason: string }>;
}

/**
 * TaskTransitionLog — audit trail perubahan status
 */
export interface TaskTransitionLog {
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  reason: string;
  actor: string;                // agent role atau human role
  timestamp: string;            // ISO 8601
}

// ── Agent Entity ────────────────────────────────────────────────────────────

/**
 * ColonyAgent — registrasi agent dalam colony
 */
export interface ColonyAgent {
  agentId: string;
  role: AgentRole;
  displayName: string;
  status: AgentStatus;
  currentTaskId?: string;       // task yang sedang dikerjakan
  capabilities: string[];       // daftar kemampuan spesifik
  permissions: AgentPermission;
  lastHeartbeat?: string;       // ISO 8601
  totalTasksCompleted: number;
  createdAt: string;
}

/**
 * AgentPermission — boundary akses per agent role
 * Per JAGAT_COLONY_ACCESS_ARCHITECTURE.md
 *
 * C5B-0: Added filesystem permission fields for controlled worker execution.
 * canApplyPatch is ALWAYS false for agents — only system after founder approval.
 */
export interface AgentPermission {
  canReadMission: boolean;
  canReadQueue: boolean;
  canUpdateAssignment: boolean;
  canReadMasterplan: boolean;
  canReadBacklog: boolean;
  canCreateTask: boolean;
  canWriteCode: boolean;
  canRunBuild: boolean;
  canReviewCode: boolean;
  canWriteReport: boolean;
  canUpdateStatus: boolean;
  canApprove: boolean;          // hanya founder, bukan agent
  canAccessPublicLayer: boolean;
  // ── C5B Filesystem Permissions ──────────────────────────────────────
  canReadCodebase: boolean;     // boleh baca file di codebase via sandbox
  canSearchCodebase: boolean;   // boleh grep/search di codebase via sandbox
  canProposePatch: boolean;     // boleh menghasilkan diff proposal (C5B-2)
  canApplyPatch: boolean;       // SELALU false untuk agent — hanya founder/system
}

// Default permission sets per role
// C5B-0: All agents have canApplyPatch = false. Only system applies patches after founder approval.
export const DEFAULT_PERMISSIONS: Record<AgentRole, AgentPermission> = {
  director: {
    canReadMission: true,
    canReadQueue: true,
    canUpdateAssignment: true,
    canReadMasterplan: true,
    canReadBacklog: true,
    canCreateTask: true,
    canWriteCode: false,
    canRunBuild: false,
    canReviewCode: false,
    canWriteReport: false,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: false,
    canSearchCodebase: false,
    canProposePatch: false,
    canApplyPatch: false,
  },
  planner: {
    canReadMission: true,
    canReadQueue: true,
    canUpdateAssignment: false,
    canReadMasterplan: true,
    canReadBacklog: true,
    canCreateTask: true,
    canWriteCode: false,
    canRunBuild: false,
    canReviewCode: false,
    canWriteReport: false,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: true,
    canSearchCodebase: true,
    canProposePatch: false,
    canApplyPatch: false,
  },
  researcher: {
    canReadMission: true,
    canReadQueue: true,
    canUpdateAssignment: false,
    canReadMasterplan: true,
    canReadBacklog: true,
    canCreateTask: false,
    canWriteCode: false,
    canRunBuild: false,
    canReviewCode: false,
    canWriteReport: true,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: true,
    canSearchCodebase: true,
    canProposePatch: false,
    canApplyPatch: false,
  },
  builder: {
    canReadMission: false,
    canReadQueue: true,
    canUpdateAssignment: false,
    canReadMasterplan: false,
    canReadBacklog: false,
    canCreateTask: false,
    canWriteCode: true,
    canRunBuild: true,
    canReviewCode: false,
    canWriteReport: false,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: true,
    canSearchCodebase: true,
    canProposePatch: true,
    canApplyPatch: false,
  },
  reviewer: {
    canReadMission: false,
    canReadQueue: true,
    canUpdateAssignment: false,
    canReadMasterplan: true,
    canReadBacklog: false,
    canCreateTask: false,
    canWriteCode: false,
    canRunBuild: true,
    canReviewCode: true,
    canWriteReport: true,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: true,
    canSearchCodebase: true,
    canProposePatch: false,
    canApplyPatch: false,
  },
  reporter: {
    canReadMission: true,
    canReadQueue: true,
    canUpdateAssignment: false,
    canReadMasterplan: true,
    canReadBacklog: true,
    canCreateTask: false,
    canWriteCode: false,
    canRunBuild: false,
    canReviewCode: false,
    canWriteReport: true,
    canUpdateStatus: true,
    canApprove: false,
    canAccessPublicLayer: false,
    canReadCodebase: false,
    canSearchCodebase: false,
    canProposePatch: false,
    canApplyPatch: false,
  },
};

// ── Worker Action Tracking (C5B) ────────────────────────────────────────────

/**
 * WorkerAction — tracks every filesystem operation performed by an agent.
 * Every read, search, or proposed patch is recorded for founder transparency.
 */
export interface WorkerAction {
  actionId: string;
  taskId: string;
  agentRole: AgentRole;
  type: "file_read" | "dir_list" | "search" | "read_lines" | "patch_propose" | "patch_apply" | "build_run";
  target: string;           // file path atau search query
  status: "completed" | "denied" | "failed";
  resultSummary?: string;   // e.g., "read 245 lines" or "denied: path outside sandbox"
  bytesRead?: number;       // size of data read
  timestamp: string;        // ISO 8601
}

// ── Patch Proposal Entities (C5B-2) ─────────────────────────────────────────

/**
 * PatchStatus — lifecycle of a patch proposal.
 * Only the system (via founder /patch-approve) can move to "applied".
 * Agents can only move to "pending".
 */
export type PatchStatus =
  | "draft"        // agent sedang menyiapkan, belum disubmit
  | "pending"      // disubmit ke founder, menunggu review
  | "approved"     // founder approve — siap diapply oleh system
  | "rejected"     // founder tolak — tidak diapply
  | "applied"      // system berhasil apply ke disk
  | "apply_failed" // system gagal apply (konflik, stale diff, dll)
  | "expired";     // tidak direspons dalam TTL (48 jam)

/**
 * PatchHunk — satu blok perubahan pada satu file.
 * originalContent diverifikasi terhadap file aktual sebelum proposal masuk.
 */
export interface PatchHunk {
  filePath: string;        // relative to JAGAT root, e.g. "src/colony/types.ts"
  startLine: number;       // line number perubahan dimulai (1-indexed)
  endLine: number;         // line number perubahan berakhir
  originalContent: string; // teks asli yang akan diganti — HARUS cocok persis dengan file
  proposedContent: string; // teks yang diusulkan sebagai pengganti
  unifiedDiff: string;     // "--- a/path\n+++ b/path\n@@ ... @@\n..."
}

/**
 * PatchProposal — usulan perubahan kode yang dihasilkan builder agent.
 * Tidak ada apply sampai founder explicit approve via /patch-approve.
 * Semua proposal disimpan di Redis dengan TTL 48 jam untuk expired check.
 *
 * Training data: field trainingDataTags dan trainingDataReady dipakai
 * untuk pipeline training data factory JAGAT Monster.
 */
export interface PatchProposal {
  proposalId: string;          // PATCH-yyyyMMdd-NNNN
  taskId: string;              // task yang memicu proposal
  agentRole: AgentRole;        // hanya "builder" dalam praktik C5B-2
  agentName: string;

  // Isi proposal
  title: string;               // ringkasan singkat apa yang diubah
  rationale: string;           // reasoning agent kenapa perubahan ini diperlukan
  hunks: PatchHunk[];          // daftar perubahan per file
  filesAffected: string[];     // derived dari hunks — untuk tampilan cepat
  estimatedRisk: "low" | "medium" | "high"; // self-assessment agent

  // Evidence dan konteks (untuk audit dan training data)
  contextFiles: string[];      // file yang dibaca sebelum membuat proposal
  searchQueries: string[];     // search yang dilakukan sebelum proposal
  evidenceSummary: string;     // ringkasan analisis yang mendasari proposal

  // Lifecycle
  status: PatchStatus;
  createdAt: string;           // ISO 8601
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;         // founder display name
  reviewNote?: string;
  appliedAt?: string;
  applyError?: string;

  // Training data metadata (JAGAT Monster / Apex 7)
  trainingDataTags: string[];  // ["bug_fix", "refactor", "governance", "security", ...]
  trainingDataReady: boolean;  // founder flag — default false, set true saat approve jika layak
}

// ── Chat / Meeting Entities ─────────────────────────────────────────────────

/**
 * ChatMessage — pesan di internal chat room colony
 */
export interface ChatMessage {
  messageId: string;
  roomId: string;
  senderId: string;             // agent ID, human ID, atau "founder"
  senderRole: AgentRole | HumanRole;
  senderName: string;
  content: string;
  timestamp: string;            // ISO 8601
  replyToId?: string;           // threading
  linkedTaskId?: string;        // chat-to-task linking
  linkedMissionId?: string;
  messageType: "text" | "status_update" | "approval_request" | "approval_response" | "system" | "command" | "command_response" | "agent_ack" | "agent_update" | "directive" | "directive_proposal";
}

/**
 * ChatRoom — internal meeting/chat room
 */
export interface ChatRoom {
  roomId: string;
  name: string;
  type: "general" | "mission" | "meeting" | "direct";
  participants: string[];       // agent/human IDs
  createdAt: string;
  lastActivity: string;
  linkedMissionId?: string;
  isArchived: boolean;
}

// ── Approval Entity ─────────────────────────────────────────────────────────

/**
 * ApprovalRequest — permintaan approval ke founder
 */
export interface ApprovalRequest {
  approvalId: string;
  taskId: string;
  requestedBy: string;          // agent role
  requestedAt: string;          // ISO 8601
  type: "task_start" | "task_completion" | "architecture_change" | "priority_change" | "mission_close";
  description: string;
  status: "pending" | "approved" | "rejected";
  respondedAt?: string;
  respondedBy?: string;
  responseNote?: string;
}

// ── Daily/Weekly Summary ────────────────────────────────────────────────────

/**
 * ColonySummary — ringkasan periodik untuk founder
 */
export interface ColonySummary {
  summaryId: string;
  type: "daily" | "weekly";
  period: string;               // e.g., "2026-05-27" or "2026-W22"
  generatedAt: string;
  generatedBy: string;          // reporter agent ID
  tasksCompleted: number;
  tasksBlocked: number;
  tasksInProgress: number;
  blockerDetails: BlockerDetail[];
  highlights: string[];
  pendingApprovals: number;
  recommendations: string[];
}

export interface BlockerDetail {
  taskId: string;
  taskTitle: string;
  reason: string;
  since: string;                // ISO 8601
  suggestedAction?: string;
}

// ── Redis Key Schema ────────────────────────────────────────────────────────
// Centralized key definitions for colony state in Redis

export const REDIS_KEYS = {
  // Tasks
  task: (taskId: string) => `colony:task:${taskId}`,
  taskIndex: () => "colony:tasks:index",                          // sorted set by priority
  tasksByStatus: (status: TaskStatus) => `colony:tasks:status:${status}`,
  tasksByAgent: (agentId: string) => `colony:tasks:agent:${agentId}`,
  taskTransitionLog: (taskId: string) => `colony:task:${taskId}:transitions`,

  // Missions
  mission: (missionId: string) => `colony:mission:${missionId}`,
  missionIndex: () => "colony:missions:index",

  // Agents
  agent: (agentId: string) => `colony:agent:${agentId}`,
  agentIndex: () => "colony:agents:index",
  agentHeartbeat: (agentId: string) => `colony:agent:${agentId}:heartbeat`,

  // Chat
  chatRoom: (roomId: string) => `colony:chat:room:${roomId}`,
  chatMessages: (roomId: string) => `colony:chat:messages:${roomId}`,
  chatRoomIndex: () => "colony:chat:rooms:index",

  // Approvals
  approval: (approvalId: string) => `colony:approval:${approvalId}`,
  pendingApprovals: () => "colony:approvals:pending",

  // Summaries
  summary: (summaryId: string) => `colony:summary:${summaryId}`,
  latestSummary: (type: "daily" | "weekly") => `colony:summary:latest:${type}`,

  // Counters & Sequences
  taskSequence: () => "colony:seq:task",
  missionSequence: () => "colony:seq:mission",
  approvalSequence: () => "colony:seq:approval",
  messageSequence: () => "colony:seq:message",

  // Audit Log
  auditLog: () => "colony:audit:log",
  auditByActor: (actor: string) => `colony:audit:by_actor:${actor}`,

  // Worker Actions (C5B)
  workerActions: (taskId: string) => `colony:worker:actions:${taskId}`,
  workerActionIndex: () => "colony:worker:actions:index",

  // Patch Proposals (C5B-2)
  patchProposal: (proposalId: string) => `colony:patch:${proposalId}`,
  patchByTask: (taskId: string) => `colony:patch:by_task:${taskId}`,
  pendingPatches: () => "colony:patch:pending",
  patchIndex: () => "colony:patch:index",
  patchSequence: () => "colony:seq:patch",

  // Cognitive Distillation Records (COG-2)
  distillationRecord: (recordId: string) => `colony:distillation:${recordId}`,
  distillationIndex: () => "colony:distillation:index",
  distillationByStatus: (status: "pending_review" | "auto_accepted" | "needs_founder_review" | "accepted" | "rejected") => `colony:distillation:status:${status}`,
  distillationSequence: () => "colony:seq:distillation",

  // Lessons (Phase 4)
  lesson: (lessonId: string) => `colony:lesson:${lessonId}`,
  lessonIndex: () => "colony:lessons:index",
  lessonsByMission: (missionId: string) => `colony:lessons:by_mission:${missionId}`,
  lessonSequence: () => "colony:seq:lesson",

  // Verifications (Phase 5)
  verification: (proposalId: string) => `colony:verification:${proposalId}`,
  verificationIndex: () => "colony:verifications:index",

  // Model Arena (Phase 6)
  arenaSummary: (modelId: string, taskType: string) => `colony:arena:summary:${modelId}:${taskType}`,
  arenaRecords: (modelId: string, taskType: string) => `colony:arena:records:${modelId}:${taskType}`,
  arenaIndex: () => "colony:arena:index",
  arenaRuntimeEvents: () => "colony:arena:runtime:events",
} as const;

// ── Audit Types ─────────────────────────────────────────────────────────────

export type AuditAction =
  | "colony.bootstrap"
  | "mission.create"
  | "mission.update"
  | "task.create"
  | "task.status_change"
  | "task.evidence_add"
  | "approval.create"
  | "approval.respond"
  | "approval.timeout"
  | "agent.status_change"
  | "chat.message_send"
  | "chat.room_create"
  | "memory.context_query"
  | "directive.interpret"
  | "directive.approve_draft"
  | "directive.reject_draft"
  | "auth.login"
  | "auth.logout"
  | "session.created"
  | "session.invalid_signature"
  // Autonomous scheduler
  | "scheduler.claim"
  | "scheduler.tick"
  | "reporter.summary"
  // C5B Worker Actions
  | "worker.file_read"
  | "worker.dir_list"
  | "worker.search"
  | "worker.read_lines"
  | "worker.patch_propose"
  | "worker.patch_apply"
  | "worker.build_run"
  | "worker.denied"
  | "worker.execution_start"
  | "worker.execution_complete"
  // C5B-2 Patch Proposal Actions
  | "patch.propose"
  | "patch.hunk_mismatch"
  | "patch.approve"
  | "patch.reject"
  | "patch.apply"
  | "patch.apply_failed"
  | "patch.expired"
  // F4: Training Data Export
  | "training.export"
  // COG-2: Cognitive distillation records
  | "distillation.capture"
  | "distillation.screen"
  | "distillation.review"
  | "distillation.export";

// ── Utility Types ───────────────────────────────────────────────────────────

export type ColonyEventType =
  | "task_created"
  | "task_status_changed"
  | "task_assigned"
  | "mission_created"
  | "mission_completed"
  | "approval_requested"
  | "approval_responded"
  | "agent_registered"
  | "agent_status_changed"
  | "chat_message"
  | "summary_generated"
  | "blocker_raised"
  | "blocker_resolved";

export interface ColonyEvent {
  eventId: string;
  type: ColonyEventType;
  payload: Record<string, unknown>;
  timestamp: string;
  actor: string;
}

// ── Lesson Memory (Phase 4) ─────────────────────────────────────────────────

export const LESSON_CATEGORIES = [
  "quality_high",
  "quality_low",
  "blocked_pattern",
  "scope_change",
  "general",
] as const;

export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

/**
 * ColonyLesson — lesson learned dari completed mission.
 * Provenance: missionId, taskIds, score, createdAt, source.
 * Storage: Redis only. TIDAK menulis ke Qdrant sovereign memory.
 */
export interface ColonyLesson {
  lessonId: string;
  missionId: string;
  taskIds: string[];
  category: LessonCategory;
  title: string;
  content: string;
  score: number | null;
  createdAt: string;             // ISO 8601
  source: "mission_outcome";
  tags: string[];
}

export interface PlannerLessonAdvisory {
  lessonId: string;
  missionId: string;
  category: LessonCategory;
  title: string;
  content: string;
  score: number | null;
  createdAt: string;
  source: "mission_outcome";
  tags: string[];
  relevanceScore: number;
  relevanceReasons: string[];
}

export interface PlannerLessonContext {
  query: string;
  missionId?: string;
  generatedAt: string;
  storage: "redis_only";
  actionPolicy: "advisory_only";
  lessons: PlannerLessonAdvisory[];
}

// ── Verifier Gate (Phase 5) ─────────────────────────────────────────────────

export interface VerificationCheck {
  name: string;                    // e.g. "typecheck", "build"
  command: string;                 // command that was run
  exitCode: number | null;         // null = not yet executed
  stdout: string;                  // truncated to 2000 chars
  stderr: string;                  // truncated to 2000 chars
  passed: boolean | null;          // null = not yet executed
  executedAt: string | null;       // ISO 8601
}

export interface PatchVerification {
  proposalId: string;
  status: "pending" | "verified" | "failed";
  checks: VerificationCheck[];
  verifiedAt: string | null;       // ISO 8601, set when all checks pass
  createdAt: string;               // ISO 8601
}

// ── Model Arena (Phase 6) ───────────────────────────────────────────────────

export interface ModelArenaEntry {
  modelId: string;
  taskType: string;
  avgScore: number | null;
  avgLatencyMs: number | null;
  sampleCount: number;
  recommendation: string;
  lastUpdatedAt: string;           // ISO 8601
}

export interface ModelArenaRecord {
  modelId: string;
  taskType: string;
  score: number;                   // 0-100
  latencyMs: number;
  recordedAt: string;              // ISO 8601
  source: string;                  // "benchmark" | "runtime" | "manual"
}

// ── T-043: Runtime Arena Event (observability only, no quality score) ────────

export type RuntimeArenaOutcome = "success" | "failed";

export interface RuntimeArenaEvent {
  eventId: string;
  modelId: string;
  taskType: string;                // phase or agent role
  latencyMs: number;
  outcome: RuntimeArenaOutcome;
  source: string;                  // "worker-executor" | "manual" | "test"
  taskId?: string;
  agentRole?: string;
  errorCode?: string;
  recordedAt: string;              // ISO 8601
}
