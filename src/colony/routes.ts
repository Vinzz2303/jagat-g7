// ============================================================================
// JAGAT Colony — Express API Routes
// Internal colony API endpoints for the Founder Command Center
// All endpoints are protected by colonyAuthGuard middleware.
// ============================================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import {
  taskEngine,
  missionEngine,
  lessonEngine,
  agentRegistry,
  chatEngine,
  approvalEngine,
  auditEngine,
  commandEngine,
  agentSimulator,
  directiveEngine,
  schedulerLoop,
  reporterEngine,
  distillationEngine,
  modelArena,
  exportTrainingData,
  getProposal,
  listAllProposals,
  approveProposal,
  rejectProposal,
  whatsappAdapter,
  notificationDispatcher,
  TASK_STATUSES,
  LESSON_CATEGORIES,
  type TaskStatus,
  type AgentRole,
  type ColonyPhase,
  type AuditAction,
  type LessonCategory,
} from "./index.js";
import { founderOnly, executiveOrAbove, anyColonyUser } from "./auth.js";
import { applyPatch } from "./patch-engine.js";
import { getVerification, listVerifications } from "./verifier-engine.js";
import { reviewMission } from "./mission-review.js";
import { getLedgerCounts } from "./mission-ledger.js";

export const colonyRouter = Router();

// Helper: safely extract a route param as string
function param(req: Request, name: string): string {
  const val = req.params[name];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0] ?? "";
  return "";
}

function queryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function parseLessonCategory(value: unknown): LessonCategory | undefined {
  const raw = queryString(value);
  if (!raw) return undefined;
  return (LESSON_CATEGORIES as readonly string[]).includes(raw) ? (raw as LessonCategory) : undefined;
}

// Helper: extract audit actor info from request
function auditActor(req: Request): { actor: string; actorRole: string; ip?: string } {
  return {
    actor: req.colonyIdentity?.name ?? "unknown",
    actorRole: req.colonyIdentity?.role ?? "unknown",
    ip: req.ip,
  };
}

// ── Colony Bootstrap ────────────────────────────────────────────────────────
// FOUNDER ONLY — initializes the default agent roster and chat rooms

colonyRouter.post("/bootstrap", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await agentRegistry.seedDefaultAgents();
    const rooms = await chatEngine.seedDefaultRooms();

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "colony.bootstrap",
      resource: "colony",
      detail: { agentsSeeded: agents.length, roomsSeeded: rooms.length },
    });

    console.log(`[Colony:Auth] Bootstrap by ${req.colonyIdentity?.name} (${req.colonyIdentity?.role})`);
    res.json({
      success: true,
      agents: agents.length,
      rooms: rooms.length,
      message: "Colony bootstrapped successfully",
    });
  } catch (err) {
    next(err);
  }
});

// ── Stats ───────────────────────────────────────────────────────────────────
// EXECUTIVE OR ABOVE — dashboard stats

colonyRouter.get("/stats", executiveOrAbove, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await taskEngine.getColonyStats();
    const roster = await agentRegistry.getColonyRoster();
    const pendingApprovals = await approvalEngine.listPendingApprovals();
    const blockedTasks = await taskEngine.getBlockedTasks();

    res.json({
      stats,
      roster: {
        totalAgents: roster.totalAgents,
        byRole: roster.byRole,
        byStatus: roster.byStatus,
      },
      pendingApprovals: pendingApprovals.length,
      blockedTasks: blockedTasks.length,
    });
  } catch (err) {
    next(err);
  }
});

// ── Task Endpoints ──────────────────────────────────────────────────────────

colonyRouter.get("/tasks", anyColonyUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, agent, phase, limit, offset } = req.query;
    const result = await taskEngine.listTasks({
      status: status as TaskStatus | undefined,
      agent: agent as AgentRole | undefined,
      phase: phase as ColonyPhase | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/tasks/:taskId", anyColonyUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskEngine.getTask(param(req, "taskId"));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/tasks", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Override createdBy with verified identity
    const body = { ...req.body, createdBy: req.colonyIdentity?.role ?? "unknown" };
    const task = await taskEngine.createTask(body);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "task.create",
      resource: `task:${task.taskId}`,
      detail: { title: task.title, phase: task.phase, assignedAgent: task.assignedAgent, priority: task.priority },
    });

    console.log(`[Colony:Auth] Task ${task.taskId} created by ${req.colonyIdentity?.name}`);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

