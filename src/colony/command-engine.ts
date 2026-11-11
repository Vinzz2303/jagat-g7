// ============================================================================
// JAGAT Colony — Command Engine
// Parses founder chat commands and executes colony operations
// Commands are detected by "/" prefix in chat messages from founder role.
// ============================================================================

import { taskEngine, missionEngine, approvalEngine, auditEngine, memoryReader, directiveEngine } from "./index.js";
import { getWorkerActions, formatWorkerReport, getSandboxConfig } from "./worker-sandbox.js";
import {
  listPendingProposals,
  listProposalsByTask,
  getProposal,
  approveProposal,
  rejectProposal,
  applyPatch,
  formatProposalList,
  formatProposalDetail,
  exportTrainingData,
  formatTrainingExportSummary,
} from "./patch-engine.js";
import type { AgentRole, ColonyPhase } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  taskId?: string;
  missionId?: string;
  data?: Record<string, unknown>;
}

// ── Valid Agent Roles for /task ──────────────────────────────────────────────

const VALID_AGENTS: AgentRole[] = ["director", "planner", "researcher", "builder", "reviewer", "reporter"];

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a chat message into a command if it starts with "/".
 * Returns null for regular messages.
 */
export function parseCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0]!.slice(1).toLowerCase(); // Remove "/" prefix
  const args = parts.slice(1);

  if (!command) return null;

  return { command, args, raw: trimmed };
}

// ── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute a parsed command and return the result.
 * Only founder role may execute commands.
 */
export async function executeCommand(
  cmd: ParsedCommand,
  actor: string,
  actorRole: string,
  roomId: string,
): Promise<CommandResult> {
  // Only founder can execute commands
  if (actorRole !== "founder") {
    return { success: false, message: "Hanya founder yang boleh menjalankan command." };
  }

  switch (cmd.command) {
    case "task":
      return executeTaskCommand(cmd.args, actor, roomId);
    case "status":
      return executeStatusCommand();
    case "approve":
      return executeApproveCommand(cmd.args, actor);
    case "reject":
      return executeRejectCommand(cmd.args, actor);
    case "mission":
      return executeMissionCommand(cmd.args, actor);
    case "context":
      return executeContextCommand(cmd.args, actor);
    case "approve-draft":
      return executeApproveDraftCommand(cmd.args, actor);
    case "reject-draft":
      return executeRejectDraftCommand(cmd.args, actor);
    // C5B worker visibility commands
    case "worker-log":
      return executeWorkerLogCommand(cmd.args);
    case "sandbox":
      return executeSandboxCommand();
    // C5B-2 patch proposal commands
    case "patch-log":
      return executePatchLogCommand(cmd.args);
    case "patch-view":
      return executePatchViewCommand(cmd.args);
    case "patch-approve":
      return executePatchApproveCommand(cmd.args, actor);
    case "patch-reject":
      return executePatchRejectCommand(cmd.args, actor);
    // F4: Training data export
    case "training-export":
      return executeTrainingExportCommand(cmd.args, actor);
    case "help":
      return executeHelpCommand();
    default:
      return {
        success: false,
        message: `Command "/${cmd.command}" tidak dikenali. Ketik /help untuk daftar command.`,
      };
  }
}

// ── Command Implementations ─────────────────────────────────────────────────

/**
 * /task <agent> <title...>
 * Creates a task and assigns it to the specified agent.
 */
