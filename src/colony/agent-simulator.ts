// ============================================================================
// JAGAT Colony — Agent Simulator (Hybrid Mode)
// Handles agent lifecycle after task creation:
//   1. Agent acknowledges task in chat
//   2. Agent moves task through status pipeline
//   3. Agent creates approval request if needed
//   4. After approval:
//      - C5B real worker: agents with canReadCodebase use worker-executor
//      - C5A simulation: agents without filesystem access use simulated loop
//
// C5B-1: Hybrid mode — real workers for builder/reviewer/researcher/planner,
// simulation for director/reporter.
// ============================================================================

import { taskEngine, chatEngine, approvalEngine, agentRegistry, auditEngine } from "./index.js";
import { shouldUseRealWorker, executeWorker } from "./worker-executor.js";
import { DEFAULT_PERMISSIONS, type ColonyTask, type AgentRole } from "./types.js";

// ── Agent Display Names ─────────────────────────────────────────────────────

const AGENT_NAMES: Record<AgentRole, string> = {
  director: "Colony Director",
  planner: "Architect Agent",
  researcher: "Research & Memory Agent",
  builder: "Builder / Coder Agent",
  reviewer: "Reviewer / QA Agent",
  reporter: "Reporter / Ops Agent",
};

// ── Simulator ───────────────────────────────────────────────────────────────

/**
 * Simulate agent response to a newly created task.
 * This runs asynchronously with delays to simulate realistic agent behavior.
 *
 * Flow:
 * 1. [0s]  Agent sends acknowledgement in chat
 * 2. [2s]  Agent moves task: queued → planning
 * 3. [3s]  Agent sends planning update
 * 4. [4s]  If founderApprovalRequired: create approval request, STOP
 *          If not: continue to approved → running → review
 */
export function simulateAgentResponse(
  task: ColonyTask,
  roomId: string,
  founderName: string,
): void {
  const agentRole = task.assignedAgent;
  const agentName = AGENT_NAMES[agentRole] ?? agentRole;

  // Helper to find the agent's registry ID
  const getAgentId = async (): Promise<string | null> => {
    const agents = await agentRegistry.listAgents(agentRole);
    return agents[0]?.agentId ?? null;
  };

  // Helper to set agent status
  const setAgentStatus = async (status: "idle" | "working", taskId?: string) => {
    const agentId = await getAgentId();
    if (agentId) {
      await agentRegistry.updateAgentStatus(agentId, status, taskId);
    }
  };

  // Step 1: Acknowledge (immediate, 1.5s delay for realism)
  setTimeout(async () => {
    try {
      await setAgentStatus("working", task.taskId);

      await chatEngine.sendMessage({
        roomId,
        senderId: agentRole,
        senderRole: agentRole,
        senderName: agentName,
        content: `📥 Task **${task.taskId}** diterima. Mulai analisis: "${task.title}"`,
        messageType: "agent_ack",
        linkedTaskId: task.taskId,
      });

      await auditEngine.emitAudit({
        actor: agentName,
        actorRole: agentRole,
        action: "agent.status_change",
        resource: `task:${task.taskId}`,
        detail: { step: "acknowledge", status: "working" },
      });
    } catch (err) {
      console.error(`[AgentSim] Ack failed for ${task.taskId}:`, err);
    }
  }, 1500);

  // Step 2: Move to planning (3s)
  setTimeout(async () => {
    try {
      await taskEngine.updateTaskStatus(
        task.taskId, "planning", agentName,
        `${agentName} memulai perencanaan task`,
      );

      await chatEngine.sendMessage({
        roomId,
        senderId: agentRole,
        senderRole: agentRole,
        senderName: agentName,
        content: `🔄 Task **${task.taskId}** → status **planning**. Menyusun rencana eksekusi...`,
        messageType: "agent_update",
        linkedTaskId: task.taskId,
      });
    } catch (err) {
      console.error(`[AgentSim] Planning transition failed for ${task.taskId}:`, err);
    }
  }, 3000);

  // Step 3: Request approval or continue (5s)
  setTimeout(async () => {
    try {
      if (task.founderApprovalRequired) {
        // Create approval request and wait
        const approval = await approvalEngine.createApproval({
          taskId: task.taskId,
          type: "task_start",
          description: `${agentName} meminta approval untuk melanjutkan task: "${task.title}"`,
          requestedBy: agentName,
        });

        await chatEngine.sendMessage({
          roomId,
          senderId: agentRole,
          senderRole: agentRole,
          senderName: agentName,
          content: `⚠️ Task **${task.taskId}** memerlukan **founder approval** sebelum lanjut.\n🔔 @${founderName} — silakan /approve ${task.taskId} atau review di tab Approvals.`,
          messageType: "approval_request",
          linkedTaskId: task.taskId,
        });

        await auditEngine.emitAudit({
          actor: agentName,
          actorRole: agentRole,
          action: "approval.create",
          resource: `task:${task.taskId}`,
          detail: { step: "awaiting_approval", founderApprovalRequired: true },
        });

        // Simulation pauses here — founder must /approve to continue
        // The continuation is triggered by watchForApproval below
        watchForApproval(approval.approvalId, task.taskId, agentRole, agentName, roomId);
      } else {
        // No approval needed — continue automatically
        await continueAfterApproval(task.taskId, agentRole, agentName, roomId);
      }
    } catch (err) {
      console.error(`[AgentSim] Approval step failed for ${task.taskId}:`, err);
    }
  }, 5000);
}

