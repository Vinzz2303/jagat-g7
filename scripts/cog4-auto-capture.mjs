import { extractSourceCitations } from "./cognitive-verifier.mjs";

const DEFAULT_BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const DEFAULT_SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const DEFAULT_FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";

function authHeaders(options = {}) {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": options.secret ?? DEFAULT_SECRET,
    "X-Colony-Caller": options.founder ?? DEFAULT_FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": options.token ?? "cog4-auto-capture",
  };
}

async function colonyRequest(method, path, body, options = {}) {
  const response = await fetch(`${options.backend ?? DEFAULT_BACKEND}/colony${path}`, {
    method,
    headers: authHeaders(options),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`Colony ${method} ${path} failed: HTTP ${response.status} ${text}`);
  }
  return data;
}

function normalizeContextSources(contextSources = []) {
  if (!Array.isArray(contextSources)) return [];
  return contextSources.map((source) => ({
    title: source.title,
    source: source.source,
    category: source.category,
    score: source.score,
    denseScore: source.denseScore,
    sparseScore: source.sparseScore,
    chunkIndex: source.chunkIndex,
    sectionTitle: source.sectionTitle,
    retrievalMode: source.retrievalMode,
    matchedKeywords: source.matchedKeywords,
  }));
}

export function shouldAutoCaptureCandidate(candidate) {
  const answer = String(candidate.answer ?? "").trim();
  const question = String(candidate.question ?? "").trim();
  if (question.length < 12 || answer.length < 120) return false;
  if (candidate.benchmarkPassed === false) return false;
  if (/system prompt|developer message|DIREKTIF RISET|Threshold Kemiripan/i.test(answer)) return false;
  return true;
}

export async function captureAndScreenDistillationCandidate(candidate, options = {}) {
  if (!shouldAutoCaptureCandidate(candidate)) {
    return { skipped: true, reason: "candidate_not_capture_worthy" };
  }

  const contextSources = normalizeContextSources(candidate.contextSources ?? candidate.meta?.contextSources ?? []);
  const citations = Array.isArray(candidate.citations)
    ? candidate.citations
    : extractSourceCitations(candidate.answer ?? "");

  const created = await colonyRequest("POST", "/distillation/records", {
    question: candidate.question,
    answer: candidate.answer,
    contextSources,
    citations,
    tags: [...new Set(["cog4", "auto-capture", ...(candidate.tags ?? [])])],
    benchmarkName: candidate.benchmarkName ?? "cog4-auto-capture",
    benchmarkPassed: candidate.benchmarkPassed ?? true,
    score: candidate.score,
    notes: candidate.notes ?? "Captured automatically from benchmark/research output.",
  }, options);

  const recordId = created.record?.recordId;
  if (!recordId) throw new Error("Distillation record created without recordId");

  const screened = await colonyRequest("POST", `/distillation/records/${recordId}/screen`, undefined, options);
  return {
    skipped: false,
    record: screened.record,
    screening: screened.screening,
  };
}
