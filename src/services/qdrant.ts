// ============================================================================
// JAGAT AI — Qdrant Vector Memory Client
// Pure native fetch implementation (Node 22, zero external deps)
// ============================================================================

import { env } from "../config/index.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string | number;
  version: number;
  score: number;
  payload: Record<string, unknown> | null;
  vector: number[] | null;
}

export type QdrantFilter = Record<string, unknown>;

export interface QdrantScrollPoint {
  id: string | number;
  payload: Record<string, unknown> | null;
  vector: number[] | null;
}

interface QdrantErrorResponse {
  status?: { error?: string };
  message?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class QdrantService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl?: string, timeoutMs: number = 15_000) {
    this.baseUrl = (baseUrl ?? env.QDRANT_HOST).replace(/\/+$/, "");
    this.timeout = timeoutMs;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const data = (await response.json()) as T & QdrantErrorResponse;

    if (!response.ok) {
      const detail =
        data?.status?.error ?? data?.message ?? response.statusText;
      throw new Error(
        `[JAGAT:QDRANT] ${method} ${path} failed (${response.status}): ${detail}`,
      );
    }

    return data;
  }

  // ── Collection Management ────────────────────────────────────────────────

  /**
   * Create a vector collection with Cosine distance metric.
   * Idempotent — silently succeeds if the collection already exists.
   */
  async createCollection(
    collectionName: string,
    vectorSize: number,
  ): Promise<void> {
    // Check if collection already exists
    try {
      await this.request("GET", `/collections/${collectionName}`);
      console.log(
        `[JAGAT:QDRANT] Collection "${collectionName}" already exists — skipping creation.`,
      );
      return;
    } catch {
      // Collection doesn't exist — proceed with creation
    }

    await this.request("PUT", `/collections/${collectionName}`, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });

    console.log(
      `[JAGAT:QDRANT] Collection "${collectionName}" created (dim=${vectorSize}, distance=Cosine).`,
    );
  }

  /**
   * Delete a collection. Throws if it does not exist.
   */
  async deleteCollection(collectionName: string): Promise<void> {
    await this.request("DELETE", `/collections/${collectionName}`);
    console.log(`[JAGAT:QDRANT] Collection "${collectionName}" deleted.`);
  }

  /**
   * List all collection names.
   */
  async listCollections(): Promise<string[]> {
    const data = await this.request<{
      result: { collections: Array<{ name: string }> };
    }>("GET", "/collections");
    return data.result.collections.map((c) => c.name);
  }

  // ── Point Operations ─────────────────────────────────────────────────────

  /**
   * Upsert (insert or update) vector points into a collection.
   * Handles batch sizing internally for large payloads.
   */
  async upsertPoints(
    collectionName: string,
    points: QdrantPoint[],
  ): Promise<void> {
    if (points.length === 0) return;

    const BATCH_SIZE = 100;

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);

      await this.request(
        "PUT",
        `/collections/${collectionName}/points`,
        { points: batch },
      );
    }

    console.log(
      `[JAGAT:QDRANT] Upserted ${points.length} point(s) into "${collectionName}".`,
    );
  }

  // ── Vector Search ─────────────────────────────────────────────────────────

  /**
   * Perform semantic similarity search against a collection.
   * Returns top-K results ranked by Cosine similarity score.
   */
  async searchVectors(
    collectionName: string,
    vector: number[],
    limit: number = 5,
    scoreThreshold?: number,
    filter?: QdrantFilter,
  ): Promise<QdrantSearchResult[]> {
    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (scoreThreshold !== undefined) {
      body.score_threshold = scoreThreshold;
    }

    if (filter !== undefined) {
      body.filter = filter;
    }

    const data = await this.request<{ result: QdrantSearchResult[] }>(
      "POST",
      `/collections/${collectionName}/points/search`,
      body,
    );

    return data.result;
  }

  /**
   * Scroll points by payload filter. Used by hybrid search for sparse keyword
   * reranking over the sovereign memory payloads.
   */
  async scrollPoints(
    collectionName: string,
    limit: number = 100,
    filter?: QdrantFilter,
  ): Promise<QdrantScrollPoint[]> {
    const body: Record<string, unknown> = {
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (filter !== undefined) {
      body.filter = filter;
    }

    const data = await this.request<{ result: { points: QdrantScrollPoint[] } }>(
      "POST",
      `/collections/${collectionName}/points/scroll`,
      body,
    );

    return data.result.points;
  }

  // ── Health ────────────────────────────────────────────────────────────────

  /**
   * Quick connectivity check.
   */
  async ping(): Promise<boolean> {
    try {
      await this.request("GET", "/healthz");
      return true;
    } catch {
      return false;
    }
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────

export const qdrantService = new QdrantService();
