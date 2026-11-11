// ============================================================================
// JAGAT Colony — Memory Reader
// Thin read-only adapter bridging colony agents to JAGAT sovereign memory.
// Uses existing Qdrant + Ollama services — zero duplication.
//
// This module provides colony agents access to ingested blueprints,
// roadmaps, and milestones for context-aware task/mission creation.
// ============================================================================

import { qdrantService } from "../services/qdrant.js";
import { ollamaService } from "../services/ollama.js";
import { selectContextWithinBudget } from "../services/context-budget-manager.js";

// ── Constants ───────────────────────────────────────────────────────────────

const KNOWLEDGE_COLLECTION = "jagat_indonesia_knowledge";
const EMBEDDING_MODEL = "nomic-embed-text";

/** Default categories relevant to colony planning */
const DEFAULT_COLONY_CATEGORIES = ["blueprint", "roadmap", "milestone"];

/** Score threshold for colony context (slightly lower than research to catch more planning docs) */
const COLONY_SCORE_THRESHOLD = 0.50;

/** Max fragments returned per query */
const DEFAULT_LIMIT = 5;

/** Default character budget for colony planning context */
const DEFAULT_CONTEXT_CHAR_BUDGET = 2_800;

// ── Types ───────────────────────────────────────────────────────────────────

export interface MemoryFragment {
  content: string;
  source: string;
  title: string;
  category: string;
  score: number;
  docType: string;
  trustLevel: string;
  createdAt?: string;
  chunkIndex?: number;
  sectionTitle?: string;
}

export interface MemoryContext {
  query: string;
  fragments: MemoryFragment[];
  totalFound: number;
  searchMs: number;
  embeddingMs: number;
  categories: string[];
  contextBudget?: {
    inputCount: number;
    selectedCount: number;
    rejectedCount: number;
    usedChars: number;
    maxChars: number;
    maxFragments: number;
  };
}

export interface MemoryQueryOptions {
  /** Filter by document categories. Default: ["blueprint", "roadmap", "milestone"] */
  categories?: string[];
  /** Max number of fragments to return. Default: 5 */
  limit?: number;
  /** Minimum cosine similarity score. Default: 0.50 */
  scoreThreshold?: number;
  /** Maximum total characters allowed for selected context. Default: 2800 */
  maxContextChars?: number;
}

// ── Memory Reader ───────────────────────────────────────────────────────────

/**
 * Query JAGAT sovereign memory for context relevant to colony planning.
 *
 * Flow:
 * 1. Embed the query text using Ollama nomic-embed-text
 * 2. Search Qdrant collection with category filter
 * 3. Return structured fragments with metadata
 *
 * Graceful degradation: returns empty result if Ollama or Qdrant is down.
 */