async function executeTaskCommand(
  args: string[],
  actor: string,
  roomId: string,
): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: "Format: /task <agent> <judul task>\nContoh: /task builder Implement cookie rotation",
    };
  }

  const agentRole = args[0]!.toLowerCase() as AgentRole;
  if (!VALID_AGENTS.includes(agentRole)) {
    return {
      success: false,
      message: `Agent "${args[0]}" tidak valid. Pilihan: ${VALID_AGENTS.join(", ")}`,
    };
  }

  const title = args.slice(1).join(" ");

  try {
    const task = await taskEngine.createTask({
      title,
      objective: `Founder command: ${title}`,
      phase: "C5" as ColonyPhase,
      sourceOfTruth: "founder-command-via-chat",
      assignedAgent: agentRole,
      priority: "high",
      acceptanceCriteria: [`${title} — selesai dan diverifikasi`],
      founderApprovalRequired: true,
      createdBy: "founder",
    });

    // Auto-enrich with memory context (non-blocking, graceful)
    let contextMsg = "";
    try {
      const ctx = await memoryReader.queryColonyContext(title);
      if (ctx.fragments.length > 0) {
        const refs = memoryReader.extractContextReferences(ctx);
        // Update task with context references
        const taskData = await taskEngine.getTask(task.taskId);
        if (taskData) {
          taskData.contextDocumentsUsed = refs;
          // Re-save task with context (via Redis directly through getTask pattern)
          const { getRedisClient } = await import("../services/redis.service.js");
          const redis = getRedisClient();
          await redis.set(`colony:task:${task.taskId}`, JSON.stringify(taskData));
        }
        contextMsg = `\n📚 Context: ${refs.length} dokumen ditemukan di memori (${refs.map(r => r.title).join(", ")})`;
      }
    } catch {
      // Context enrichment is best-effort
    }

    // Audit
    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "task.create",
      resource: `task:${task.taskId}`,
      detail: { source: "command", command: `/task ${args.join(" ")}`, roomId },
    });

    return {
      success: true,
      message: `✅ Task **${task.taskId}** dibuat → assigned ke **${agentRole}**\n📋 "${title}"\n⚠️ Founder approval required${contextMsg}`,
      taskId: task.taskId,
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal membuat task: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/**
 * /status — colony stats summary
 */
async function executeStatusCommand(): Promise<CommandResult> {
  try {
    const stats = await taskEngine.getColonyStats();
    const pending = await approvalEngine.listPendingApprovals();
    const blocked = await taskEngine.getBlockedTasks();

    const lines = [
      "📊 **Colony Status**",
      `Total tasks: **${stats.totalTasks}**`,
      `┣ Queued: ${stats.queued} │ Planning: ${stats.planning} │ Approved: ${stats.approved}`,
      `┣ Running: ${stats.running} │ Review: ${stats.review} │ Blocked: ${stats.blocked}`,
      `┗ Done: ${stats.done} │ Archived: ${stats.archived}`,
      `⚠️ Pending approvals: **${pending.length}**`,
      blocked.length > 0 ? `🔴 Blocked tasks: ${blocked.map(t => t.taskId).join(", ")}` : "✅ No blocked tasks",
    ];

    return { success: true, message: lines.join("\n") };
  } catch (err) {
    return { success: false, message: `Gagal mengambil status: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

/**
 * /approve <taskId> — approve pending approval for a task
 */
async function executeApproveCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: "Format: /approve <taskId>\nContoh: /approve TASK-20260528-0001" };
  }

  const taskId = args[0];

  try {
    const pending = await approvalEngine.listPendingApprovals();
    const approval = pending.find(a => a.taskId === taskId);

    if (!approval) {
      return { success: false, message: `Tidak ada pending approval untuk task ${taskId}.` };
    }

    await approvalEngine.respondToApproval(approval.approvalId, "approved", actor, `Approved via /approve command`);

    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "approval.respond",
      resource: `approval:${approval.approvalId}`,
      detail: { source: "command", response: "approved", taskId },
    });

    return {
      success: true,
      message: `✅ Approval **${approval.approvalId}** untuk task **${taskId}** — **APPROVED**`,
    };
  } catch (err) {
    return { success: false, message: `Gagal approve: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

/**
 * /reject <taskId> — reject pending approval for a task
 */
async function executeRejectCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: "Format: /reject <taskId>\nContoh: /reject TASK-20260528-0001" };
  }

  const taskId = args[0];
  const note = args.slice(1).join(" ") || "Rejected via /reject command";

  try {
    const pending = await approvalEngine.listPendingApprovals();
    const approval = pending.find(a => a.taskId === taskId);

    if (!approval) {
      return { success: false, message: `Tidak ada pending approval untuk task ${taskId}.` };
    }

    await approvalEngine.respondToApproval(approval.approvalId, "rejected", actor, note);

    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "approval.respond",
      resource: `approval:${approval.approvalId}`,
      detail: { source: "command", response: "rejected", taskId, note },
    });

    return {
      success: true,
      message: `❌ Approval **${approval.approvalId}** untuk task **${taskId}** — **REJECTED**\n📝 ${note}`,
    };
  } catch (err) {
    return { success: false, message: `Gagal reject: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

/**
 * /mission <title...> — create a new mission
 */
async function executeMissionCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: "Format: /mission <judul mission>\nContoh: /mission Phase 2 Final Hardening" };
  }

  const title = args.join(" ");

  try {
    const mission = await missionEngine.createMission({
      title,
      objective: `Founder-directed mission: ${title}`,
      phase: "C5" as ColonyPhase,
      priority: "high",
      createdBy: "founder",
    });

    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "mission.create",
      resource: `mission:${mission.id}`,
      detail: { source: "command", command: `/mission ${title}` },
    });

    return {
      success: true,
      message: `✅ Mission **${mission.id}** dibuat: "${title}"`,
      missionId: mission.id,
    };
  } catch (err) {
    return { success: false, message: `Gagal membuat mission: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

/**
 * /help — list available commands
 */
function executeHelpCommand(): CommandResult {
  return {
    success: true,
    message: [
      "📖 **Colony Commands**",
      "",
      "`/task <agent> <title>` — Buat task baru, assign ke agent",
      "  Agent: director, planner, researcher, builder, reviewer, reporter",
      "",
      "`/context <query>` — Tarik konteks dari memori berdaulat JAGAT",
      "",
      "`/status` — Lihat ringkasan colony saat ini",
      "",
      "`/approve <taskId>` — Approve pending approval",
      "",
      "`/reject <taskId> [alasan]` — Reject approval",
      "",
      "`/mission <title>` — Buat mission baru",
      "",
      "`/approve-draft <draftId> [1,3]` — Approve draft proposals (all or partial)",
      "",
      "`/reject-draft <draftId>` — Reject draft proposals",
      "",
      "── C5B Worker Commands ──",
      "",
      "`/worker-log <taskId>` — Lihat semua operasi filesystem yang dilakukan agent pada task ini",
      "",
      "`/sandbox` — Lihat konfigurasi sandbox (allowed roots per role, blocked patterns)",
      "",
      "── C5B-2 Patch Proposal Commands ──",
      "",
      "`/patch-log [taskId]` — Daftar semua patch proposals (atau untuk task tertentu)",
      "",
      "`/patch-view <proposalId>` — Detail proposal + unified diff",
      "",
      "`/patch-approve <proposalId> [note]` — Approve dan apply patch ke disk",
      "",
      "`/patch-reject <proposalId> [alasan]` — Reject patch proposal",
      "",
      "── F4 Training Data Export ──",
      "",
      "`/training-export [--tags=tag1,tag2] [--task=TASK-ID] [--since=2026-01-01]` — Export training data JSONL",
      "",
      "`/help` — Tampilkan daftar command ini",
      "",
      "💡 Atau ketik arahan natural: \"Director, buat 3 task untuk Q3 roadmap\"",
    ].join("\n"),
  };
}

// ── C5B Worker Commands ──────────────────────────────────────────────────────

/**
 * /worker-log <taskId>
 * Show all filesystem operations performed by an agent for a task.
 * Founder transparency command — no public surface exposed.
 */
async function executeWorkerLogCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /worker-log <taskId>\nContoh: /worker-log TASK-20260528-0001",
    };
  }

  const taskId = args[0]!.toUpperCase();

  // Verify the task exists
  const task = await taskEngine.getTask(taskId);
  if (!task) {
    return { success: false, message: `Task ${taskId} tidak ditemukan.` };
  }

  const actions = await getWorkerActions(taskId);
  const report = formatWorkerReport(actions);

  return {
    success: true,
    message: [
      `🔧 **Worker Log** — Task **${taskId}**: ${task.title}`,
      `Agent: ${task.assignedAgent} | Status: ${task.status}`,
      ``,
      report,
    ].join("\n"),
    taskId,
    data: { actionCount: actions.length, actions },
  };
}

