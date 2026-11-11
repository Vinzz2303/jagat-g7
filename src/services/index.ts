// ============================================================================
// JAGAT AI — Services Barrel Export
// ============================================================================

// Legacy ping-only services (used by health check in index.ts)
export { getQdrantClient, pingQdrant } from "./qdrant.service.js";
export { getRedisClient, pingRedis, disconnectRedis } from "./redis.service.js";
export { pingOllama } from "./ollama.service.js";

// Full-featured native fetch clients
export { QdrantService, qdrantService } from "./qdrant.js";
export type { QdrantPoint, QdrantSearchResult } from "./qdrant.js";

export { OllamaService, ollamaService } from "./ollama.js";
export type { OllamaEmbeddingResponse, OllamaGenerateResponse, OllamaModelInfo } from "./ollama.js";

export { InferenceService, inferenceService } from "./inference.service.js";