colonyRouter.patch("/tasks/:taskId/status", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason, blockedReason } = req.body;
    // Validate status is a known TaskStatus value
    if (!TASK_STATUSES.includes(status as TaskStatus)) {
      res.status(400).json({ error: `Invalid status: ${status}. Must be one of: ${TASK_STATUSES.join(", ")}` });
      return;
    }
    // Use verified identity as actor
    const actor = req.colonyIdentity?.name ?? "unknown";
    const taskId = param(req, "taskId");
    const oldTask = await taskEngine.getTask(taskId);
    const task = await taskEngine.updateTaskStatus(
      taskId, status, actor, reason, blockedReason,
    );

    const { actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "task.status_change",
      resource: `task:${taskId}`,
      detail: { fromStatus: oldTask?.status, toStatus: status, reason, blockedReason },
    });

    res.json(task);
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/tasks/:taskId/evidence", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = param(req, "taskId");
    const task = await taskEngine.addEvidence(taskId, req.body);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "task.evidence_add",
      resource: `task:${taskId}`,
      detail: { evidenceType: req.body.type, description: req.body.description },
    });

    res.json(task);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/tasks/:taskId/transitions", anyColonyUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transitions = await taskEngine.getTaskTransitions(param(req, "taskId"));
    res.json(transitions);
  } catch (err) {
    next(err);
  }
});

// ── Mission Endpoints ───────────────────────────────────────────────────────

colonyRouter.get("/missions", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missions = await missionEngine.listMissions(
      req.query.status as "active" | "completed" | "paused" | "cancelled" | undefined,
    );
    res.json(missions);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/missions/:missionId", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mid = param(req, "missionId");
    const mission = await missionEngine.getMission(mid);
    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

    const tasks = await taskEngine.getTasksByMission(mid);
    res.json({ ...mission, tasks });
  } catch (err) {
    next(err);
  }
});

/** Mission planning recommendations — advice only, never creates tasks or sends email. */
colonyRouter.get("/missions/:missionId/review", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = param(req, "missionId");
    const mission = await missionEngine.getMission(missionId);
    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
    const tasks = await taskEngine.getTasksByMission(missionId);
    res.json(reviewMission(mission, tasks));
  } catch (err) { next(err); }
});

colonyRouter.get("/ops/mission-ledger", founderOnly, (_req: Request, res: Response) => {
  res.json({ enabled: process.env.JAGAT_MISSION_LEDGER_ENABLED === "true", counts: getLedgerCounts() });
});

colonyRouter.post("/missions", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Override createdBy with verified identity
    const body = { ...req.body, createdBy: req.colonyIdentity?.role ?? "unknown" };
    const mission = await missionEngine.createMission(body);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "mission.create",
      resource: `mission:${mission.id}`,
      detail: { title: mission.title, phase: mission.phase, priority: mission.priority },
    });

    console.log(`[Colony:Auth] Mission ${mission.id} created by ${req.colonyIdentity?.name}`);
    res.status(201).json(mission);
  } catch (err) {
    next(err);
  }
});

colonyRouter.patch("/missions/:missionId", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = param(req, "missionId");
    const mission = await missionEngine.updateMission(missionId, req.body);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "mission.update",
      resource: `mission:${mission.id}`,
      detail: { updates: Object.keys(req.body) },
    });

    console.log(`[Colony:Auth] Mission ${mission.id} updated by ${req.colonyIdentity?.name}`);
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

// ── Lesson Endpoints ─────────────────────────────────────────────────────────

colonyRouter.get("/lessons", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryRaw = queryString(req.query.category);
    const category = parseLessonCategory(req.query.category);
    if (categoryRaw && !category) {
      res.status(400).json({ error: `Invalid category. Allowed: ${LESSON_CATEGORIES.join(", ")}` });
      return;
    }
    const lessons = await lessonEngine.listLessons(category ? { category } : undefined);
    res.json(lessons);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/lessons/:lessonId", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lessonId = param(req, "lessonId");
    const lesson = await lessonEngine.getLesson(lessonId);
    if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

    // Enrich with mission data for provenance
    const mission = await missionEngine.getMission(lesson.missionId);
    const tasks = lesson.taskIds.length > 0 ? await taskEngine.getTasksByMission(lesson.missionId) : [];
    const relatedTasks = tasks.filter(t => lesson.taskIds.includes(t.taskId));

    res.json({
      ...lesson,
      mission: mission ? { id: mission.id, title: mission.title, status: mission.status, objective: mission.objective } : null,
      relatedTasks: relatedTasks.map(t => ({ taskId: t.taskId, title: t.title, status: t.status, priority: t.priority })),
      storageNote: "Lesson ini disimpan di Redis only. Tidak otomatis masuk Qdrant sovereign memory.",
    });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/missions/:missionId/lessons", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mid = param(req, "missionId");
    const lessons = await lessonEngine.getLessonsByMission(mid);
    res.json(lessons);
  } catch (err) {
    next(err);
  }
});

