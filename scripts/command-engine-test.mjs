#!/usr/bin/env node
/**
 * JAGAT Colony — Command Engine Test
 * Covers: parseCommand (pure), executeCommand role guard, help command
 */

import { strict as assert } from "node:assert";

const mod = await import("../dist/colony/command-engine.js");
const { parseCommand, executeCommand } = mod;

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`  ✅ PASS  ${message}`);
}

function fail(message, detail = "") {
  failCount += 1;
  console.error(`  ❌ FAIL  ${message}${detail ? ` — ${detail}` : ""}`);
}

console.log("===============================================================");
console.log("  JAGAT Colony — Command Engine Test");
console.log("===============================================================\n");

// ── Suite 1: parseCommand — pure function ──────────────────────────────────

console.log("🔍 Suite 1: parseCommand");

// Regular message → null
{
  const result = parseCommand("hello world");
  if (result === null) {
    pass("Regular message returns null");
  } else {
    fail("Regular message returns null", `got: ${JSON.stringify(result)}`);
  }
}

// Empty string → null
{
  const result = parseCommand("");
  if (result === null) {
    pass("Empty string returns null");
  } else {
    fail("Empty string returns null");
  }
}

// Just "/" → null (empty command after strip)
{
  const result = parseCommand("/");
  if (result === null) {
    pass("Slash alone returns null");
  } else {
    fail("Slash alone returns null", `got: ${JSON.stringify(result)}`);
  }
}

// /help
{
  const result = parseCommand("/help");
  if (result && result.command === "help" && result.args.length === 0) {
    pass("/help parses correctly");
  } else {
    fail("/help parses correctly", `got: ${JSON.stringify(result)}`);
  }
}

// /task builder Fix the bug
{
  const result = parseCommand("/task builder Fix the bug");
  if (result && result.command === "task" && result.args.length === 4 && result.args[0] === "builder" && result.args[1] === "Fix") {
    pass("/task builder Fix the bug parses correctly");
  } else {
    fail("/task builder Fix the bug parses correctly", `got: ${JSON.stringify(result)}`);
  }
}

// Case insensitive command
{
  const result = parseCommand("/STATUS");
  if (result && result.command === "status") {
    pass("Command is case-insensitive (STATUS → status)");
  } else {
    fail("Command is case-insensitive");
  }
}

// Leading whitespace
{
  const result = parseCommand("  /help  ");
  if (result && result.command === "help") {
    pass("Leading whitespace is trimmed");
  } else {
    fail("Leading whitespace is trimmed");
  }
}

// /context sovereign architecture --category=blueprint
{
  const result = parseCommand("/context sovereign architecture --category=blueprint");
  if (result && result.command === "context" && result.args.includes("--category=blueprint") && result.args.includes("sovereign")) {
    pass("/context with flag parses correctly");
  } else {
    fail("/context with flag parses correctly", `got: ${JSON.stringify(result)}`);
  }
}

// /patch-approve PATCH-001 LGTM --training
{
  const result = parseCommand("/patch-approve PATCH-001 LGTM --training");
  if (result && result.command === "patch-approve" && result.args[0] === "PATCH-001" && result.args.includes("--training")) {
    pass("/patch-approve with --training flag parses correctly");
  } else {
    fail("/patch-approve with --training flag parses correctly", `got: ${JSON.stringify(result)}`);
  }
}

// Non-slash prefix → null
{
  const result = parseCommand("not a command /help");
  if (result === null) {
    pass("Non-slash prefix returns null");
  } else {
    fail("Non-slash prefix returns null");
  }
}

// ── Suite 2: executeCommand — role guard ───────────────────────────────────

console.log("\n🛡️ Suite 2: executeCommand — role guard");

// Non-founder should be rejected
{
  const cmd = parseCommand("/help");
  const result = await executeCommand(cmd, "builder-agent", "builder", "room-1");
  if (!result.success && result.message.includes("founder")) {
    pass("Non-founder role rejected with clear message");
  } else {
    fail("Non-founder role rejected", `got: ${JSON.stringify(result)}`);
  }
}

// Unknown command (needs founder role to reach switch)
{
  const cmd = parseCommand("/unknowncmd");
  const result = await executeCommand(cmd, "founder", "founder", "room-1");
  if (!result.success && result.message.includes("tidak dikenali")) {
    pass("Unknown command returns not-recognized message");
  } else {
    fail("Unknown command returns not-recognized message", `got: ${JSON.stringify(result)}`);
  }
}

// /help returns help text
{
  const cmd = parseCommand("/help");
  const result = await executeCommand(cmd, "founder", "founder", "room-1");
  if (result.success && result.message.includes("/task") && result.message.includes("/patch-approve")) {
    pass("/help returns command list with /task and /patch-approve");
  } else {
    fail("/help returns command list", `got: ${result.message?.slice(0, 100)}`);
  }
}

// /sandbox returns sandbox config
{
  const cmd = parseCommand("/sandbox");
  const result = await executeCommand(cmd, "founder", "founder", "room-1");
  if (result.success && result.message.includes("Sandbox") && result.message.includes("Blocked Patterns")) {
    pass("/sandbox returns sandbox configuration");
  } else {
    fail("/sandbox returns sandbox configuration", `got: ${result.message?.slice(0, 100)}`);
  }
}

// /task with invalid agent
{
  const cmd = parseCommand("/task invalidagent Fix something");
  const result = await executeCommand(cmd, "founder", "founder", "room-1");
  if (!result.success && result.message.includes("tidak valid")) {
    pass("/task with invalid agent returns validation error");
  } else {
    fail("/task with invalid agent returns validation error", `got: ${JSON.stringify(result)}`);
  }
}

// /task with missing args
{
  const cmd = parseCommand("/task");
  const result = await executeCommand(cmd, "founder", "founder", "room-1");
  if (!result.success && result.message.includes("Format")) {
    pass("/task with no args returns format hint");
  } else {
    fail("/task with no args returns format hint", `got: ${JSON.stringify(result)}`);
  }
}

console.log("\n===============================================================");
console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
console.log("===============================================================\n");
process.exit(failCount > 0 ? 1 : 0);
