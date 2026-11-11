// ============================================================================
// JAGAT Context Budget Manager
// Shared selector for prompt context candidates across Colony and research flows.
// ============================================================================

export interface ContextBudgetCandidate {
  content: string;
  source: string;
  score: number;
  title?: string;
  category?: string;
  docType?: string;
  trustLevel?: string;
  createdAt?: string;
  chunkIndex?: number;
  sectionTitle?: string;
  matchedKeywords?: string[];
}

export type ContextBudgetRejectReason =
  | "score_below_min"
  | "duplicate_source_chunk"
  | "budget_exhausted";

export interface ContextBudgetOptions {
  maxFragments: number;
  maxChars: number;
  minScore?: number;
  now?: Date;
  sourcePriority?: Record<string, number>;
  categoryPriority?: Record<string, number>;
  trustPriority?: Record<string, number>;
}

export interface ContextBudgetRejected<T extends ContextBudgetCandidate> {
  item: T;
  reason: ContextBudgetRejectReason;
  finalScore: number;
  estimatedChars: number;
}

export interface ContextBudgetSelection<T extends ContextBudgetCandidate> {
  selected: T[];
  rejected: Array<ContextBudgetRejected<T>>;
  stats: {
    inputCount: number;
    selectedCount: number;
    rejectedCount: number;
    usedChars: number;
    maxChars: number;
    maxFragments: number;
  };
}

const DEFAULT_CATEGORY_PRIORITY: Record<string, number> = {
  founder_note: 0.16,
  decision: 0.15,
  risk: 0.14,
  blueprint: 0.13,
  roadmap: 0.12,
  milestone: 0.09,
  infrastructure: 0.08,
  product: 0.07,
  commercial: 0.05,
  regulation: 0.04,
};

const DEFAULT_TRUST_PRIORITY: Record<string, number> = {
  founder_verified: 0.18,
  core_team_verified: 0.14,
  internal_draft: 0.05,
  external_reference: 0.02,
  high: 0.1,
  medium: 0.05,
  low: 0.01,
  unknown: 0,
};

const DEFAULT_SOURCE_PRIORITY_PATTERNS: Array<[RegExp, number]> = [
  [/decision[_-]?log/i, 0.16],
  [/risk[_-]?register/i, 0.15],
  [/execution[_-]?masterplan/i, 0.14],
  [/jagat[_-]?colony[_-]?masterplan/i, 0.13],
  [/technical[_-]?backlog/i, 0.12],
  [/product[_-]?backlog/i, 0.1],
  [/srs[_-]?v1/i, 0.09],
  [/prd[_-]?v1/i, 0.09],
  [/sdd[_-]?v1/i, 0.08],
  [/fsd[_-]?v1/i, 0.08],
  [/agent[_-]?boundary/i, 0.08],
];

interface RankedCandidate<T extends ContextBudgetCandidate> {
  item: T;
  index: number;
  finalScore: number;
  estimatedChars: number;
  duplicateKey: string;
}

export function estimateContextChars(content: string): number {
  return content.trim().length;
}

export function scoreContextCandidate(
  item: ContextBudgetCandidate,
  options: Pick<ContextBudgetOptions, "now" | "sourcePriority" | "categoryPriority" | "trustPriority"> = {},
): number {
  const baseScore = clampScore(item.score) * 0.7;
  const trustScore = lookupPriority(
    item.trustLevel,
    options.trustPriority ?? DEFAULT_TRUST_PRIORITY,
  );
  const categoryScore = lookupPriority(
    item.category,
    options.categoryPriority ?? DEFAULT_CATEGORY_PRIORITY,
  );
  const sourceScore = sourcePriorityScore(item, options.sourcePriority);
  const recencyScore = scoreRecency(item.createdAt, options.now ?? new Date());
  const keywordScore = Math.min((item.matchedKeywords?.length ?? 0) * 0.01, 0.05);

  return roundScore(baseScore + trustScore + categoryScore + sourceScore + recencyScore + keywordScore);
}