// ── Agent Endpoints ─────────────────────────────────────────────────────────

colonyRouter.get("/planner/lesson-context", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const directive = queryString(req.query.directive)?.trim() ?? "";
    if (!directive) {
      res.status(400).json({ error: "Query parameter 'directive' is required." });
      return;
    }

    const categoryRaw = queryString(req.query.category);
    const category = parseLessonCategory(req.query.category);
    if (categoryRaw && !category) {
      res.status(400).json({ error: `Invalid category. Allowed: ${LESSON_CATEGORIES.join(", ")}` });
      return;
    }

    const limitRaw = queryString(req.query.limit);
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const missionId = queryString(req.query.missionId);
    const opts: {
      directive: string;
      missionId?: string;
      categories?: LessonCategory[];
      limit?: number;
    } = { directive };

    if (missionId) opts.missionId = missionId;
    if (category) opts.categories = [category];
    if (parsedLimit && Number.isFinite(parsedLimit)) {
      opts.limit = Math.min(Math.max(parsedLimit, 1), 10);
    }

    const context = await lessonEngine.getPlannerLessonContext(opts);
    res.json(context);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/agents", executiveOrAbove, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roster = await agentRegistry.getColonyRoster();
    res.json(roster);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/agents/:agentId", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentRegistry.getAgent(param(req, "agentId"));
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

colonyRouter.patch("/agents/:agentId/status", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, currentTaskId } = req.body;
    const agentId = param(req, "agentId");
    const agent = await agentRegistry.updateAgentStatus(agentId, status, currentTaskId);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "agent.status_change",
      resource: `agent:${agentId}`,
      detail: { newStatus: status, currentTaskId },
    });

    console.log(`[Colony:Auth] Agent ${agent.agentId} status → ${status} by ${req.colonyIdentity?.name}`);
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

// ── Chat Endpoints ──────────────────────────────────────────────────────────

colonyRouter.get("/chat/rooms", anyColonyUser, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rooms = await chatEngine.listRooms();
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/chat/rooms", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const VALID_ROOM_TYPES = ["general", "mission", "meeting", "direct"];
    if (!req.body.type || !VALID_ROOM_TYPES.includes(req.body.type)) {
      res.status(400).json({ error: "Bad Request", message: `Invalid room type. Allowed: ${VALID_ROOM_TYPES.join(", ")}` });
      return;
    }
    const room = await chatEngine.createRoom(req.body);

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "chat.room_create",
      resource: `chatroom:${room.roomId}`,
      detail: { name: room.name, type: room.type, participants: room.participants },
    });

    console.log(`[Colony:Auth] Chat room "${room.name}" created by ${req.colonyIdentity?.name}`);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/chat/rooms/:roomId/messages", anyColonyUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = req.query;
    const result = await chatEngine.getRoomMessages(
      param(req, "roomId"),
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/chat/rooms/:roomId/messages", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identity = req.colonyIdentity!;
    const roomId = param(req, "roomId");
    const content = req.body.content ?? "";

    // Check if message is a command
    const parsed = commandEngine.parseCommand(content);
    const messageType = parsed ? "command" : (req.body.messageType ?? "text");

    // Save the founder's message (command or regular)
    const message = await chatEngine.sendMessage({
      ...req.body,
      roomId,        // After spread — prevents body from overriding URL param
      senderId: identity.role,
      senderRole: identity.role,
      senderName: identity.name,
      messageType,
    });

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "chat.message_send",
      resource: `chatroom:${roomId}`,
      detail: { messageId: message.messageId, messageType, isCommand: !!parsed },
    });

    // If it's a command, execute it and send response
    if (parsed) {
      const result = await commandEngine.executeCommand(parsed, identity.name, identity.role, roomId);

      // Send system response message
      await chatEngine.sendMessage({
        roomId,
        senderId: "system",
        senderRole: "founder",
        senderName: "Colony System",
        content: result.message,
        messageType: "command_response",
        linkedTaskId: result.taskId,
      });

      // If a task was created, trigger agent simulation
      if (result.taskId && parsed.command === "task") {
        const task = await taskEngine.getTask(result.taskId);
        if (task) {
          agentSimulator.simulateAgentResponse(task, roomId, identity.name);
        }
      }

      // If approve-draft created tasks, trigger agent simulation for each
      if (parsed.command === "approve-draft" && result.data) {
        const taskIds = (result.data as Record<string, unknown>).taskIds as string[] | undefined;
        if (taskIds) {
          for (const tid of taskIds) {
            const task = await taskEngine.getTask(tid);
            if (task) {
              agentSimulator.simulateAgentResponse(task, roomId, identity.name);
            }
          }
        }
      }
    }

    // If NOT a command, check for natural language directives
    if (!parsed && identity.role === "founder") {
      const detection = directiveEngine.detectDirective(content);
      if (detection.isDirective && detection.targetRole) {
        // Send "analyzing" message immediately
        await chatEngine.sendMessage({
          roomId,
          senderId: "system",
          senderRole: "founder",
          senderName: "Colony System",
          content: `🧠 Menganalisis arahan ke **${detection.targetRole}**... (memuat konteks + inferensi LLM)`,
          messageType: "system",
        });

        // Interpret directive (async — takes 5-15s)
        const result = await directiveEngine.interpretDirective(
          detection.content,
          detection.targetRole,
          identity.name,
          roomId,
        );

        // Send proposals
        const formatted = directiveEngine.formatProposalsForChat(result);
        await chatEngine.sendMessage({
          roomId,
          senderId: "system",
          senderRole: "founder",
          senderName: "Colony Director",
          content: formatted,
          messageType: "directive_proposal",
        });
      }
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// ── Approval Endpoints ──────────────────────────────────────────────────────

colonyRouter.get("/approvals", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const approvals = await approvalEngine.listPendingApprovals();
    res.json(approvals);
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/approvals", executiveOrAbove, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Override requestedBy with verified identity
    const identity = req.colonyIdentity!;
    const approval = await approvalEngine.createApproval({
      ...req.body,
      requestedBy: identity.name,
    });

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "approval.create",
      resource: `approval:${approval.approvalId}`,
      detail: { taskId: approval.taskId, type: approval.type, description: approval.description },
    });

    console.log(`[Colony:Auth] Approval ${approval.approvalId} requested by ${identity.name}`);
    res.status(201).json(approval);
  } catch (err) {
    next(err);
  }
});

