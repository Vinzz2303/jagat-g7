#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000";
const DEFAULT_TIMEOUT_MS = 420_000;
const MAX_FILE_CHARS = 24_000;
const MAX_TOTAL_CHARS = 48_000;

const COMMANDS = new Set(["review", "explain", "plan", "test"]);
const ALLOWED_ROOTS = [
  path.join(REPO_ROOT, "src"),
  path.join(REPO_ROOT, "jagat-ui", "src"),
  path.join(REPO_ROOT, "ops"),
  path.join(REPO_ROOT, "scripts"),
];
const BLOCKED_PARTS = [
  ".env",
  ".git",
  "node_modules",
  "dist",
  "qdrant_data",
  "package-lock.json",
  "cookie-signer",
  "auth.ts",
];
const BLOCKED_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".sqlite",
  ".db",
]);
const HIGH_RISK_WORDS = [
  "deploy",
  "production",
  "restart service",
  "ssh key",
  "secret",
  "credential",
  "token",
  "password",
  ".env",
  "delete database",
  "drop table",
  "openclaw",
];

function printHelp() {
  console.log(`
JAGAT code assist CLI for Mas Chris

Usage:
  npm run jagat:code -- <review|explain|plan|test> [request] [--file <path>] [--lines <start:end>] [--search <text>] [--dry-run]

Examples:
  npm run jagat:code -- review --file src/colony/model-router.ts
  npm run jagat:code -- explain --file jagat-ui/src/app/page.tsx
  npm run jagat:code -- plan "buat flow pricing usage meter"
  npm run jagat:code -- test --file src/colony/worker-sandbox.ts --lines 1:220

Environment:
  JAGAT_ACTOR=christoper
  JAGAT_ROLE=executive_product
  JAGAT_BACKEND_URL=http://127.0.0.1:5000
  JAGAT_CODE_ASSIST_TIMEOUT_MS=420000

Safety:
  Read-only. This CLI never writes files, applies patches, deploys, or touches secrets.
`);
}

function parseArgs(argv) {
  const options = {
    command: "",
    requestParts: [],
    files: [],
    lines: null,
    search: "",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else if (arg === "--file") {
      const value = argv[++i];
      if (!value) throw new Error("--file requires a path");
      options.files.push(value);
    } else if (arg === "--lines") {
      const value = argv[++i];
      if (!value || !/^\d+:\d+$/.test(value)) {
        throw new Error("--lines requires start:end, for example 1:160");
      }
      options.lines = value;
    } else if (arg === "--search") {
      const value = argv[++i];
      if (!value) throw new Error("--search requires text");
      options.search = value;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (!options.command) {
      options.command = arg;
    } else {
      options.requestParts.push(arg);
    }
  }

  return options;
}

function assertSafeRequest(text) {
  const lower = text.toLowerCase();
  const hit = HIGH_RISK_WORDS.find((word) => lower.includes(word));
  if (hit) {
    throw new Error(
      `Request contains high-risk term "${hit}". Use founder/operator review for this task.`,
    );
  }
}

function normalizePath(rawPath) {
  const resolved = path.resolve(REPO_ROOT, rawPath);
  const lower = resolved.toLowerCase();
  const allowed = ALLOWED_ROOTS.some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!allowed) {
    throw new Error(`Path is outside allowed pilot roots: ${rawPath}`);
  }
  if (BLOCKED_PARTS.some((part) => lower.includes(part.toLowerCase()))) {
    throw new Error(`Path is blocked by pilot guardrail: ${rawPath}`);
  }
  if (BLOCKED_EXTENSIONS.has(path.extname(lower))) {
    throw new Error(`File extension is blocked by pilot guardrail: ${rawPath}`);
  }
  return resolved;
}

async function readSnippet(filePath, lines) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error(`Not a file: ${filePath}`);
  if (stat.size > 300_000) throw new Error(`File too large for pilot CLI: ${filePath}`);

  const raw = await fs.readFile(filePath, "utf8");
  const allLines = raw.split(/\r?\n/);
  let selected = allLines;

  if (lines) {
    const [start, end] = lines.split(":").map((n) => Number.parseInt(n, 10));
    if (start < 1 || end < start) throw new Error(`Invalid --lines range: ${lines}`);
    selected = allLines.slice(start - 1, end);
  }

  const numbered = selected
    .map((line, index) => {
      const lineNumber = lines
        ? Number.parseInt(lines.split(":")[0], 10) + index
        : index + 1;
      return `${String(lineNumber).padStart(4, " ")} | ${line}`;
    })
    .join("\n");

  return numbered.slice(0, MAX_FILE_CHARS);
}

