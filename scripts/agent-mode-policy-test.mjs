#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildAgentModeSystemPrompt, normalizeAgentMode } from "../dist/prompts/agent-modes.js";

const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
};

test("normalize valid modes", () => {
  assert.equal(normalizeAgentMode("research"), "research");
  assert.equal(normalizeAgentMode("kiting"), "kiting");
  assert.equal(normalizeAgentMode("ting"), "ting");
  assert.equal(normalizeAgentMode("motherbox"), "motherbox");
});

test("normalize invalid mode to research", () => {
  assert.equal(normalizeAgentMode("colony"), "research");
  assert.equal(normalizeAgentMode(undefined), "research");
  assert.equal(normalizeAgentMode(42), "research");
});

test("kiting forbids outbound and credentials", () => {
  const prompt = buildAgentModeSystemPrompt("kiting").toLowerCase();
  assert.match(prompt, /auto-send|otomatis/);
  assert.match(prompt, /credential/);
  assert.match(prompt, /colony internal/);
});

test("ting includes financial advice disclosure", () => {
  const prompt = buildAgentModeSystemPrompt("ting").toLowerCase();
  assert.match(prompt, /bukan nasihat keuangan/);
  assert.match(prompt, /beli\/jual/);
  assert.match(prompt, /profit/);
});

test("motherbox blocks secrets and colony internals", () => {
  const prompt = buildAgentModeSystemPrompt("motherbox").toLowerCase();
  assert.match(prompt, /api/);
  assert.match(prompt, /secrets|secret/);
  assert.match(prompt, /colony internal/);
  assert.match(prompt, /quota/);
});

const failed = checks.filter((check) => !check.ok);
console.log(`\nAgent mode policy test: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);