export async function queryColonyContext(
  query: string,
  options?: MemoryQueryOptions,
): Promise<MemoryContext> {
  const categories = options?.categories ?? DEFAULT_COLONY_CATEGORIES;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const scoreThreshold = options?.scoreThreshold ?? COLONY_SCORE_THRESHOLD;
  const maxContextChars = options?.maxContextChars ?? DEFAULT_CONTEXT_CHAR_BUDGET;

  const result: MemoryContext = {
    query,
    fragments: [],
    totalFound: 0,
    searchMs: 0,
    embeddingMs: 0,
    categories,
  };

  // Guard: skip empty/whitespace queries to avoid wasting Ollama + Qdrant resources
  if (!query || query.trim().length === 0) {
    console.warn("[Colony:Memory] Empty query — returning no results.");
    return result;
  }

  try {
    // Step 1: Generate embedding
    const embStart = performance.now();
    const queryVector = await ollamaService.generateEmbedding(query, EMBEDDING_MODEL);
    result.embeddingMs = Math.round(performance.now() - embStart);

    // Step 2: Build Qdrant filter for categories
    const filter = categories.length > 0
      ? {
          must: [
            categories.length === 1
              ? { key: "category", match: { value: categories[0] } }
              : { key: "category", match: { any: categories } },
          ],
        }
      : undefined;

    // Step 3: Search Qdrant
    const searchStart = performance.now();
    const results = await qdrantService.searchVectors(
      KNOWLEDGE_COLLECTION,
      queryVector,
      Math.max(limit * 4, 12), // fetch wider, select by budget + priority client-side
      scoreThreshold,
      filter,
    );
    result.searchMs = Math.round(performance.now() - searchStart);

    // Step 4: Map results to MemoryFragment
    const fragments: MemoryFragment[] = [];
    for (const r of results) {
      if (!r.payload) continue;
      if (r.score < scoreThreshold) continue;

      fragments.push({
        content: truncateContent(String(r.payload["content"] ?? ""), 500),
        source: String(r.payload["source"] ?? "unknown"),
        title: String(r.payload["title"] ?? "Untitled"),
        category: String(r.payload["category"] ?? "unknown"),
        score: r.score,
        docType: String(r.payload["doc_type"] ?? "unknown"),
        trustLevel: String(r.payload["trust_level"] ?? "unknown"),
        createdAt: r.payload["created_at"] ? String(r.payload["created_at"]) : undefined,
        chunkIndex: typeof r.payload["chunk_index"] === "number" ? r.payload["chunk_index"] : undefined,
        sectionTitle: r.payload["section_title"] ? String(r.payload["section_title"]) : undefined,
      });
    }

    const budgetSelection = selectContextWithinBudget(fragments, {
      maxFragments: limit,
      maxChars: maxContextChars,
      minScore: scoreThreshold,
    });

    result.fragments = budgetSelection.selected;
    result.totalFound = fragments.length;
    result.contextBudget = budgetSelection.stats;

    console.log(
      `[Colony:Memory] Query "${query}" → ${result.fragments.length} fragments ` +
      `(categories: ${categories.join(",")}, budget: ${budgetSelection.stats.usedChars}/${maxContextChars} chars, ` +
      `embedding: ${result.embeddingMs}ms, search: ${result.searchMs}ms)`,
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Graceful degradation — colony continues without context
    if (
      message.includes("Not found") ||
      message.includes("404") ||
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("timeout")
    ) {
      console.warn(
        `[Colony:Memory] Context retrieval failed (graceful): ${message}`,
      );
      return result;
    }

    console.error(`[Colony:Memory] Unexpected error: ${message}`);
    return result;
  }
}

/**
 * Format memory context as a readable chat message.
 */
export function formatContextForChat(ctx: MemoryContext): string {
  if (ctx.fragments.length === 0) {
    return [
      `🔍 **Memory Query:** "${ctx.query}"`,
      `📂 Categories: ${ctx.categories.join(", ")}`,
      ``,
      `❌ Tidak ditemukan dokumen yang relevan di memori berdaulat.`,
      `Pastikan Ollama dan Qdrant berjalan, serta dokumen sudah di-ingest.`,
    ].join("\n");
  }

  const budgetLine = ctx.contextBudget
    ? `Budget: ${ctx.contextBudget.usedChars}/${ctx.contextBudget.maxChars} chars | Rejected: ${ctx.contextBudget.rejectedCount}`
    : "";

  const lines = [
    `🔍 **Memory Query:** "${ctx.query}"`,
    `📂 Categories: ${ctx.categories.join(", ")} | ${ctx.fragments.length}/${ctx.totalFound} fragments`,
    `⏱️ Embedding: ${ctx.embeddingMs}ms | Search: ${ctx.searchMs}ms`,
    ``,
  ];

  if (budgetLine) {
    lines.splice(2, 0, budgetLine);
  }

  for (let i = 0; i < ctx.fragments.length; i++) {
    const f = ctx.fragments[i];
    if (!f) continue;
    const scorePercent = (f.score * 100).toFixed(1);
    lines.push(
      `**[${i + 1}] ${f.title}** (${scorePercent}%)`,
      `📄 ${f.source} | ${f.category} | ${f.trustLevel}${f.sectionTitle ? ` | §${f.sectionTitle}` : ""}`,
      `> ${f.content}`,
      ``,
    );
  }

  return lines.join("\n");
}

/**
 * Extract lightweight context references for task enrichment.
 */
export function extractContextReferences(
  ctx: MemoryContext,
): Array<{ title: string; source: string; category: string; score: number }> {
  return ctx.fragments.map((f) => ({
    title: f.title,
    source: f.source,
    category: f.category,
    score: Math.round(f.score * 1000) / 1000,
  }));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
}
