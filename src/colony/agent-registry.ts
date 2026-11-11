// ============================================================================
// JAGAT Colony — Agent Registry
// Registrasi, monitoring status, dan permission enforcement agent colony
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import {
  type ColonyAgent,
  type AgentRole,
  type AgentStatus,
  type AgentPermission,
  DEFAULT_PERMISSIONS,
  REDIS_KEYS,
} from "./types.js";

// ── Agent Registration ──────────────────────────────────────────────────────

export async function registerAgent(params: {
  role: AgentRole;
  displayName: string;
  capabilities?: string[];
}): Promise<ColonyAgent> {
  // Defense-in-depth: validate role has permission mapping before creating agent
  const permissions = DEFAULT_PERMISSIONS[params.role];
  if (!permissions) {
    throw new Error(`Cannot register agent: unknown role "${params.role}" has no permission mapping`);
  }

  const redis = getRedisClient();
  const agentId = `agent-${params.role}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const agent: ColonyAgent = {
    agentId,
    role: params.role,
    displayName: params.displayName,
    status: "idle",
    capabilities: params.capabilities ?? [],
    permissions,
    lastHeartbeat: now,
    totalTasksCompleted: 0,
    createdAt: now,
  };

  await redis.set(REDIS_KEYS.agent(agentId), JSON.stringify(agent));
  await redis.sadd(REDIS_KEYS.agentIndex(), agentId);
  await redis.set(REDIS_KEYS.agentHeartbeat(agentId), now);

  return agent;
}

export async function getAgent(agentId: string): Promise<ColonyAgent | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.agent(agentId));
  if (!data) return null;
  try {
    return JSON.parse(data) as ColonyAgent;
  } catch {
    // Defense-in-depth: corrupted Redis entry (e.g., truncated from crash)
    // treated as non-existent rather than crashing all callers
    console.warn(`[Colony] Corrupted agent data for ${agentId}, skipping`);
    return null;
  }
}

export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus,
  currentTaskId?: string,
): Promise<ColonyAgent> {
  const redis = getRedisClient();
  const agent = await getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  agent.status = status;
  agent.currentTaskId = currentTaskId;
  agent.lastHeartbeat = new Date().toISOString();

  // Clear stale currentTaskId when agent leaves working state
  if (status !== "working" && agent.currentTaskId) {
    agent.currentTaskId = undefined;
  }

  await redis.set(REDIS_KEYS.agent(agentId), JSON.stringify(agent));
  await redis.set(REDIS_KEYS.agentHeartbeat(agentId), agent.lastHeartbeat);

  return agent;
}

export async function incrementTasksCompleted(agentId: string): Promise<void> {
  const redis = getRedisClient();
  const agent = await getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  agent.totalTasksCompleted++;
  agent.lastHeartbeat = new Date().toISOString();
  await redis.set(REDIS_KEYS.agent(agentId), JSON.stringify(agent));
}

// ── Query Functions ─────────────────────────────────────────────────────────

export async function listAgents(role?: AgentRole): Promise<ColonyAgent[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.agentIndex());

  const agents: ColonyAgent[] = [];
  for (const id of ids) {
    const agent = await getAgent(id);
    if (agent && (!role || agent.role === role)) {
      agents.push(agent);
    }
  }

  return agents;
}

export async function getAgentsByStatus(status: AgentStatus): Promise<ColonyAgent[]> {
  const agents = await listAgents();
  return agents.filter((a) => a.status === status);
}

// ── Permission Enforcement ──────────────────────────────────────────────────

export function checkPermission(
  agent: ColonyAgent,
  action: keyof AgentPermission,
): boolean {
  return agent.permissions[action] === true;
}

export function enforcePermission(
  agent: ColonyAgent,
  action: keyof AgentPermission,
): void {
  if (!checkPermission(agent, action)) {
    throw new Error(
      `Agent ${agent.agentId} (${agent.role}) does not have permission: ${action}`,
    );
  }
}

// ── Colony Roster ───────────────────────────────────────────────────────────

export interface ColonyRoster {
  totalAgents: number;
  byRole: Record<AgentRole, number>;
  byStatus: Record<AgentStatus, number>;
  agents: ColonyAgent[];
}

export async function getColonyRoster(): Promise<ColonyRoster> {
  const agents = await listAgents();

  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const agent of agents) {
    byRole[agent.role] = (byRole[agent.role] ?? 0) + 1;
    byStatus[agent.status] = (byStatus[agent.status] ?? 0) + 1;
  }

  return {
    totalAgents: agents.length,
    byRole: byRole as Record<AgentRole, number>,
    byStatus: byStatus as Record<AgentStatus, number>,
    agents,
  };
}

// ── Seed Default Colony Agents ──────────────────────────────────────────────
// Bootstrap the default colony roster if empty

export async function seedDefaultAgents(): Promise<ColonyAgent[]> {
  const redis = getRedisClient();
  const existingIds = await redis.smembers(REDIS_KEYS.agentIndex());

  if (existingIds.length > 0) {
    // Colony already has agents registered
    const agents: ColonyAgent[] = [];
    for (const id of existingIds) {
      const a = await getAgent(id);
      if (a) agents.push(a);
    }
    return agents;
  }

  // Seed the 6 official colony units
  const seeds: Array<{ role: AgentRole; displayName: string; capabilities: string[] }> = [
    {
      role: "director",
      displayName: "Colony Director",
      capabilities: [
        "translate_founder_direction",
        "create_mission",
        "prioritize_queue",
        "lock_acceptance_criteria",
      ],
    },
    {
      role: "planner",
      displayName: "Architect Agent",
      capabilities: [
        "read_masterplan",
        "create_task_plan",
        "detect_dependency",
        "suggest_milestone",
        "risk_flagging",
      ],
    },
    {
      role: "researcher",
      displayName: "Research & Memory Agent",
      capabilities: [
        "document_reading",
        "ingest_management",
        "knowledge_curation",
        "provenance_tracking",
        "gap_analysis",
      ],
    },
    {
      role: "builder",
      displayName: "Builder / Coder Agent",
      capabilities: [
        "implement_task",
        "create_patch",
        "run_build",
        "basic_verification",
        "change_summary",
      ],
    },
    {
      role: "reviewer",
      displayName: "Reviewer / QA Agent",
      capabilities: [
        "code_review",
        "risk_audit",
        "regression_check",
        "scope_verification",
        "review_verdict",
      ],
    },
    {
      role: "reporter",
      displayName: "Reporter / Operations Agent",
      capabilities: [
        "write_progress",
        "update_status",
        "daily_brief",
        "weekly_brief",
        "blocker_report",
        "meeting_preparation",
      ],
    },
  ];

  const agents: ColonyAgent[] = [];
  for (const seed of seeds) {
    const agent = await registerAgent(seed);
    agents.push(agent);
  }

  console.log(`[Colony] Seeded ${agents.length} default colony agents.`);
  return agents;
}