colonyRouter.patch("/approvals/:approvalId", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { response, note } = req.body;
    // Validate response is a known approval action
    if (response !== "approved" && response !== "rejected") {
      res.status(400).json({ error: `Invalid response: ${response}. Must be "approved" or "rejected".` });
      return;
    }
    // Override respondedBy with verified founder identity
    const identity = req.colonyIdentity!;
    const approval = await approvalEngine.respondToApproval(
      param(req, "approvalId"), response, identity.name, note,
    );

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "approval.respond",
      resource: `approval:${approval.approvalId}`,
      detail: { response, note, taskId: approval.taskId },
    });

    console.log(`[Colony:Auth] Approval ${approval.approvalId} ${response} by ${identity.name} (${identity.role})`);
    res.json(approval);
  } catch (err) {
    next(err);
  }
});

// ── Audit Log Endpoint ──────────────────────────────────────────────────────
// FOUNDER ONLY — query centralized audit trail

colonyRouter.get("/audit", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, actor, action } = req.query;
    const result = await auditEngine.queryAuditLog({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      actor: actor as string | undefined,
      action: action as AuditAction | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── F4: Training Data Export ────────────────────────────────────────────────
// FOUNDER ONLY — export applied+training-ready patch proposals as training data
// Query params:
//   ?tags=bug_fix,refactor   — filter by trainingDataTags
//   ?taskId=TASK-xxx         — filter by task
//   ?since=2026-01-01        — filter by date
// ?? F3: Patch Review API ?????????????????????????????????????????????????????
// FOUNDER ONLY ? review, approve/apply, and reject builder patch proposals.

colonyRouter.get("/patches", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, taskId, verifierStatus } = req.query;
    const proposals = await listAllProposals();
    const filtered = proposals.filter((proposal) => {
      if (status && proposal.status !== status) return false;
      if (taskId && proposal.taskId !== taskId) return false;
      return true;
    });

    // Enrich each proposal with verification status
    const enriched = await Promise.all(filtered.map(async (proposal) => {
      const verification = await getVerification(proposal.proposalId);
      const verifierStatusValue = verification?.status ?? "missing";
      const isHighRisk = proposal.estimatedRisk === "high";
      const highRiskBlocked = isHighRisk && verifierStatusValue !== "verified" && proposal.status === "pending";
      return {
        ...proposal,
        verifierStatus: verifierStatusValue,
        verifierChecks: verification?.checks ?? [],
        verifierVerifiedAt: verification?.verifiedAt ?? null,
        highRiskBlocked,
      };
    }));

    // Filter by verifierStatus if requested
    const verifierFiltered = verifierStatus
      ? enriched.filter((p) => p.verifierStatus === verifierStatus)
      : enriched;

    res.json({
      proposals: verifierFiltered,
      counts: verifierFiltered.reduce<Record<string, number>>((acc, proposal) => {
        acc[proposal.status] = (acc[proposal.status] ?? 0) + 1;
        return acc;
      }, {}),
      verifierCounts: {
        passed: verifierFiltered.filter((p) => p.verifierStatus === "verified").length,
        failed: verifierFiltered.filter((p) => p.verifierStatus === "failed").length,
        pending: verifierFiltered.filter((p) => p.verifierStatus === "pending").length,
        missing: verifierFiltered.filter((p) => p.verifierStatus === "missing").length,
      },
    });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/patches/:proposalId", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposal = await getProposal(param(req, "proposalId"));
    if (!proposal) { res.status(404).json({ error: "Patch proposal not found" }); return; }

    const verification = await getVerification(proposal.proposalId);
    const verifierStatus = verification?.status ?? "missing";
    const isHighRisk = proposal.estimatedRisk === "high";
    const highRiskBlocked = isHighRisk && verifierStatus !== "verified" && proposal.status === "pending";

    res.json({
      ...proposal,
      verifierStatus,
      verifierChecks: verification?.checks ?? [],
      verifierVerifiedAt: verification?.verifiedAt ?? null,
      highRiskBlocked,
    });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/patches/:proposalId/approve", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposalId = param(req, "proposalId");
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    const trainingDataReady = Boolean(req.body?.trainingDataReady);
    const { actor } = auditActor(req);

    await approveProposal(proposalId, actor, note, trainingDataReady);
    const proposal = await applyPatch(proposalId, actor);

    res.json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/patches/:proposalId/reject", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposalId = param(req, "proposalId");
    const note = typeof req.body?.note === "string" && req.body.note.trim()
      ? req.body.note.trim()
      : "Rejected by founder";
    const { actor } = auditActor(req);

    const proposal = await rejectProposal(proposalId, actor, note);

    res.json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
});