async function searchFiles(query) {
  const safeQuery = query.toLowerCase();
  const matches = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const lower = fullPath.toLowerCase();
      if (BLOCKED_PARTS.some((part) => lower.includes(part.toLowerCase()))) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (BLOCKED_EXTENSIONS.has(path.extname(lower))) continue;
      if (!/\.(ts|tsx|js|jsx|mjs|md|json|css)$/.test(lower)) continue;

      const raw = await fs.readFile(fullPath, "utf8").catch(() => "");
      const lines = raw.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(safeQuery) && matches.length < 30) {
          matches.push(`${path.relative(REPO_ROOT, fullPath)}:${index + 1}: ${line.trim()}`);
        }
      });
      if (matches.length >= 30) return;
    }
  }

  for (const root of ALLOWED_ROOTS) {
    await walk(root).catch(() => {});
    if (matches.length >= 30) break;
  }
  return matches.join("\n");
}

function parseSse(text) {
  const events = [];
  for (const block of text.split(/\n\n+/)) {
    const dataLine = block
      .split(/\n/)
      .find((line) => line.startsWith("data:"));
    if (!dataLine) continue;
    const data = dataLine.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      events.push({ type: "raw", data });
    }
  }
  return events;
}

async function callJagat(topic) {
  const backendUrl = process.env.JAGAT_BACKEND_URL || DEFAULT_BACKEND_URL;
  const timeoutMs = Number.parseInt(
    process.env.JAGAT_CODE_ASSIST_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
    10,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${backendUrl.replace(/\/$/, "")}/research`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-JAGAT-Actor": process.env.JAGAT_ACTOR || "christoper",
        "X-JAGAT-Role": process.env.JAGAT_ROLE || "executive_product",
      },
      body: JSON.stringify({
        topic,
        agentMode: "kiting",
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`JAGAT backend timed out after ${timeoutMs}ms. Warm Ollama or increase JAGAT_CODE_ASSIST_TIMEOUT_MS.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`JAGAT backend returned ${res.status}: ${text.slice(0, 300)}`);
  }

  const events = parseSse(text);
  const answer =
    events
      .map((event) => event.content || event.text || event.answer || "")
      .filter(Boolean)
      .join("\n")
      .trim() || text.trim();

  return answer;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.command || options.command === "help") {
    printHelp();
    return;
  }
  if (!COMMANDS.has(options.command)) {
    throw new Error(`Unknown command "${options.command}". Use --help.`);
  }

  const request = options.requestParts.join(" ").trim();
  assertSafeRequest(`${options.command} ${request} ${options.search}`);

  const snippets = [];
  let totalChars = 0;
  for (const rawFile of options.files) {
    const filePath = normalizePath(rawFile);
    const snippet = await readSnippet(filePath, options.lines);
    totalChars += snippet.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      throw new Error("Context is too large. Use --lines or fewer --file arguments.");
    }
    snippets.push(`File: ${path.relative(REPO_ROOT, filePath)}\n${snippet}`);
  }

  let searchContext = "";
  if (options.search) {
    searchContext = await searchFiles(options.search);
  }

  const actor = process.env.JAGAT_ACTOR || "christoper";
  const role = process.env.JAGAT_ROLE || "executive_product";
  const topic = [
    `Actor: ${actor}`,
    `Role: ${role}`,
    "Mode: read-only coding companion pilot. Do not claim to edit files. Do not provide deploy, secret, or production-operation instructions.",
    `Task type: ${options.command}`,
    request ? `User request: ${request}` : "User request: assist with the provided code context.",
    snippets.length ? `Code context:\n${snippets.join("\n\n")}` : "",
    searchContext ? `Search context for "${options.search}":\n${searchContext}` : "",
    "Answer in Indonesian. Be practical, point out risks first for review/test mode, and give clear next steps.",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TOTAL_CHARS);

  if (options.dryRun) {
    console.log(topic);
    return;
  }

  console.log(`[JAGAT code assist] actor=${actor} role=${role} command=${options.command}`);
  console.log("[JAGAT code assist] read-only mode, contacting local JAGAT backend. First run can take several minutes if Ollama is cold...\n");
  const answer = await callJagat(topic);
  console.log(answer);
}

main().catch((error) => {
  console.error(`[JAGAT code assist] ${error.message}`);
  process.exitCode = 1;
});
