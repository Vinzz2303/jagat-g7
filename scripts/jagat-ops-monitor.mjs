#!/usr/bin/env node
import "dotenv/config";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const healthScript = path.join(root, "scripts", "ops-health.mjs");
const stateDir = path.join(process.env.LOCALAPPDATA || os.homedir(), "JAGAT", "ops-monitor");
const statePath = path.join(stateDir, "state.json");
const sendTelegram = process.argv.includes("--telegram");
const heartbeatMs = 6 * 60 * 60 * 1000;
const retryMs = 30 * 60 * 1000;

const health = await readHealth();
const pm2 = await readTelegramProcess();
const dependencies = await readBackendDependencies();
const components = { ...health.components, ...dependencies, "Telegram bot": pm2.status };
const fingerprint = Object.entries(components).map(([name, status]) => `${name}:${status}`).join("|");
const now = Date.now();
const state = await readState();
const changed = state.lastTelegramFingerprint !== fingerprint;
const heartbeatDue = !state.lastTelegramAt || now - state.lastTelegramAt >= heartbeatMs;
const retryAllowed = !state.retryAfter || now >= state.retryAfter;
let telegramSent = false;
const healthy = health.ok && pm2.status === "online" && Object.values(dependencies).every((status) => status === "healthy");

console.log(`JAGAT_OPS_MONITOR=${healthy ? "HEALTHY" : "DEGRADED"}`);
for (const [name, status] of Object.entries(components)) console.log(`${name}=${status}`);

if (sendTelegram && retryAllowed && (changed || heartbeatDue)) {
  try {
    const { sendTelegramText } = await import("../dist/colony/telegram-adapter.js");
    await sendTelegramText(formatTelegram(components, healthy));
    state.lastTelegramFingerprint = fingerprint;
    state.lastTelegramAt = now;
    state.retryAfter = undefined;
    telegramSent = true;
  } catch (error) {
    state.retryAfter = now + retryMs;
    console.error(`TELEGRAM_SEND=FAILED (${safeError(error)})`);
  }
} else if (sendTelegram) {
  console.log("TELEGRAM_SEND=SKIPPED (unchanged or retry cooldown)");
}

state.lastObservedFingerprint = fingerprint;
state.lastObservedAt = now;
await writeState(state);
console.log(`TELEGRAM_SENT=${telegramSent}`);

async function readHealth() {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [healthScript], {
      cwd: root,
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 256 * 1024,
    });
    return parseHealth(`${stdout}\n${stderr}`);
  } catch (error) {
    const output = `${error?.stdout || ""}\n${error?.stderr || ""}`;
    const parsed = parseHealth(output);
    if (Object.keys(parsed.components).length) return parsed;
    return { ok: false, components: { "Health probe": "failed" } };
  }
}

async function readBackendDependencies() {
  try {
    const baseUrl = process.env.JAGAT_BACKEND_URL || "http://127.0.0.1:5000";
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(7000) });
    const body = await response.json();
    const services = body?.services || {};
    return Object.fromEntries(["redis", "qdrant", "ollama"].map((name) => [
      name[0].toUpperCase() + name.slice(1),
      services[name] === "connected" ? "healthy" : services[name] || "unknown",
    ]));
  } catch {
    return { Redis: "unknown", Qdrant: "unknown", Ollama: "unknown" };
  }
}

function parseHealth(output) {
  const components = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*([✅❌])\s+(.+?)\s+—\s+(.+?)(?:\s+\(\d+ms\))?\s*$/u);
    if (match) components[match[2]] = match[1] === "✅" ? "healthy" : normalizeFailure(match[3]);
  }
  const result = output.match(/Result:\s*(PASS|FAIL)\s*\(/);
  return { ok: result?.[1] === "PASS", components };
}

function normalizeFailure(value) {
  if (/status\s+\d+/i.test(value)) return value.match(/status\s+\d+/i)[0].toLowerCase();
  if (/fetch failed/i.test(value)) return "unreachable";
  return "failed";
}

async function readTelegramProcess() {
  try {
    const { stdout } = await execFileAsync("cmd.exe", ["/d", "/s", "/c", "pm2 jlist"], {
      cwd: root,
      timeout: 15_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const apps = JSON.parse(stdout);
    const bot = apps.find((app) => app?.name === "jagat-telegram-bots");
    return { status: bot?.pm2_env?.status === "online" ? "online" : "not_online" };
  } catch {
    return { status: "unknown" };
  }
}

async function readState() {
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(value) {
  await fs.mkdir(stateDir, { recursive: true });
  const tempPath = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, statePath);
}

function formatTelegram(values, healthy) {
  const lines = [
    `<b>JAGAT Local Ops ${healthy ? "HEALTHY" : "DEGRADED"}</b>`,
    ...Object.entries(values).map(([name, status]) => `• ${escapeHtml(name)}: ${escapeHtml(status)}`),
    `Updated: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Jakarta", timeZoneName: "short" })}`,
  ];
  return lines.join("\n").slice(0, 3500);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, " ").slice(0, 180);
}