// ── F3b: Verifier Status API ──────────────────────────────────────────────
// FOUNDER ONLY — list all verification records with summary.

colonyRouter.get("/verifications", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const verifications = await listVerifications();
    const summary = {
      total: verifications.length,
      passed: verifications.filter((v) => v.status === "verified").length,
      failed: verifications.filter((v) => v.status === "failed").length,
      pending: verifications.filter((v) => v.status === "pending").length,
    };
    res.json({ verifications, summary });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/verifications/:proposalId", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verification = await getVerification(param(req, "proposalId"));
    if (!verification) {
      res.json({ status: "missing", checks: [], proposalId: param(req, "proposalId"), verifiedAt: null, createdAt: null });
      return;
    }
    res.json(verification);
  } catch (err) {
    next(err);
  }
});

// ── C6 Scheduler / Reporter Controls ───────────────────────────────────────
// FOUNDER ONLY — inspect and manually trigger the autonomous low-risk loop.

// P-017: Founder-only Model Arena surface data.
colonyRouter.get("/model-arena", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskType = queryString(req.query.taskType);
    const limitRaw = queryString(req.query.limit);
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

    const summaries = await modelArena.listArenaSummaries(taskType);
    const allEvents = await modelArena.getRuntimeEvents(limit);
    const runtimeEvents = taskType ? allEvents.filter((event) => event.taskType === taskType) : allEvents;

    const statsMap = new Map<string, {
      modelId: string;
      taskType: string;
      totalEvents: number;
      successCount: number;
      failedCount: number;
      avgLatencyMs: number;
      lastRecordedAt: string;
    }>();

    for (const event of runtimeEvents) {
      const key = `${event.modelId}||${event.taskType}`;
      const current = statsMap.get(key) ?? {
        modelId: event.modelId,
        taskType: event.taskType,
        totalEvents: 0,
        successCount: 0,
        failedCount: 0,
        avgLatencyMs: 0,
        lastRecordedAt: event.recordedAt,
      };
      const totalLatency = current.avgLatencyMs * current.totalEvents + event.latencyMs;
      current.totalEvents += 1;
      current.avgLatencyMs = Math.round(totalLatency / current.totalEvents);
      if (event.outcome === "failed") current.failedCount += 1;
      else current.successCount += 1;
      if (new Date(event.recordedAt).getTime() > new Date(current.lastRecordedAt).getTime()) {
        current.lastRecordedAt = event.recordedAt;
      }
      statsMap.set(key, current);
    }

    const taskTypes = [...new Set([
      ...summaries.map((summary) => summary.taskType),
      ...runtimeEvents.map((event) => event.taskType),
    ])].sort();

    const recommendations = await Promise.all(
      taskTypes.map(async (type) => ({
        taskType: type,
        recommendation: await modelArena.getRecommendation(type),
      })),
    );

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      policy: {
        storage: "redis_only",
        action: "advisory_only",
        rawPromptStored: false,
        rawOutputStored: false,
      },
      summaries,
      runtimeStats: [...statsMap.values()].sort((a, b) => new Date(b.lastRecordedAt).getTime() - new Date(a.lastRecordedAt).getTime()),
      runtimeEvents,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/scheduler/status", founderOnly, (_req: Request, res: Response) => {
  res.json({
    success: true,
    scheduler: schedulerLoop.getSchedulerLoopStatus(),
  });
});

