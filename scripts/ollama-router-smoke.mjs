#!/usr/bin/env node
/**
 * Smoke test for JAGAT Ollama remote routing and local fallback.
 */

import { spawnSync } from "node:child_process";

const REMOTE_OLLAMA_HOST = process.env.REMOTE_OLLAMA_HOST || "http://100.107.244.82:11434";
const REMOTE_INFERENCE_MODEL = process.env.REMOTE_INFERENCE_MODEL || "qwen2.5-coder:7b";
const LOCAL_MODEL = process.env.LOCAL_OLLAMA_MODEL || "llama3:latest";

let passed = 0;
let failed = 0;

function runCase(label, env, expectedModelPattern) {
  const code = `
    const { OllamaService } = await import("./dist/services/ollama.js");
    const service = new OllamaService();
    const result = await service.generateCompletion(
      "Jawab satu kata: siap",
      "Jawab singkat dalam bahasa Indonesia.",
      "${LOCAL_MODEL}",
      { temperature: 0.1, num_predict: 24 }
    );
    console.log(JSON.stringify({ model: result.model, response: result.response }));
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });

  if (result.status !== 0) {
    failed += 1;
    console.log(`FAIL ${label}`);
    console.log(result.stderr || result.stdout);
    return;
  }

  const lastLine = result.stdout.trim().split(/\r?\n/).at(-1) ?? "{}";
  const payload = JSON.parse(lastLine);
  if (!expectedModelPattern.test(payload.model)) {
    failed += 1;
    console.log(`FAIL ${label}`);
    console.log(`  expected model ${expectedModelPattern}, got ${payload.model}`);
    return;
  }

  passed += 1;
  console.log(`PASS ${label} -> ${payload.model}: ${String(payload.response || "").trim()}`);
}

console.log("\nJAGAT Ollama Router Smoke Test\n");

runCase(
  "remote enabled routes to Server B model",
  {
    OLLAMA_REMOTE_ENABLED: "true",
    REMOTE_OLLAMA_HOST,
    REMOTE_INFERENCE_MODEL,
  },
  /qwen2\.5-coder:7b/,
);

runCase(
  "remote failure falls back to local model",
  {
    OLLAMA_REMOTE_ENABLED: "true",
    REMOTE_OLLAMA_HOST: "http://127.0.0.1:9",
    REMOTE_INFERENCE_MODEL,
  },
  /llama3/,
);

console.log(`\nResults: ${passed} PASS / ${failed} FAIL\n`);
if (failed > 0) process.exit(1);
