#!/usr/bin/env node
/**
 * JAGAT G7 - Local vs Remote Ollama benchmark.
 *
 * Compares the current local model node with the Tailscale remote worker
 * without changing the production cognitive pipeline.
 */

const LOCAL_OLLAMA_URL = process.env.LOCAL_OLLAMA_URL || "http://127.0.0.1:11434";
const REMOTE_OLLAMA_URL = process.env.REMOTE_OLLAMA_URL || "http://100.107.244.82:11434";
const LOCAL_MODEL = process.env.LOCAL_OLLAMA_MODEL || "llama3:latest";
const REMOTE_MODEL = process.env.REMOTE_OLLAMA_MODEL || "qwen2.5-coder:7b";

const prompts = [
  {
    name: "short-id",
    prompt: "Jawab dalam satu kalimat: apa fungsi JAGAT G7 Colony?",
  },
  {
    name: "coding-plan",
    prompt: [
      "Anda adalah AI builder TypeScript.",
      "Buat rencana 5 langkah untuk menambah endpoint Express yang aman,",
      "dengan auth guard, audit log, dan test live. Jawab ringkas.",
    ].join(" "),
  },
  {
    name: "debug-reasoning",
    prompt: [
      "Sebuah scheduler mendeteksi task stuck tetapi tidak boleh auto-block task high-risk.",
      "Sebutkan 4 kondisi aman sebelum auto-block. Jawab bullet pendek.",
    ].join(" "),
  },
];

const targets = [
  { label: "local", baseUrl: LOCAL_OLLAMA_URL, model: LOCAL_MODEL },
  { label: "remote", baseUrl: REMOTE_OLLAMA_URL, model: REMOTE_MODEL },
];

let failed = 0;

function nsToSec(ns) {
  return Number(ns || 0) / 1_000_000_000;
}

function tokensPerSecond(tokens, durationNs) {
  const seconds = nsToSec(durationNs);
  return seconds > 0 ? tokens / seconds : 0;
}

async function listModels(target) {
  const res = await fetch(`${target.baseUrl}/api/tags`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${target.label} tags failed: ${res.status}`);
  const data = await res.json();
  return (data.models ?? []).map((model) => model.name ?? model.model).filter(Boolean);
}

async function generate(target, prompt) {
  const startedAt = Date.now();
  const res = await fetch(`${target.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: target.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 180,
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${target.label} generate failed: ${res.status} ${JSON.stringify(data)}`);

  return {
    ...data,
    wallMs: Date.now() - startedAt,
  };
}

function printResult(target, promptName, result) {
  const evalTps = tokensPerSecond(result.eval_count ?? 0, result.eval_duration ?? 0);
  const promptTps = tokensPerSecond(result.prompt_eval_count ?? 0, result.prompt_eval_duration ?? 0);
  const totalSec = nsToSec(result.total_duration);
  const loadSec = nsToSec(result.load_duration);
  const response = String(result.response ?? "").replace(/\s+/g, " ").trim();

  console.log(`\n[${target.label}] ${target.model} :: ${promptName}`);
  console.log(`  wall=${(result.wallMs / 1000).toFixed(2)}s total=${totalSec.toFixed(2)}s load=${loadSec.toFixed(2)}s`);
  console.log(`  prompt=${result.prompt_eval_count ?? 0} tok @ ${promptTps.toFixed(2)} tok/s`);
  console.log(`  output=${result.eval_count ?? 0} tok @ ${evalTps.toFixed(2)} tok/s`);
  console.log(`  response=${response.slice(0, 320)}${response.length > 320 ? "..." : ""}`);
}

console.log("\nJAGAT G7 - Ollama Local vs Remote Benchmark");
console.log("===============================================================");
console.log(`Local : ${LOCAL_OLLAMA_URL} (${LOCAL_MODEL})`);
console.log(`Remote: ${REMOTE_OLLAMA_URL} (${REMOTE_MODEL})`);

for (const target of targets) {
  try {
    const models = await listModels(target);
    const hasModel = models.includes(target.model);
    console.log(`\n${target.label} models: ${models.join(", ") || "(none)"}`);
    if (!hasModel) {
      throw new Error(`${target.label} missing model ${target.model}`);
    }
  } catch (err) {
    failed += 1;
    console.log(`\nFAIL ${target.label} readiness: ${err.message}`);
  }
}

if (failed > 0) {
  console.log(`\nResults: readiness failed (${failed})`);
  process.exit(1);
}

for (const prompt of prompts) {
  for (const target of targets) {
    try {
      const result = await generate(target, prompt.prompt);
      printResult(target, prompt.name, result);
    } catch (err) {
      failed += 1;
      console.log(`\nFAIL ${target.label} ${prompt.name}: ${err.message}`);
    }
  }
}

console.log(`\nResults: ${failed === 0 ? "PASS" : "FAIL"} (${failed} failure${failed === 1 ? "" : "s"})`);
if (failed > 0) process.exit(1);