colonyRouter.post("/scheduler/tick", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await schedulerLoop.runSchedulerTick("founder-manual-tick");
    res.json({ success: true, result, scheduler: schedulerLoop.getSchedulerLoopStatus() });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/reporter/run", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cadenceRaw = typeof req.body?.cadence === "string" ? req.body.cadence : "daily";
    const validCadences: reporterEngine.ReporterCadence[] = ["daily", "weekly", "heartbeat"];
    const cadence: reporterEngine.ReporterCadence = validCadences.includes(cadenceRaw as reporterEngine.ReporterCadence)
      ? (cadenceRaw as reporterEngine.ReporterCadence)
      : "daily";
    const force = Boolean(req.body?.force);
    const result = await reporterEngine.runReporter(cadence, force);
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/heartbeat/trigger", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await schedulerLoop.runHeartbeat(true);
    res.json({ success: true, result, scheduler: schedulerLoop.getSchedulerLoopStatus() });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/reporter/summary", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cadenceRaw = typeof req.query.cadence === "string" ? req.query.cadence : "daily";
    const validSummaryCadences: reporterEngine.ReporterCadence[] = ["daily", "weekly", "heartbeat"];
    const cadence: reporterEngine.ReporterCadence = validSummaryCadences.includes(cadenceRaw as reporterEngine.ReporterCadence)
      ? (cadenceRaw as reporterEngine.ReporterCadence)
      : "daily";
    const summary = await reporterEngine.buildReporterSummary(cadence);
    res.json({ success: true, cadence, summary });
  } catch (err) {
    next(err);
  }
});

//   ?format=jsonl            — return as JSONL (default: json)

colonyRouter.get("/training-export", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tagsRaw = req.query.tags as string | undefined;
    const taskId = req.query.taskId as string | undefined;
    const since = req.query.since as string | undefined;
    const format = (req.query.format as string | undefined) ?? "json";

    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : undefined;

    const { records, stats } = await exportTrainingData({ tags, taskId, since });

    const { actor, actorRole, ip } = auditActor(req);
    await auditEngine.emitAudit({
      actor, actorRole, ip,
      action: "training.export" as AuditAction,
      resource: "training:export",
      detail: {
        source: "api",
        recordCount: records.length,
        format,
        filters: { tags, taskId, since },
      },
    });

    if (format === "jsonl") {
      // Stream as JSONL for direct consumption by training pipelines
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="jagat-training-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      const lines = records.map(r => JSON.stringify(r));
      res.send(lines.join("\n") + (lines.length > 0 ? "\n" : ""));
    } else {
      res.json({
        success: true,
        stats,
        records,
      });
    }
  } catch (err) {
    next(err);
  }
});

// COG-2 — founder-reviewed cognitive distillation records.

