// ============================================================================
// JAGAT AI — Centralized Environment Configuration
// Validates and exports all env vars with type safety at startup.
// ============================================================================

import "dotenv/config";

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`[JAGAT:ENV] Missing required environment variable: ${key}`);
  }
  return value;
}

function requirePort(key: string, fallback?: string): number {
  const raw = requireEnv(key, fallback);
  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`[JAGAT:ENV] Invalid port for ${key}: "${raw}"`);
  }
  return port;
}

export const env = {
  // Server
  PORT: requirePort("PORT", "5000"),
  NODE_ENV: requireEnv("NODE_ENV", "development"),

  // Ollama — Local Inference Engine
  OLLAMA_HOST: requireEnv("OLLAMA_HOST", "http://127.0.0.1:11434"),
  OLLAMA_REMOTE_ENABLED: requireEnv("OLLAMA_REMOTE_ENABLED", "false"),
  REMOTE_OLLAMA_HOST: requireEnv("REMOTE_OLLAMA_HOST", "http://100.107.244.82:11434"),
  REMOTE_INFERENCE_MODEL: requireEnv("REMOTE_INFERENCE_MODEL", "qwen2.5-coder:7b"),
  INFERENCE_MODEL: requireEnv("INFERENCE_MODEL", "llama3"),

  // Qdrant — Vector Memory
  QDRANT_HOST: requireEnv("QDRANT_HOST", "http://127.0.0.1:6333"),

  // Redis — Message Broker & Cache
  REDIS_HOST: requireEnv("REDIS_HOST", "127.0.0.1"),
  REDIS_PORT: requirePort("REDIS_PORT", "6379"),

  get isDev(): boolean {
    return this.NODE_ENV === "development";
  },
  get isProd(): boolean {
    return this.NODE_ENV === "production";
  },
} as const;