async function notifyApprovalTimeout(
  approvalId: string,
  taskId: string,
  roomId: string,
  polls: number,
): Promise<void> {
  try {
    await auditEngine.emitAudit({
      actor: "Colony System",
      actorRole: "system",
      action: "approval.timeout",
      resource: `task:${taskId}`,
      detail: { approvalId, polls, timeoutMinutes: 5 },
    });
    await chatEngine.sendMessage({
      roomId,
      senderId: "system",
      senderRole: "founder",
      senderName: "Colony System",
      content: `Approval polling timeout untuk task **${taskId}** (approval **${approvalId}**). Task tetap di status planning; founder dapat approve manual via /approve ${taskId}.`,
      messageType: "system",
      linkedTaskId: taskId,
    });
  } catch (notifyErr) {
    console.error(`[AgentSim] Failed to notify approval timeout for ${taskId}:`, notifyErr);
  }
}

export async function dispatchClaimedTask(
  task: ColonyTask,
  roomId: string,
  _founderName: string,
): Promise<void> {
  const agentRole = task.assignedAgent;
  const agentName = AGENT_NAMES[agentRole] ?? agentRole;

  if (task.status !== "planning") {
    throw new Error(`Task ${task.taskId} must be in planning before dispatch; current status: ${task.status}`);
  }

  if (task.founderApprovalRequired) {
    throw new Error(`Task ${task.taskId} requires founder approval and cannot be auto-dispatched`);
  }

  await chatEngine.sendMessage({
    roomId,
    senderId: agentRole,
    senderRole: agentRole,
    senderName: agentName,
    content: `Scheduler mengirim task **${task.taskId}** ke ${agentName}.`,
    messageType: "agent_update",
    linkedTaskId: task.taskId,
  });

  await continueAfterApproval(task.taskId, agentRole, agentName, roomId);
}

// ── Approval Watcher ────────────────────────────────────────────────────────

/**
 * Poll for approval status changes.
 * When the task's approval is approved, continue the simulation.
 * Max 60 polls (5 minutes at 5s intervals).
 */
function watchForApproval(
  approvalId: string,
  taskId: string,
  agentRole: AgentRole,
  agentName: string,
  roomId: string,
): void {
  let polls = 0;
  const maxPolls = 60;

  const interval = setInterval(async () => {
    polls++;

    try {
      const approval = await approvalEngine.getApproval(approvalId);
      if (!approval) {
        clearInterval(interval);
        await chatEngine.sendMessage({
          roomId,
          senderId: "system",
          senderRole: "founder",
          senderName: "Colony System",
          content: `Approval **${approvalId}** untuk task **${taskId}** tidak ditemukan. Worker tidak dilanjutkan.`,
          messageType: "system",
          linkedTaskId: taskId,
        });
        return;
      }

      if (approval.status !== "pending") {
        // Approval was responded to — check if approved or rejected
        clearInterval(interval);

        const currentTask = await taskEngine.getTask(taskId);
        if (!currentTask) return;

        // If task is still in planning, it was approved — continue
        if (approval.status === "approved" && currentTask.status === "planning") {
          await continueAfterApproval(taskId, agentRole, agentName, roomId);
          return;
        }

        if (approval.status === "rejected") {
          const agents = await agentRegistry.listAgents(agentRole);
          if (agents[0]) {
            await agentRegistry.updateAgentStatus(agents[0].agentId, "idle");
          }

          await chatEngine.sendMessage({
            roomId,
            senderId: agentRole,
            senderRole: agentRole,
            senderName: agentName,
            content: `Task **${taskId}** tidak dilanjutkan karena founder menolak approval **${approvalId}**.${approval.responseNote ? `\nCatatan: ${approval.responseNote}` : ""}`,
            messageType: "agent_update",
            linkedTaskId: taskId,
          });
        }
        // If rejected, the task stays in planning for founder to re-evaluate
      }

      if (polls >= maxPolls) {
        clearInterval(interval);
        await notifyApprovalTimeout(approvalId, taskId, roomId, polls);
      }
    } catch (err) {
      console.error(`[AgentSim] Approval poll error for ${taskId} (poll ${polls}):`, err);
      if (polls >= maxPolls) {
        clearInterval(interval);
        await notifyApprovalTimeout(approvalId, taskId, roomId, polls);
      }
    }
  }, 5000);
}

// ── Post-Approval Continuation ──────────────────────────────────────────────

/**
 * Continue after approval:
 * - C5B real worker: agents with canReadCodebase use worker-executor
 * - C5A simulation: agents without filesystem access use simulated loop
 *
 * Both paths: planning → approved → running → (work) → review
 */