export function selectContextWithinBudget<T extends ContextBudgetCandidate>(
  items: T[],
  options: ContextBudgetOptions,
): ContextBudgetSelection<T> {
  const maxFragments = Math.max(0, Math.floor(options.maxFragments));
  const maxChars = Math.max(0, Math.floor(options.maxChars));
  const minScore = options.minScore ?? 0;

  const ranked: Array<RankedCandidate<T>> = items.map((item, index) => ({
    item,
    index,
    finalScore: scoreContextCandidate(item, options),
    estimatedChars: estimateContextChars(item.content),
    duplicateKey: buildDuplicateKey(item),
  }));

  ranked.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.item.score !== a.item.score) return b.item.score - a.item.score;
    return a.index - b.index;
  });

  const selected: T[] = [];
  const rejected: Array<ContextBudgetRejected<T>> = [];
  const seenDuplicateKeys = new Set<string>();
  let usedChars = 0;

  for (const candidate of ranked) {
    if (candidate.item.score < minScore) {
      rejected.push(toRejected(candidate, "score_below_min"));
      continue;
    }

    if (candidate.duplicateKey && seenDuplicateKeys.has(candidate.duplicateKey)) {
      rejected.push(toRejected(candidate, "duplicate_source_chunk"));
      continue;
    }

    const wouldExceedFragmentLimit = selected.length >= maxFragments;
    const wouldExceedCharLimit = usedChars + candidate.estimatedChars > maxChars;
    if (wouldExceedFragmentLimit || wouldExceedCharLimit) {
      rejected.push(toRejected(candidate, "budget_exhausted"));
      continue;
    }

    selected.push(candidate.item);
    usedChars += candidate.estimatedChars;
    if (candidate.duplicateKey) {
      seenDuplicateKeys.add(candidate.duplicateKey);
    }
  }

  return {
    selected,
    rejected,
    stats: {
      inputCount: items.length,
      selectedCount: selected.length,
      rejectedCount: rejected.length,
      usedChars,
      maxChars,
      maxFragments,
    },
  };
}

function toRejected<T extends ContextBudgetCandidate>(
  candidate: RankedCandidate<T>,
  reason: ContextBudgetRejectReason,
): ContextBudgetRejected<T> {
  return {
    item: candidate.item,
    reason,
    finalScore: candidate.finalScore,
    estimatedChars: candidate.estimatedChars,
  };
}

function sourcePriorityScore(
  item: ContextBudgetCandidate,
  sourcePriority?: Record<string, number>,
): number {
  const haystack = `${item.source} ${item.title ?? ""}`.toLowerCase();
  if (sourcePriority) {
    let best = 0;
    for (const [key, value] of Object.entries(sourcePriority)) {
      if (haystack.includes(key.toLowerCase())) {
        best = Math.max(best, safePriority(value));
      }
    }
    return best;
  }

  let best = 0;
  for (const [pattern, value] of DEFAULT_SOURCE_PRIORITY_PATTERNS) {
    if (pattern.test(haystack)) {
      best = Math.max(best, value);
    }
  }
  return best;
}

function scoreRecency(createdAt: string | undefined, now: Date): number {
  if (!createdAt) return 0;

  const parsed = new Date(`${createdAt.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return 0;

  const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
  if (days < 0) return 0;
  if (days <= 14) return 0.08;
  if (days <= 60) return 0.06;
  if (days <= 180) return 0.04;
  if (days <= 365) return 0.02;
  return 0;
}

function lookupPriority(value: string | undefined, priorities: Record<string, number>): number {
  if (!value) return 0;
  return safePriority(priorities[value.toLowerCase()] ?? 0);
}

function safePriority(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 0.25)) : 0;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(score, 1));
}

function roundScore(score: number): number {
  return Math.round(score * 10_000) / 10_000;
}

function buildDuplicateKey(item: ContextBudgetCandidate): string {
  const source = normalizeKey(item.source);
  if (!source) return "";

  if (typeof item.chunkIndex === "number") {
    return `${source}#chunk:${item.chunkIndex}`;
  }

  const section = normalizeKey(item.sectionTitle ?? item.title ?? "");
  return section ? `${source}#section:${section}` : "";
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
