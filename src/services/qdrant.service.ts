// ============================================================================
// JAGAT AI — Qdrant Vector Memory Service
// ============================================================================

import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../config/index.js";

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: env.QDRANT_HOST, checkCompatibility: false });
  }
  return client;
}

/**
 * Ping Qdrant to verify connectivity.
 * Uses native fetch instead of the SDK client to avoid undici
 * version conflicts between @qdrant/js-client-rest and Node 26.
 */
export async function pingQdrant(): Promise<boolean> {
  try {
    const res = await fetch(`${env.QDRANT_HOST}/collections`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: { collections?: unknown[] } };
    return Array.isArray(data.result?.collections);
  } catch {
    return false;
  }
}