async function continueAfterApproval(
  taskId: string,
  agentRole: AgentRole,
  agentName: string,
  roomId: string,
): Promise<void> {
  // GAP 9: Validate agent has compatible permissions before dispatching work
  const task = await taskEngine.getTask(taskId);
  if (task) {
    const perms = DEFAULT_PERMISSIONS[agentRole];
    const taskText = `${task.title} ${(task.tags ?? []).join(" ")}`.toLowerCase();
    if (/code|build|patch|implement|refactor/.test(taskText) && !perms.canWriteCode && !perms.canRunBuild) {
      console.warn(`[AgentSim] Blocking dispatch: agent "${agentRole}" lacks code/build permissions for task "${taskId}"`);
      await chatEngine.sendMessage({
        roomId, senderId: "system", senderRole: "founder", senderName: "Colony System",
        content: `⛔ Task **${taskId}** diblokir: ${agentName} tidak memiliki permission code/build untuk task ini. Silakan reassign ke builder/reviewer.`,
        messageType: "system", linkedTaskId: taskId,
      });
      await taskEngine.updateTaskStatus(taskId, "queued", "system", `Dispatch blocked: agent ${agentRole} lacks code/build permissions`);
      const agents = await agentRegistry.listAgents(agentRole);
      if (agents[0]) await agentRegistry.updateAgentStatus(agents[0].agentId, "idle");
      await auditEngine.emitAudit({ actor: "system", actorRole: "system", action: "worker.denied", resource: `task:${taskId}`,
        detail: { reason: "agent_permission_mismatch", agentRole, missing: "canWriteCode/canRunBuild" } });
      return;
    }
  }
  const useRealWorker = shouldUseRealWorker(agentRole);

  // Step 4: Approved (1s delay)
  setTimeout(async () => {
    try {
      await taskEngine.updateTaskStatus(taskId, "approved", agentName, "Approved — memulai eksekusi");

      const modeLabel = useRealWorker ? "C5B real worker" : "C5A simulation";
      await chatEngine.sendMessage({
        roomId,
        senderId: agentRole,
        senderRole: agentRole,
        senderName: agentName,
        content: `✅ Task **${taskId}** approved. Memulai eksekusi (${modeLabel})...`,
        messageType: "agent_update",
        linkedTaskId: taskId,
      });
    } catch (err) {
      console.error(`[AgentSim] Approved transition failed for ${taskId}:`, err);
    }
  }, 1000);

  // Step 5: Running + work
  setTimeout(async () => {
    try {
      await taskEngine.updateTaskStatus(taskId, "running", agentName, "Eksekusi dimulai");

      if (useRealWorker) {
        // ── C5B Real Worker Path ──
        console.log(`[AgentSim] Dispatching REAL worker for ${agentRole} on task ${taskId}`);

        // Get the current task for full context
        const currentTask = await taskEngine.getTask(taskId);
        if (!currentTask) {
          console.error(`[AgentSim] Task ${taskId} not found for worker execution`);
          return;
        }

        // Execute real worker — this handles everything:
        // reads files, generates analysis, posts to chat, adds evidence, moves to review
        await executeWorker(currentTask, roomId, agentName);
      } else {
        // ── C5A Simulation Path (director, reporter) ──
        await chatEngine.sendMessage({
          roomId,
          senderId: agentRole,
          senderRole: agentRole,
          senderName: agentName,
          content: `⚡ Task **${taskId}** → status **running**. Sedang mengerjakan... (C5A simulation)`,
          messageType: "agent_update",
          linkedTaskId: taskId,
        });

        // Simulated completion after 3s
        setTimeout(async () => {
          try {
            await taskEngine.addEvidence(taskId, {
              type: "other",
              description: `[C5A Simulation] Task "${taskId}" berhasil dieksekusi oleh ${agentName}. Output: simulated completion. Acceptance criteria terpenuhi sesuai scope C5A.`,
              timestamp: new Date().toISOString(),
              agentRole,
            });

            await taskEngine.updateTaskStatus(taskId, "review", agentName, "Eksekusi selesai, menunggu review founder");

            await chatEngine.sendMessage({
              roomId,
              senderId: agentRole,
              senderRole: agentRole,
              senderName: agentName,
              content: `📋 Task **${taskId}** → status **review**.\n✅ Evidence ditambahkan. Menunggu review founder.\nFounder bisa approve via UI (tab Task Queue) atau klik Done setelah verifikasi.`,
              messageType: "agent_update",
              linkedTaskId: taskId,
            });

            // Set agent back to idle
            const agents = await agentRegistry.listAgents(agentRole);
            if (agents[0]) {
              await agentRegistry.updateAgentStatus(agents[0].agentId, "idle");
            }

            await auditEngine.emitAudit({
              actor: agentName,
              actorRole: agentRole,
              action: "task.status_change",
              resource: `task:${taskId}`,
              detail: { step: "simulation_complete", toStatus: "review" },
            });
          } catch (err) {
            console.error(`[AgentSim] Simulation review transition failed for ${taskId}:`, err);
          }
        }, 3000);
      }
    } catch (err) {
      console.error(`[AgentSim] Running transition failed for ${taskId}:`, err);
    }
  }, 3000);
}