/**
 * /sandbox
 * Show current worker sandbox configuration for founder audit.
 * Lists allowed roots and blocked patterns.
 */
function executeSandboxCommand(): CommandResult {
  const config = getSandboxConfig();
  const roleLines: string[] = [];
  for (const [role, roots] of Object.entries(config.allowedRootsByRole)) {
    if (roots && roots.length > 0) {
      roleLines.push(`  **${role}**: ${roots.join(", ")}`);
    }
  }
  return {
    success: true,
    message: [
      "🔒 **Worker Sandbox Configuration (C5B-2)**",
      "",
      "**Allowed Roots by Role:**",
      ...roleLines,
      "",
      "**Blocked Patterns** (selalu ditolak):",
      ...config.blockedPatterns.map((p) => `  🚫 ${p}`),
      "",
      `📏 Max file size: ${Math.round(config.maxFileSize / 1024)}KB per file`,
      `📦 Max bytes per task: ${Math.round(config.maxTaskBytes / 1024)}KB total`,
    ].join("\n"),
  };
}

/**
 * /context <query> — query JAGAT sovereign memory for context
 */
async function executeContextCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /context <query>\nContoh: /context roadmap JAGAT 2026\n\nOpsional: --category=blueprint,risk untuk filter kategori",
    };
  }

  // Parse optional --category flag
  let categories: string[] | undefined;
  const filteredArgs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--category=")) {
      categories = arg.slice("--category=".length).split(",").map(c => c.trim()).filter(Boolean);
    } else {
      filteredArgs.push(arg);
    }
  }

  const query = filteredArgs.join(" ");
  if (!query) {
    return { success: false, message: "Query tidak boleh kosong." };
  }

  try {
    const ctx = await memoryReader.queryColonyContext(query, { categories });
    const formatted = memoryReader.formatContextForChat(ctx);

    // Audit
    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "memory.context_query" as const,
      resource: "memory:context_query",
      detail: {
        source: "command",
        query,
        categories: ctx.categories,
        fragmentsFound: ctx.fragments.length,
        embeddingMs: ctx.embeddingMs,
        searchMs: ctx.searchMs,
      },
    });

    return {
      success: true,
      message: formatted,
      data: {
        fragmentCount: ctx.fragments.length,
        searchMs: ctx.searchMs,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal query memori: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/**
 * /approve-draft <draftId> [indices] — approve draft proposals and create real tasks
 * Examples:
 *   /approve-draft DRAFT-xxx       → approve all proposals
 *   /approve-draft DRAFT-xxx 1,3   → approve only proposals 1 and 3
 */
async function executeApproveDraftCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /approve-draft <draftId> [1,3]\nContoh: /approve-draft DRAFT-xxx atau /approve-draft DRAFT-xxx 1,3",
    };
  }

  const draftId = args[0]!;
  const draft = await directiveEngine.getDraft(draftId);

  if (!draft) {
    return { success: false, message: `Draft "${draftId}" tidak ditemukan atau sudah expired.` };
  }

  if (draft.status !== "pending") {
    return { success: false, message: `Draft "${draftId}" sudah di-${draft.status}.` };
  }

  // Parse optional indices (1-based)
  let selectedIndices: number[] | null = null;
  if (args.length >= 2) {
    selectedIndices = args[1]!.split(",")
      .map(s => parseInt(s.trim(), 10) - 1) // Convert to 0-based
      .filter(n => !isNaN(n) && n >= 0 && n < draft.proposals.length);

    if (selectedIndices.length === 0) {
      return { success: false, message: `Indeks tidak valid. Proposals tersedia: 1-${draft.proposals.length}` };
    }
  }

  const proposalsToApprove = selectedIndices
    ? selectedIndices.map(i => draft.proposals[i]!)
    : draft.proposals;

  // Create real tasks from approved proposals
  const createdTasks: string[] = [];
  for (const proposal of proposalsToApprove) {
    try {
      const task = await taskEngine.createTask({
        title: proposal.title,
        objective: proposal.objective,
        phase: "C5" as ColonyPhase,
        sourceOfTruth: `directive:${draftId}`,
        assignedAgent: proposal.assignedAgent,
        priority: proposal.priority,
        acceptanceCriteria: proposal.acceptanceCriteria,
        founderApprovalRequired: true,
        createdBy: "founder",
      });
      createdTasks.push(task.taskId);
    } catch (err) {
      console.error(`[Colony:Draft] Failed to create task "${proposal.title}":`, err);
    }
  }

  // Update draft status — based on actual task creation success, not just whether indices were provided
  const newStatus = createdTasks.length < draft.proposals.length ? "partially_approved" : "approved";
  await directiveEngine.updateDraftStatus(draftId, newStatus);

  // Audit
  await auditEngine.emitAudit({
    actor,
    actorRole: "founder",
    action: "directive.approve_draft",
    resource: `draft:${draftId}`,
    detail: {
      approvedCount: createdTasks.length,
      totalProposals: draft.proposals.length,
      selectedIndices: selectedIndices?.map(i => i + 1),
      taskIds: createdTasks,
    },
  });

  return {
    success: true,
    message: [
      `✅ Draft **${draftId}** — **${createdTasks.length}/${draft.proposals.length}** proposals approved`,
      ``,
      ...createdTasks.map(id => `📋 Task **${id}** created`),
      ``,
      `Tasks masuk queue dengan status \`queued\`. Agent simulator aktif.`,
    ].join("\n"),
    data: { taskIds: createdTasks },
  };
}

