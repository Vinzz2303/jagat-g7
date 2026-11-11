// ============================================================================
// JAGAT G7 - Usage Metering MVP
// Server-only module. Tracks daily request usage without storing raw prompts,
// answers, raw tokens, credentials, customer documents, or payment data.
// ============================================================================

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type UsageTier = "GUEST" | "PRO" | "ULTRA" | "SOVEREIGN";
export type UsageAgentMode = "research" | "kiting" | "ting" | "motherbox";
export type UsageStatus = "success" | "refused" | "error";

export interface UsageActor {
  ownerName: string;
  tier: string;
  subject: string;
}

export interface UsageEventInput {
  requestId?: string;
  agentMode: UsageAgentMode;
  endpoint: string;
  contextDocsUsed?: number;
  latencyMs?: number;
  status: UsageStatus;
  refusalReason?: string | null;
}

export interface UsageEventRecord {
  eventId: string;
  requestId: string;
  createdAt: string;
  dayKey: string;
  tokenHash: string;
  ownerName: string;
  tier: UsageTier;
  agentMode: UsageAgentMode;
  endpoint: string;
  unit: "request";
  units: number;
  contextDocsUsed: number;
  latencyMs: number | null;
  status: UsageStatus;
  refusalReason: string | null;
  billingMode: "manual";
  meteringMode: "persistent_file_mvp";
}

export interface UsageSummary {
  ownerName: string;
  tier: UsageTier;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
  billingMode: "manual";
  meteringMode: "persistent_file_mvp";
}

export interface UsageAggregate {
  key: string;
  events: number;
  units: number;
}

export interface UsageLedgerSummary {
  generatedAt: string;
  dayKey: string;
  totalEvents: number;
  totalUnits: number;
  todayEvents: number;
  todayUnits: number;
  byTier: UsageAggregate[];
  byAgentMode: UsageAggregate[];
  recentEvents: UsageEventRecord[];
}

const DAILY_LIMITS: Record<UsageTier, number | null> = {
  GUEST: 5,
  PRO: 50,
  ULTRA: 250,
  SOVEREIGN: null,
};

function ledgerPath(): string {
  return path.join(process.cwd(), "data", "usage_events.jsonl");
}

function normalizeTier(tier: string | undefined): UsageTier {
  if (tier === "PRO" || tier === "ULTRA" || tier === "SOVEREIGN") return tier;
  return "GUEST";
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function localDayKey(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextLocalReset(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function aggregateBy(records: UsageEventRecord[], keyOf: (record: UsageEventRecord) => string): UsageAggregate[] {
  const map = new Map<string, UsageAggregate>();
  for (const record of records) {
    const key = keyOf(record);
    const current = map.get(key) ?? { key, events: 0, units: 0 };
    current.events += 1;
    current.units += record.units;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.units - a.units || b.events - a.events);
}

function eventUnits(tier: UsageTier, status: UsageStatus): number {
  if (tier === "SOVEREIGN") return 0;
  if (status === "error") return 0;
  return 1;
}

function safeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function actorHash(actor: UsageActor): Promise<string> {
  const tier = normalizeTier(actor.tier);
  return sha256(actor.subject || `${tier}:anonymous`);
}

export async function listUsageEvents(limit = 500): Promise<UsageEventRecord[]> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UsageEventRecord)
      .reverse()
      .slice(0, Math.max(1, Math.min(5000, limit)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readAllUsageEvents(): Promise<UsageEventRecord[]> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UsageEventRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function usedToday(actor: UsageActor, now = new Date()): Promise<number> {
  const tier = normalizeTier(actor.tier);
  const tokenHash = await actorHash(actor);
  const dayKey = localDayKey(now);
  const events = await readAllUsageEvents();
  return events
    .filter((event) => event.dayKey === dayKey && event.tier === tier && event.tokenHash === tokenHash)
    .reduce((sum, event) => sum + event.units, 0);
}

export async function getUsageSummary(actor: UsageActor, now = new Date()): Promise<UsageSummary> {
  const tier = normalizeTier(actor.tier);
  const limit = DAILY_LIMITS[tier];
  const used = await usedToday(actor, now);
  return {
    ownerName: cleanText(actor.ownerName || "Guest", 90) || "Guest",
    tier,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetAt: nextLocalReset(now),
    billingMode: "manual",
    meteringMode: "persistent_file_mvp",
  };
}

export async function assertUsageAllowed(actor: UsageActor): Promise<UsageSummary> {
  const summary = await getUsageSummary(actor);
  if (summary.limit !== null && summary.used >= summary.limit) {
    throw Object.assign(new Error("Daily quota exceeded."), { usageSummary: summary });
  }
  return summary;
}

export async function recordUsage(actor: UsageActor, event: UsageEventInput): Promise<UsageSummary> {
  const tier = normalizeTier(actor.tier);
  const now = new Date();
  const record: UsageEventRecord = {
    eventId: `usage_${localDayKey(now).replace(/-/g, "")}_${randomUUID().slice(0, 8)}`,
    requestId: cleanText(event.requestId, 80) || `req_${randomUUID().slice(0, 8)}`,
    createdAt: now.toISOString(),
    dayKey: localDayKey(now),
    tokenHash: await actorHash(actor),
    ownerName: cleanText(actor.ownerName || "Guest", 90) || "Guest",
    tier,
    agentMode: event.agentMode,
    endpoint: cleanText(event.endpoint, 120) || "/research",
    unit: "request",
    units: eventUnits(tier, event.status),
    contextDocsUsed: safeInteger(event.contextDocsUsed, 0, 0, 1000),
    latencyMs:
      typeof event.latencyMs === "number" && Number.isFinite(event.latencyMs)
        ? Math.max(0, Math.round(event.latencyMs))
        : null,
    status: event.status,
    refusalReason: event.refusalReason ? cleanText(event.refusalReason, 180) : null,
    billingMode: "manual",
    meteringMode: "persistent_file_mvp",
  };

  const file = ledgerPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  return getUsageSummary(actor);
}

export async function getUsageLedgerSummary(limit = 20, now = new Date()): Promise<UsageLedgerSummary> {
  const allEvents = await readAllUsageEvents();
  const dayKey = localDayKey(now);
  const today = allEvents.filter((event) => event.dayKey === dayKey);
  const recentEvents = [...allEvents]
    .reverse()
    .slice(0, Math.max(1, Math.min(100, limit)));

  return {
    generatedAt: now.toISOString(),
    dayKey,
    totalEvents: allEvents.length,
    totalUnits: allEvents.reduce((sum, event) => sum + event.units, 0),
    todayEvents: today.length,
    todayUnits: today.reduce((sum, event) => sum + event.units, 0),
    byTier: aggregateBy(today, (event) => event.tier),
    byAgentMode: aggregateBy(today, (event) => event.agentMode),
    recentEvents,
  };
}

export function encodeUsageSummary(summary: UsageSummary): string {
  return encodeURIComponent(JSON.stringify(summary));
}
