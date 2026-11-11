// ============================================================================
// JAGAT AI — Ollama Local Inference Service
// ============================================================================

import { env } from "../config/index.js";

/**
 * Ping Ollama to verify the local inference engine is running.
 * Ollama exposes a simple GET / endpoint that returns "Ollama is running".
 */
export async function pingOllama(): Promise<boolean> {
  try {
    const response = await fetch(env.OLLAMA_HOST, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