/**
 * /reject-draft <draftId> [alasan] — reject all proposals in a draft
 */
async function executeRejectDraftCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return { success: false, message: "Format: /reject-draft <draftId> [alasan]" };
  }

  const draftId = args[0]!;
  const note = args.slice(1).join(" ") || "Rejected by founder";

  const draft = await directiveEngine.getDraft(draftId);
  if (!draft) {
    return { success: false, message: `Draft "${draftId}" tidak ditemukan atau sudah expired.` };
  }

  if (draft.status !== "pending") {
    return { success: false, message: `Draft "${draftId}" sudah di-${draft.status}.` };
  }

  await directiveEngine.updateDraftStatus(draftId, "rejected");

  await auditEngine.emitAudit({
    actor,
    actorRole: "founder",
    action: "directive.reject_draft",
    resource: `draft:${draftId}`,
    detail: { response: "rejected", note, proposalCount: draft.proposals.length },
  });

  return {
    success: true,
    message: `❌ Draft **${draftId}** — **REJECTED** (${draft.proposals.length} proposals)\n📝 ${note}`,
  };
}

// ── C5B-2 Patch Proposal Commands ────────────────────────────────────────────

/**
 * /patch-log [taskId]
 * List all pending proposals, or proposals for a specific task.
 */
async function executePatchLogCommand(args: string[]): Promise<CommandResult> {
  try {
    let proposals;
    if (args.length > 0) {
      const taskId = args[0]!;
      proposals = await listProposalsByTask(taskId);
    } else {
      proposals = await listPendingProposals();
    }

    const label = args.length > 0
      ? `Patch proposals untuk task **${args[0]}**`
      : `Pending patch proposals`;

    return {
      success: true,
      message: `📋 **${label}** (${proposals.length}):\n\n${formatProposalList(proposals)}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * /patch-view <proposalId>
 * Show full diff and details for a patch proposal.
 */
async function executePatchViewCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /patch-view <proposalId>\nContoh: /patch-view PATCH-20260528-0001",
    };
  }

  try {
    const proposal = await getProposal(args[0]!);
    if (!proposal) {
      return { success: false, message: `Proposal **${args[0]}** tidak ditemukan atau sudah expired.` };
    }

    return { success: true, message: formatProposalDetail(proposal) };
  } catch (err) {
    return {
      success: false,
      message: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * /patch-approve <proposalId> [note] [--training]
 * Approve a patch proposal and apply it to disk.
 * Only callable by founder (enforced by executeCommand guard).
 * Add --training flag to mark as trainingDataReady.
 */
async function executePatchApproveCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /patch-approve <proposalId> [note] [--training]\nContoh: /patch-approve PATCH-20260528-0001 LGTM --training",
    };
  }

  const proposalId = args[0]!;
  const trainingDataReady = args.includes("--training");
  const note = args.slice(1).filter((a) => a !== "--training").join(" ") || undefined;

  try {
    // First: mark as approved
    await approveProposal(proposalId, actor, note, trainingDataReady);

    // Then: apply to disk — actor is the real founder identity for audit
    const applied = await applyPatch(proposalId, actor);

    return {
      success: true,
      message: [
        `✅ **${proposalId}** — APPROVED & APPLIED`,
        ``,
        `Files modified: ${applied.filesAffected.join(", ")}`,
        `Hunks applied: ${applied.hunks.length}`,
        note ? `Note: ${note}` : "",
        trainingDataReady ? `📚 Marked as training data ready` : "",
        ``,
        `⚠️ Jalankan \`npx tsc --noEmit\` dan \`npm run build\` untuk verifikasi.`,
      ].filter((l) => l !== "").join("\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      message: `❌ Patch apply gagal untuk **${proposalId}**: ${msg}`,
    };
  }
}

