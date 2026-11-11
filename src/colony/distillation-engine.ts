import { getRedisClient } from "../services/index.js";
import { emitAudit } from "./audit-engine.js";
import { REDIS_KEYS } from "./types.js";

export type DistillationRecordStatus =
  | "pending_review"
  | "auto_accepted"
  | "needs_founder_review"
  | "accepted"
  | "rejected";

export interface DistillationContextSource {
  title?: string;
  source?: string;
  category?: string;
  score?: number;
  denseScore?: number;
  sparseScore?: number;
  chunkIndex?: number;
  sectionTitle?: string;
  retrievalMode?: string;
  matchedKeywords?: string[];
}

export interface DistillationRecord {
  recordId: string;
  status: DistillationRecordStatus;
  question: string;
  answer: string;
  contextSources: DistillationContextSource[];
  citations: string[];
  tags: string[];
  benchmarkName?: string;
  benchmarkPassed?: boolean;
  score?: number;
  notes?: string;
  screening?: DistillationScreeningAssessment;
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface DistillationScreeningAssessment {
  decision: "auto_accepted" | "needs_founder_review" | "rejected";
  groundingScore: number;
  citationScore: number;
  safetyScore: number;
  usefulnessScore: number;
  overallScore: number;
  reasons: string[];
  screenedAt: string;
  screenedBy: "colony-screening";
}

export interface CreateDistillationRecordParams {
  question: string;
  answer: string;
  contextSources?: DistillationContextSource[];
  citations?: string[];
  tags?: string[];
  benchmarkName?: string;
  benchmarkPassed?: boolean;
  score?: number;
  notes?: string;
  createdBy: string;
}

export interface ListDistillationOptions {
  status?: DistillationRecordStatus;
  limit?: number;
}

export interface DistillationTrainingRecord {
  id: string;
  instruction: string;
  input: string;
  output: string;
  tags: string[];
  metadata: {
    source: "cognitive_distillation";
    recordId: string;
    benchmarkName?: string;
    benchmarkPassed?: boolean;
    score?: number;
    screening?: DistillationScreeningAssessment;
    citations: string[];
    contextSources: DistillationContextSource[];
    reviewedBy?: string;
    reviewNote?: string;
    createdAt: string;
    reviewedAt?: string;
  };
}

const MAX_LIST_LIMIT = 100;
const FINAL_STATUSES = new Set<DistillationRecordStatus>(["auto_accepted", "accepted", "rejected"]);
/** Statuses that block founder re-review. auto_accepted is intentionally excluded
 *  because founder should always be able to override Colony auto-screening. */
const MANUALLY_REVIEWED_STATUSES = new Set<DistillationRecordStatus>(["accepted", "rejected"]);

async function nextDistillationId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.distillationSequence());
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DISTILL-${day}-${String(seq).padStart(4, "0")}`;
}

function normalizeText(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function normalizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function hasPromptLeak(text: string): boolean {
  return /DIREKTIF RISET|Threshold Kemiripan|Mode Sumber|system prompt|developer message|instruksi internal/i.test(text);
}

function hasHighRiskTrainingSignal(record: DistillationRecord): boolean {
  const haystack = [record.question, record.answer, record.tags.join(" "), record.notes ?? ""].join(" ").toLowerCase();
  return /\b(secret|token|api key|credential|password|exploit|serangan|attack|malware|phishing|bypass|deploy|billing)\b/i.test(haystack);
}

function citationMatchesContext(citation: string, sources: DistillationContextSource[]): boolean {
  const normalizedCitation = citation.toLowerCase().trim();
  return sources.some((source) => {
    const values = [source.source, source.title].filter(Boolean).map((value) => String(value).toLowerCase());
    return values.some((value) => value.includes(normalizedCitation) || normalizedCitation.includes(value));
  });
}

export function assessDistillationRecord(record: DistillationRecord): DistillationScreeningAssessment {
  const reasons: string[] = [];

  const groundingScore = clampScore(record.contextSources.length > 0 ? Math.min(1, record.contextSources.length / 2) : 0.2);
  if (record.contextSources.length === 0) reasons.push("no_context_sources");

  const citationsValid = record.citations.length === 0
    ? record.contextSources.length === 0
    : record.citations.every((citation) => citationMatchesContext(citation, record.contextSources));
  const citationScore = clampScore(
    record.citations.length > 0 && citationsValid
      ? 1
      : record.contextSources.length === 0 && record.citations.length === 0
        ? 0.65
        : 0.25,
  );
  if (!citationsValid) reasons.push("citation_not_backed_by_context");
  if (record.contextSources.length > 0 && record.citations.length === 0) reasons.push("missing_citations");

  const leak = hasPromptLeak(record.answer) || hasPromptLeak(record.question);
  const highRisk = hasHighRiskTrainingSignal(record);
  const safetyScore = clampScore(leak ? 0 : highRisk ? 0.55 : 1);
  if (leak) reasons.push("internal_prompt_leak");
  if (highRisk) reasons.push("high_risk_training_signal");

  const substantive = record.answer.trim().length >= 120;
  const benchmarkHealthy = record.benchmarkPassed !== false;
  const usefulnessScore = clampScore((substantive ? 0.6 : 0.2) + (benchmarkHealthy ? 0.25 : 0) + (record.tags.length > 0 ? 0.15 : 0));
  if (!substantive) reasons.push("answer_too_short");
  if (!benchmarkHealthy) reasons.push("benchmark_failed");

  const overallScore = clampScore(
    (groundingScore * 0.3) +
    (citationScore * 0.25) +
    (safetyScore * 0.25) +
    (usefulnessScore * 0.2),
  );

  const decision: DistillationScreeningAssessment["decision"] = leak || overallScore < 0.55
    ? "rejected"
    : highRisk || overallScore < 0.82
      ? "needs_founder_review"
      : "auto_accepted";

  if (decision === "auto_accepted") reasons.push("all_screening_scores_passed");

  return {
    decision,
    groundingScore,
    citationScore,
    safetyScore,
    usefulnessScore,
    overallScore,
    reasons,
    screenedAt: new Date().toISOString(),
    screenedBy: "colony-screening",
  };
}

export async function createDistillationRecord(params: CreateDistillationRecordParams): Promise<DistillationRecord> {
  const redis = getRedisClient();
  const recordId = await nextDistillationId();
  const now = new Date().toISOString();

  const record: DistillationRecord = {
    recordId,
    status: "pending_review",
    question: normalizeText(params.question, "question"),
    answer: normalizeText(params.answer, "answer"),
    contextSources: Array.isArray(params.contextSources) ? params.contextSources : [],
    citations: Array.isArray(params.citations) ? [...new Set(params.citations.map(String).map((c) => c.trim()).filter(Boolean))] : [],
    tags: normalizeTags(params.tags),
    benchmarkName: params.benchmarkName,
    benchmarkPassed: params.benchmarkPassed,
    score: typeof params.score === "number" ? params.score : undefined,
    notes: params.notes,
    createdAt: now,
    createdBy: normalizeText(params.createdBy, "createdBy"),
  };

  await redis.set(REDIS_KEYS.distillationRecord(recordId), JSON.stringify(record));
  await redis.zadd(REDIS_KEYS.distillationIndex(), Date.now(), recordId);
  await redis.sadd(REDIS_KEYS.distillationByStatus(record.status), recordId);

  await emitAudit({
    actor: record.createdBy,
    actorRole: "founder",
    action: "distillation.capture",
    resource: `distillation:${recordId}`,
    detail: {
      benchmarkName: record.benchmarkName,
      benchmarkPassed: record.benchmarkPassed,
      citations: record.citations.length,
      contextSources: record.contextSources.length,
      tags: record.tags,
    },
  });

  return record;
}

export async function getDistillationRecord(recordId: string): Promise<DistillationRecord | null> {
  const redis = getRedisClient();
  const raw = await redis.get(REDIS_KEYS.distillationRecord(recordId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DistillationRecord;
  } catch {
    console.warn(`[Colony:DistillationEngine] Corrupted record in Redis for ${recordId}, skipping`);
    return null;
  }
}

export async function listDistillationRecords(options: ListDistillationOptions = {}): Promise<DistillationRecord[]> {
  const redis = getRedisClient();
  const limit = Math.max(1, Math.min(options.limit ?? 50, MAX_LIST_LIMIT));
  const ids = options.status
    ? await redis.smembers(REDIS_KEYS.distillationByStatus(options.status))
    : await redis.zrevrange(REDIS_KEYS.distillationIndex(), 0, limit - 1);

  const records: DistillationRecord[] = [];
  for (const id of ids) {
    const record = await getDistillationRecord(id);
    if (record) records.push(record);
  }

  return records
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function reviewDistillationRecord(
  recordId: string,
  status: "accepted" | "rejected",
  reviewedBy: string,
  reviewNote?: string,
): Promise<DistillationRecord> {
  const redis = getRedisClient();
  const record = await getDistillationRecord(recordId);
  if (!record) throw new Error(`Distillation record ${recordId} not found`);
  if (MANUALLY_REVIEWED_STATUSES.has(record.status)) {
    throw new Error(`Distillation record ${recordId} already ${record.status}`);
  }

  await redis.srem(REDIS_KEYS.distillationByStatus(record.status), recordId);

  record.status = status;
  record.reviewedAt = new Date().toISOString();
  record.reviewedBy = normalizeText(reviewedBy, "reviewedBy");
  record.reviewNote = reviewNote;

  await redis.set(REDIS_KEYS.distillationRecord(recordId), JSON.stringify(record));
  await redis.sadd(REDIS_KEYS.distillationByStatus(record.status), recordId);

  await emitAudit({
    actor: record.reviewedBy,
    actorRole: "founder",
    action: "distillation.review",
    resource: `distillation:${recordId}`,
    detail: { status, reviewNote },
  });

  return record;
}

export async function screenDistillationRecord(recordId: string): Promise<DistillationRecord> {
  const redis = getRedisClient();
  const record = await getDistillationRecord(recordId);
  if (!record) throw new Error(`Distillation record ${recordId} not found`);
  if (FINAL_STATUSES.has(record.status)) throw new Error(`Distillation record ${recordId} already ${record.status}`);

  await redis.srem(REDIS_KEYS.distillationByStatus(record.status), recordId);

  const screening = assessDistillationRecord(record);
  record.screening = screening;
  record.status = screening.decision;

  await redis.set(REDIS_KEYS.distillationRecord(recordId), JSON.stringify(record));
  await redis.sadd(REDIS_KEYS.distillationByStatus(record.status), recordId);

  await emitAudit({
    actor: "colony-screening",
    actorRole: "reviewer",
    action: "distillation.screen",
    resource: `distillation:${recordId}`,
    detail: {
      decision: screening.decision,
      overallScore: screening.overallScore,
      reasons: screening.reasons,
    },
  });

  return record;
}

export async function exportDistillationTrainingData(options: {
  status?: DistillationRecordStatus;
  tags?: string[];
} = {}): Promise<{ records: DistillationTrainingRecord[]; stats: {
  totalRecords: number;
  acceptedRecords: number;
  uniqueTags: string[];
} }> {
  let sourceRecords = options.status
    ? await listDistillationRecords({ status: options.status, limit: MAX_LIST_LIMIT })
    : [
        ...await listDistillationRecords({ status: "accepted", limit: MAX_LIST_LIMIT }),
        ...await listDistillationRecords({ status: "auto_accepted", limit: MAX_LIST_LIMIT }),
      ];

  if (options.tags && options.tags.length > 0) {
    const wanted = new Set(options.tags.map((tag) => tag.toLowerCase()));
    sourceRecords = sourceRecords.filter((record) =>
      record.tags.some((tag) => wanted.has(tag.toLowerCase())),
    );
  }

  const records = sourceRecords.map((record): DistillationTrainingRecord => ({
    id: record.recordId,
    instruction: record.question,
    input: JSON.stringify({
      contextSources: record.contextSources,
      citations: record.citations,
      benchmarkName: record.benchmarkName,
      benchmarkPassed: record.benchmarkPassed,
      score: record.score,
    }),
    output: record.answer,
    tags: record.tags,
    metadata: {
      source: "cognitive_distillation",
      recordId: record.recordId,
      benchmarkName: record.benchmarkName,
      benchmarkPassed: record.benchmarkPassed,
      score: record.score,
      screening: record.screening,
      citations: record.citations,
      contextSources: record.contextSources,
      reviewedBy: record.reviewedBy,
      reviewNote: record.reviewNote,
      createdAt: record.createdAt,
      reviewedAt: record.reviewedAt,
    },
  }));

  await emitAudit({
    actor: "system",
    actorRole: "system",
    action: "distillation.export",
    resource: "distillation:export",
    detail: {
      status: options.status ?? "accepted_or_auto_accepted",
      tags: options.tags,
      recordCount: records.length,
    },
  });

  return {
    records,
    stats: {
      totalRecords: sourceRecords.length,
      acceptedRecords: sourceRecords.filter((record) => record.status === "accepted" || record.status === "auto_accepted").length,
      uniqueTags: [...new Set(records.flatMap((record) => record.tags))],
    },
  };
}
