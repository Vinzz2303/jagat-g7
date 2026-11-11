#!/usr/bin/env node
/**
 * JAGAT Colony — Agent Registry Test
 * Covers: registerAgent, getAgent, updateAgentStatus, incrementTasksCompleted,
 *         checkPermission, enforcePermission, listAgents, getColonyRoster
 */

import {
  agentRegistry,
  DEFAULT_PERMISSIONS,
} from "../dist/colony/index.js";
import { disconnectRedis, getRedisClient } from "../dist/services/redis.service.js";
import { strict as assert } from "node:assert";

let passCount = 0;
let failCount = 0;
const createdAgentIds = [];

function pass(message) {
  passCount += 1;
  console.log(`  ✅ PASS  ${message}`);
}

function fail(message, detail = "") {
  failCount += 1;
  console.error(`  ❌ FAIL  ${message}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony — Agent Registry Test");
  console.log("===============================================================\n");

  const redis = getRedisClient();
  const ts = Date.now();

  try {
    // ── Suite 1: Permission functions (pure, no Redis for check) ──
    console.log("🔐 Suite 1: Permission enforcement");

    // Builder has canWriteCode, canCreatePatch, canRunBuild
    const builderPerms = DEFAULT_PERMISSIONS["builder"];
    assert.ok(builderPerms, "DEFAULT_PERMISSIONS has builder entry");
    if (builderPerms) {
      const testAgent = {
        agentId: "test-agent",
        role: "builder",
        displayName: "Test Builder",
        status: "idle",
        capabilities: [],
        permissions: builderPerms,
        lastHeartbeat: new Date().toISOString(),
        totalTasksCompleted: 0,
        createdAt: new Date().toISOString(),
      };

      // checkPermission
      if (agentRegistry.checkPermission(testAgent, "canWriteCode")) {
        pass("checkPermission: builder canWriteCode = true");
      } else {
        fail("checkPermission: builder canWriteCode = true");
      }

      if (!agentRegistry.checkPermission(testAgent, "canApprovePatches")) {
        pass("checkPermission: builder canApprovePatches = false");
      } else {
        fail("checkPermission: builder canApprovePatches = false");
      }

      // enforcePermission — should not throw for allowed
      try {
        agentRegistry.enforcePermission(testAgent, "canWriteCode");
        pass("enforcePermission: builder canWriteCode does not throw");
      } catch {
        fail("enforcePermission: builder canWriteCode does not throw");
      }

      // enforcePermission — should throw for denied
      try {
        agentRegistry.enforcePermission(testAgent, "canApprovePatches");
        fail("enforcePermission: builder canApprovePatches throws");
      } catch (err) {
        if (err.message.includes("does not have permission")) {
          pass("enforcePermission: builder canApprovePatches throws");
        } else {
          fail("enforcePermission: builder canApprovePatches throws", err.message);
        }
      }
    }

    // Reporter does NOT have canWriteCode
    const reporterPerms = DEFAULT_PERMISSIONS["reporter"];
    if (reporterPerms) {
      const reporterAgent = {
        agentId: "test-reporter",
        role: "reporter",
        displayName: "Test Reporter",
        status: "idle",
        capabilities: [],
        permissions: reporterPerms,
        lastHeartbeat: new Date().toISOString(),
        totalTasksCompleted: 0,
        createdAt: new Date().toISOString(),
      };

      if (!agentRegistry.checkPermission(reporterAgent, "canWriteCode")) {
        pass("checkPermission: reporter canWriteCode = false");
      } else {
        fail("checkPermission: reporter canWriteCode = false");
      }
    }

    // ── Suite 2: Agent CRUD (Redis) ──────────────────────────────
    console.log("\n📋 Suite 2: Agent registration and retrieval");

    const agent = await agentRegistry.registerAgent({
      role: "builder",
      displayName: `Test Builder ${ts}`,
      capabilities: ["test_cap"],
    });
    createdAgentIds.push(agent.agentId);

    if (agent.agentId && agent.agentId.startsWith("agent-")) {
      pass("registerAgent returns valid agentId");
    } else {
      fail("registerAgent returns valid agentId", `got: ${agent.agentId}`);
    }

    if (agent.role === "builder") {
      pass("registerAgent preserves role");
    } else {
      fail("registerAgent preserves role");
    }

    if (agent.status === "idle") {
      pass("registerAgent sets initial status to idle");
    } else {
      fail("registerAgent sets initial status to idle");
    }

    if (agent.permissions === DEFAULT_PERMISSIONS["builder"]) {
      pass("registerAgent assigns default permissions for role");
    } else {
      fail("registerAgent assigns default permissions for role");
    }

    // getAgent
    const retrieved = await agentRegistry.getAgent(agent.agentId);
    if (retrieved && retrieved.agentId === agent.agentId) {
      pass("getAgent retrieves stored agent");
    } else {
      fail("getAgent retrieves stored agent");
    }

    const notFound = await agentRegistry.getAgent("agent-nonexistent");
    if (notFound === null) {
      pass("getAgent returns null for missing agent");
    } else {
      fail("getAgent returns null for missing agent");
    }

    // ── Suite 3: Status update ───────────────────────────────────
    console.log("\n🔄 Suite 3: Status update");

    const updated = await agentRegistry.updateAgentStatus(agent.agentId, "working", "TASK-TEST-1");
    if (updated.status === "working") {
      pass("updateAgentStatus sets new status");
    } else {
      fail("updateAgentStatus sets new status");
    }

    if (updated.currentTaskId === "TASK-TEST-1") {
      pass("updateAgentStatus sets currentTaskId");
    } else {
      fail("updateAgentStatus sets currentTaskId");
    }

    // Transition out of working — should clear currentTaskId
    const backToIdle = await agentRegistry.updateAgentStatus(agent.agentId, "idle");
    if (backToIdle.currentTaskId === undefined) {
      pass("updateAgentStatus clears currentTaskId when leaving working");
    } else {
      fail("updateAgentStatus clears currentTaskId when leaving working", `got: ${backToIdle.currentTaskId}`);
    }

    // Update non-existent agent — should throw
    try {
      await agentRegistry.updateAgentStatus("agent-does-not-exist", "idle");
      fail("updateAgentStatus throws for missing agent");
    } catch (err) {
      if (err.message.includes("not found")) {
        pass("updateAgentStatus throws for missing agent");
      } else {
        fail("updateAgentStatus throws for missing agent", err.message);
      }
    }

    // ── Suite 4: incrementTasksCompleted ─────────────────────────
    console.log("\n📈 Suite 4: incrementTasksCompleted");

    await agentRegistry.incrementTasksCompleted(agent.agentId);
    const after = await agentRegistry.getAgent(agent.agentId);
    if (after && after.totalTasksCompleted === 1) {
      pass("incrementTasksCompleted increments to 1");
    } else {
      fail("incrementTasksCompleted increments to 1", `got: ${after?.totalTasksCompleted}`);
    }

    await agentRegistry.incrementTasksCompleted(agent.agentId);
    const after2 = await agentRegistry.getAgent(agent.agentId);
    if (after2 && after2.totalTasksCompleted === 2) {
      pass("incrementTasksCompleted increments to 2");
    } else {
      fail("incrementTasksCompleted increments to 2");
    }

    // Non-existent agent — should throw
    try {
      await agentRegistry.incrementTasksCompleted("agent-does-not-exist");
      fail("incrementTasksCompleted throws for missing agent");
    } catch (err) {
      if (err.message.includes("not found")) {
        pass("incrementTasksCompleted throws for missing agent");
      } else {
        fail("incrementTasksCompleted throws for missing agent", err.message);
      }
    }

    // ── Suite 5: listAgents and getColonyRoster ──────────────────
    console.log("\n📊 Suite 5: listAgents and getColonyRoster");

    const allAgents = await agentRegistry.listAgents();
    if (Array.isArray(allAgents) && allAgents.length > 0) {
      pass("listAgents returns array with agents");
    } else {
      fail("listAgents returns array with agents");
    }

    // Filter by role
    const builders = await agentRegistry.listAgents("builder");
    if (builders.length > 0 && builders.every((a) => a.role === "builder")) {
      pass("listAgents filters by role correctly");
    } else {
      fail("listAgents filters by role correctly");
    }

    const roster = await agentRegistry.getColonyRoster();
    if (roster.totalAgents > 0) {
      pass("getColonyRoster returns totalAgents > 0");
    } else {
      fail("getColonyRoster returns totalAgents > 0");
    }

    if (roster.byRole["builder"] > 0) {
      pass("getColonyRoster counts builder agents");
    } else {
      fail("getColonyRoster counts builder agents");
    }

    if (roster.byStatus["idle"] > 0) {
      pass("getColonyRoster counts idle agents");
    } else {
      fail("getColonyRoster counts idle agents");
    }

  } catch (err) {
    console.error("\n💥 Unexpected error:", err.message);
    failCount += 1;
  } finally {
    // Cleanup
    for (const id of createdAgentIds) {
      try {
        await redis.del(`colony:agent:${id}`);
        await redis.srem("colony:agent:index", id);
        await redis.del(`colony:agent:${id}:heartbeat`);
      } catch { /* best-effort */ }
    }
    await disconnectRedis();
  }

  console.log("\n===============================================================");
  console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
  console.log("===============================================================\n");
  process.exit(failCount > 0 ? 1 : 0);
}

main();
