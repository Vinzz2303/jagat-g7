// ============================================================================
// JAGAT G7 — Colony Stats API
// Membaca data REAL dari PROSPECT_TRACKER.csv
// Data: jumlah leads, berapa yang sudah dikirim, niche breakdown
// ============================================================================

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
// No caching — data harus fresh setiap request
export const dynamic = "force-dynamic";

const TRACKER_PATH = path.join(process.cwd(), "..", "ops", "revenue", "PROSPECT_TRACKER.csv");

interface ProspectStats {
  totalLeads: number;
  sentLeads: number;
  newLeads: number;
  respondedLeads: number;
  nicheBreakdown: Record<string, number>;
  lastUpdated: string;
}

function parseCSV(raw: string): ProspectStats {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return {
      totalLeads: 0,
      sentLeads: 0,
      newLeads: 0,
      respondedLeads: 0,
      nicheBreakdown: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const statusIdx = headers.indexOf("status");
  const nicheIdx = headers.indexOf("niche");

  let totalLeads = 0;
  let sentLeads = 0;
  let newLeads = 0;
  let respondedLeads = 0;
  const nicheBreakdown: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());

    totalLeads++;
    const status = cells[statusIdx] || "";
    const niche = cells[nicheIdx] || "unknown";

    if (status.includes("sent") || status === "wa_sent" || status === "tele_sent") {
      sentLeads++;
    } else if (status === "new" || status === "demo_ready") {
      newLeads++;
    } else if (status === "responded" || status === "interested" || status === "closed") {
      respondedLeads++;
    }

    nicheBreakdown[niche] = (nicheBreakdown[niche] || 0) + 1;
  }

  return {
    totalLeads,
    sentLeads,
    newLeads,
    respondedLeads,
    nicheBreakdown,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    if (!fs.existsSync(TRACKER_PATH)) {
      return NextResponse.json(
        { error: "PROSPECT_TRACKER.csv tidak ditemukan." },
        { status: 404 },
      );
    }

    const raw = fs.readFileSync(TRACKER_PATH, "utf-8");
    const stats = parseCSV(raw);

    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Colony/Stats] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