colonyRouter.post("/distillation/records", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actor } = auditActor(req);
    const record = await distillationEngine.createDistillationRecord({
      question: req.body?.question,
      answer: req.body?.answer,
      contextSources: req.body?.contextSources,
      citations: req.body?.citations,
      tags: req.body?.tags,
      benchmarkName: req.body?.benchmarkName,
      benchmarkPassed: req.body?.benchmarkPassed,
      score: req.body?.score,
      notes: req.body?.notes,
      createdBy: actor,
    });

    res.status(201).json({ success: true, record });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/distillation/records", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const normalizedStatus = status === "pending_review" || status === "auto_accepted" || status === "needs_founder_review" || status === "accepted" || status === "rejected"
      ? status
      : undefined;

    const records = await distillationEngine.listDistillationRecords({
      status: normalizedStatus,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    res.json({ success: true, records });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/distillation/records/:recordId/screen", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await distillationEngine.screenDistillationRecord(param(req, "recordId"));
    res.json({ success: true, record, screening: record.screening });
  } catch (err) {
    next(err);
  }
});

colonyRouter.patch("/distillation/records/:recordId", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.body?.status;
    if (status !== "accepted" && status !== "rejected") {
      res.status(400).json({ error: "Bad Request", message: "status must be accepted or rejected" });
      return;
    }

    const { actor } = auditActor(req);
    const record = await distillationEngine.reviewDistillationRecord(
      param(req, "recordId"),
      status,
      actor,
      typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined,
    );

    res.json({ success: true, record });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/distillation/export", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusRaw === "pending_review" || statusRaw === "auto_accepted" || statusRaw === "needs_founder_review" || statusRaw === "accepted" || statusRaw === "rejected"
      ? statusRaw
      : undefined;
    const tagsRaw = typeof req.query.tags === "string" ? req.query.tags : undefined;
    const tags = tagsRaw ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined;
    const format = typeof req.query.format === "string" ? req.query.format : "json";

    const { records, stats } = await distillationEngine.exportDistillationTrainingData({ status, tags });

    if (format === "jsonl") {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="jagat-distillation-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      const lines = records.map((record) => JSON.stringify(record));
      res.send(lines.join("\n") + (lines.length > 0 ? "\n" : ""));
      return;
    }

    res.json({ success: true, stats, records });
  } catch (err) {
    next(err);
  }
});

// ── WhatsApp Adapter ─────────────────────────────────────────────────────────
// FOUNDER ONLY — WhatsApp connection management and messaging

colonyRouter.get("/whatsapp/status", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = whatsappAdapter.getWhatsAppStatus();
    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/connect", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Start connection (non-blocking — QR will be emitted)
    whatsappAdapter.connectWhatsApp().catch((err) => {
      console.error("[WA] Connect error:", err);
    });
    res.json({ success: true, message: "WhatsApp connection initiated. Check /whatsapp/status for QR code." });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/disconnect", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await whatsappAdapter.disconnectWhatsApp();
    res.json({ success: true, message: "WhatsApp disconnected." });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/reconnect", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    whatsappAdapter.reconnectWhatsApp().catch((err) => {
      console.error("[WA] Reconnect error:", err);
    });
    res.json({ success: true, message: "WhatsApp reconnect initiated." });
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/whatsapp/qr", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const qr = whatsappAdapter.getLastQr();
    if (!qr) {
      res.json({ success: true, qr: null, message: "No QR available. WhatsApp may already be connected or not yet connecting." });
      return;
    }
    res.json({ success: true, qr });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /colony/whatsapp/qr-page — Render QR as scannable HTML page.
 * Founder can open this URL in browser to see and scan the QR code.
 * No external QR library needed — uses Google Charts QR API.
 */
