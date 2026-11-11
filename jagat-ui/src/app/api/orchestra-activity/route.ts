// ============================================================================
// JAGAT G7 — Colony Activity Feed API
// Membaca log REAL dari PM2 jagat-telegram-bots log file
// Data: aktivitas bot terbaru (pesan masuk, routing intent, prospek, dll)
// ============================================================================

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PM2 log paths
const PM2_HOME = path.join(os.homedir(), ".pm2", "logs");
const BOT_OUT_LOG = path.join(PM2_HOME, "jagat-telegram-bots-out.log");
const BOT_ERR_LOG = path.join(PM2_HOME, "jagat-telegram-bots-error.log");
// Also check jagat-ui err log for colony activity
const UI_ERR_LOG = path.join(process.cwd(), "ui-50012.err.log");

export interface ActivityEvent {
  id: string;
  time: string;
  agent: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

function parseLogLines(logContent: string, source: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const lines = logContent.split(/\r?\n/).filter((l) => l.trim()).slice(-200);

  for (const line of lines) {
    // Skip PM2 prefix noise
    const stripped = line.replace(/^\d+\|[\w-]+\s*\|\s*/, "").trim();
    if (!stripped) continue;

    let agent = "System";
    let type: ActivityEvent["type"] = "info";
    let message = stripped;

    // JAGAT Bot activity patterns
    if (stripped.includes("[JAGAT ROUTER]")) {
      agent = "JAGAT Router";
      type = "info";
      message = stripped.replace(/\[jagat_router\]\s*/, "");
    } else if (stripped.includes("[JAGAT]")) {
      agent = "JAGAT Bot";
      type = "info";
      message = stripped.replace(/\[JAGAT\]\s*/, "");
    } else if (stripped.includes("[TINGS]")) {
      agent = "Tings Analyst";
      type = "info";
      message = stripped.replace(/\[TINGS\]\s*/, "");
    } else if (stripped.includes("[DEBUG JAGAT]") || stripped.includes("[DEBUG TINGS]")) {
      agent = stripped.includes("JAGAT") ? "JAGAT Bot" : "Tings Analyst";
      type = "info";
      message = stripped.replace(/\[DEBUG (JAGAT|TINGS)\]\s*/, "Pesan diterima: ");
    } else if (stripped.includes("God Mode command:")) {
      agent = "JAGAT Router";
      type = "info";
      message = "Perintah diterima: " + stripped.split("God Mode command:")[1]?.trim();
    } else if (stripped.includes("Classified intent:")) {
      agent = "JAGAT Router";
      type = "success";
      message = "Intent: " + stripped.split("Classified intent:")[1]?.trim();
    } else if (stripped.includes("Prospect Miner") || stripped.includes("get-next-prospect")) {
      agent = "Prospect Miner";
      type = "success";
      message = "Mencari prospek dari tracker...";
    } else if (stripped.includes("Telegram Dispatcher") || stripped.includes("telegram-dispatcher") || stripped.includes("Mengirim pesan")) {
      agent = "Telegram Dispatcher";
      type = "success";
      message = stripped;
    } else if (stripped.includes("✅") && stripped.includes("ONLINE")) {
      agent = source === "out" ? "JAGAT Bot" : "System";
      type = "success";
      message = stripped.replace(/✅\s*/, "");
    } else if (stripped.includes("⚠️") || stripped.includes("409 Conflict")) {
      agent = "System";
      type = "warning";
      message = stripped.replace(/⚠️\s*/, "");
      if (message.length > 80) message = message.substring(0, 80) + "...";
    } else if (stripped.includes("❌") || stripped.includes("Error")) {
      agent = "System";
      type = "error";
      message = stripped.replace(/❌\s*/, "");
      if (message.length > 80) message = message.substring(0, 80) + "...";
    } else if (stripped.includes("Starting Dual Telegram Bot")) {
      agent = "System";
      type = "info";
      message = "🤖 Dual Telegram Bot Engine dimulai";
    } else if (stripped.includes("[BFF:RESEARCH]")) {
      agent = "Tings Analyst";
      type = "info";
      message = stripped.replace(/\[BFF:RESEARCH\]\s*/, "");
    } else if (stripped.includes("[TokenRegistry]")) {
      agent = "Auth Layer";
      type = "warning";
      message = stripped.replace(/\[TokenRegistry\]\s*/, "");
      if (message.length > 80) message = message.substring(0, 80) + "...";
    } else {
      // Skip generic noise lines
      if (
        stripped.startsWith("▲") ||
        stripped.startsWith("✓") ||
        stripped.startsWith("- ") ||
        stripped.startsWith("⚠ Warning") ||
        stripped.includes("lockfiles") ||
        stripped.includes("turbopack")
      ) {
        continue;
      }
      agent = "System";
      type = "info";
      if (message.length > 80) message = message.substring(0, 80) + "...";
    }

    events.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toISOString(),
      agent,
      message,
      type,
    });
  }

  return events;
}

export async function GET() {
  const events: ActivityEvent[] = [];

  // Read bot out log
  if (fs.existsSync(BOT_OUT_LOG)) {
    try {
      const content = fs.readFileSync(BOT_OUT_LOG, "utf-8");
      events.push(...parseLogLines(content, "out"));
    } catch { /* skip */ }
  }

  // Read bot error log (for warnings)
  if (fs.existsSync(BOT_ERR_LOG)) {
    try {
      const content = fs.readFileSync(BOT_ERR_LOG, "utf-8");
      events.push(...parseLogLines(content, "err"));
    } catch { /* skip */ }
  }

  // If no real activity, show current bot status
  if (events.length === 0) {
    events.push({
      id: "status-1",
      time: new Date().toISOString(),
      agent: "System",
      message: "Log bot tidak tersedia atau kosong. Bot sedang standby.",
      type: "info",
    });
  }

  // Sort by uniqueness, take last 20 unique meaningful events
  const unique = events
    .filter((e) => e.message.length > 5)
    // Deduplicate by message content (e.g. repeated "ONLINE")
    .reduce((acc: ActivityEvent[], curr) => {
      const last = acc[acc.length - 1];
      if (last && last.message === curr.message && last.agent === curr.agent) return acc;
      acc.push(curr);
      return acc;
    }, [])
    .slice(-20)
    .reverse(); // Most recent first

  return NextResponse.json({ events: unique, fetchedAt: new Date().toISOString() });
}