/**
 * /patch-reject <proposalId> [alasan]
 * Reject a patch proposal. No file changes.
 */
async function executePatchRejectCommand(args: string[], actor: string): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: "Format: /patch-reject <proposalId> [alasan]\nContoh: /patch-reject PATCH-20260528-0001 Terlalu agresif",
    };
  }

  const proposalId = args[0]!;
  const note = args.slice(1).join(" ") || "Rejected by founder";

  try {
    const rejected = await rejectProposal(proposalId, actor, note);
    return {
      success: true,
      message: `❌ **${rejected.proposalId}** — REJECTED\n📝 ${note}\nFiles NOT changed: ${rejected.filesAffected.join(", ")}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      message: `Error rejecting **${proposalId}**: ${msg}`,
    };
  }
}

// ── F4: Training Data Export Command ─────────────────────────────────────────

/**
 * /training-export [--tags=tag1,tag2] [--task=TASK-ID] [--since=2026-01-01]
 * Export training data from applied+training-ready patch proposals.
 * Founder only. Returns summary in chat + full JSONL in data field.
 */
async function executeTrainingExportCommand(args: string[], actor: string): Promise<CommandResult> {
  // Parse optional flags
  let tags: string[] | undefined;
  let taskId: string | undefined;
  let since: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--tags=")) {
      tags = arg.slice("--tags=".length).split(",").map(t => t.trim()).filter(Boolean);
    } else if (arg.startsWith("--task=")) {
      taskId = arg.slice("--task=".length).trim();
    } else if (arg.startsWith("--since=")) {
      since = arg.slice("--since=".length).trim();
    }
  }

  try {
    const { records, stats } = await exportTrainingData({ tags, taskId, since });
    const summary = formatTrainingExportSummary(stats);

    // Build JSONL string for download/piping
    const jsonl = records.map(r => JSON.stringify(r)).join("\n");

    // Audit
    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "training.export" as const,
      resource: "training:export",
      detail: {
        source: "command",
        recordCount: records.length,
        filters: { tags, taskId, since },
      },
    });

    return {
      success: true,
      message: [
        summary,
        "",
        records.length > 0
          ? `✅ ${records.length} records ready. Use \`GET /colony/training-export\` API for JSONL download.`
          : "📭 Tidak ada training data yang memenuhi filter. Pastikan proposal sudah di-approve dengan \`--training\` flag.",
      ].join("\n"),
      data: {
        stats,
        recordCount: records.length,
        jsonl: records.length > 0 ? jsonl : null,
        records,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal export training data: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