colonyRouter.get("/whatsapp/qr-page", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = whatsappAdapter.getWhatsAppStatus();

    if (status.connected) {
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>JAGAT WA QR</title>
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#00ff88;font-family:monospace;}</style>
</head><body><div style="text-align:center"><h1>✅ WhatsApp Already Connected</h1><p>State: ${status.state}</p><p>Chat mode: ${status.chatMode}</p></div></body></html>`);
      return;
    }

    const qr = whatsappAdapter.getLastQr();
    if (!qr) {
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>JAGAT WA QR</title>
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#ffaa00;font-family:monospace;}</style>
</head><body><div style="text-align:center"><h1>⏳ Waiting for QR...</h1><p>State: ${status.state}</p><p>Call <code>POST /colony/whatsapp/connect</code> first, then refresh this page.</p></div></body></html>`);
      return;
    }

    // Encode QR string for URL
    const qrEncoded = encodeURIComponent(qr);
    const qrImageUrl = `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${qrEncoded}`;

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>JAGAT WA QR</title>
<style>
body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e0e0e0;font-family:monospace;}
.qr-box{text-align:center;padding:40px;border:1px solid #333;border-radius:12px;background:#111;}
h1{color:#00ff88;margin-bottom:8px;}
p.sub{color:#888;font-size:14px;margin-bottom:24px;}
img{border:8px solid white;border-radius:8px;}
.timer{margin-top:16px;color:#ff6600;font-size:13px;}
</style>
<script>
let countdown = 30;
function tick() {
  countdown--;
  document.getElementById('timer').textContent = 'QR expires in ~' + countdown + 's — refresh if expired';
  if (countdown <= 0) { location.reload(); }
}
setInterval(tick, 1000);
</script>
</head><body>
<div class="qr-box">
  <h1>🦅 JAGAT G7 — WhatsApp Pairing</h1>
  <p class="sub">Scan this QR with WhatsApp → Settings → Linked Devices</p>
  <img src="${qrImageUrl}" alt="QR Code" width="400" height="400" />
  <p class="timer" id="timer">QR expires in ~30s — refresh if expired</p>
  <p style="color:#555;font-size:12px;margin-top:12px;">Auto-refresh in 30s</p>
</div>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

colonyRouter.get("/whatsapp/groups", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await whatsappAdapter.listGroups();
    const currentTarget = notificationDispatcher.getTargetGroup();
    res.json({ success: true, groups, currentTarget });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/target-group", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupJid } = req.body ?? {};
    if (!groupJid || typeof groupJid !== "string") {
      res.status(400).json({ success: false, error: "groupJid is required (e.g. 120363XXX@g.us)" });
      return;
    }
    notificationDispatcher.setTargetGroup(groupJid);
    res.json({ success: true, message: `Target group set to ${groupJid}`, groupJid });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/test", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupJid = typeof req.body?.groupJid === "string" ? req.body.groupJid : undefined;
    const message = typeof req.body?.message === "string" ? req.body.message : "🧪 JAGAT WhatsApp Test — Colony is online.";

    if (!groupJid) {
      res.status(400).json({ success: false, error: "groupJid is required" });
      return;
    }

    const result = await whatsappAdapter.sendToGroup(groupJid, message);
    res.json({ success: result.success, error: result.error });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/send", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupJid, jid, message } = req.body ?? {};

    if (!message || typeof message !== "string") {
      res.status(400).json({ success: false, error: "message is required" });
      return;
    }

    if (groupJid && typeof groupJid === "string") {
      const result = await whatsappAdapter.sendToGroup(groupJid, message);
      res.json({ success: result.success, channel: "group", error: result.error });
    } else if (jid && typeof jid === "string") {
      const result = await whatsappAdapter.sendToContact(jid, message);
      res.json({ success: result.success, channel: "contact", error: result.error });
    } else {
      res.status(400).json({ success: false, error: "groupJid or jid is required" });
    }
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/dispatch-report", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cadenceRaw = typeof req.body?.cadence === "string" ? req.body.cadence : "daily";
    const validDispatchCadences: reporterEngine.ReporterCadence[] = ["daily", "weekly", "heartbeat"];
    const cadence: reporterEngine.ReporterCadence = validDispatchCadences.includes(cadenceRaw as reporterEngine.ReporterCadence)
      ? (cadenceRaw as reporterEngine.ReporterCadence)
      : "daily";
    const summary = await reporterEngine.buildReporterSummary(cadence);
    const result = await notificationDispatcher.dispatchReporterSummary(summary, cadence);
    res.json({ success: true, result, summary });
  } catch (err) {
    next(err);
  }
});

// ── WhatsApp Chat Mode ─────────────────────────────────────────────────────
// Toggle conversational mode: off (send-only), mention, dm, all

colonyRouter.get("/whatsapp/chat-mode", founderOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = whatsappAdapter.getChatMode();
    res.json({
      success: true,
      chatMode: mode,
      modes: {
        off: "Send-only — bot tidak memproses pesan masuk",
        mention: "Bot hanya menjawab saat di-mention di grup",
        dm: "Bot hanya menjawab DM (direct message)",
        all: "Bot menjawab semua: mention di grup + DM",
      },
    });
  } catch (err) {
    next(err);
  }
});

colonyRouter.post("/whatsapp/chat-mode", founderOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = req.body?.mode;
    const validModes = ["off", "mention", "dm", "all"];
    if (!validModes.includes(mode)) {
      res.status(400).json({ success: false, error: `Invalid mode. Must be one of: ${validModes.join(", ")}` });
      return;
    }
    whatsappAdapter.setChatMode(mode as whatsappAdapter.ChatMode);
    res.json({ success: true, chatMode: mode, message: `Chat mode set to: ${mode}` });
  } catch (err) {
    next(err);
  }
});
