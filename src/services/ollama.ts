// ============================================================================
// JAGAT AI - Ollama Inference Client
// Native fetch implementation with optional remote completion worker fallback.
// ============================================================================

import { env } from "../config/index.js";
import { composeSovereignSystemPrompt } from "../prompts/identity.js";

export interface OllamaEmbeddingResponse {
  embedding: number[];
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

interface OllamaGenerationOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  repeat_penalty?: number;
}

interface CompletionTarget {
  label: "remote" | "local";
  baseUrl: string;
  model: string;
}

export class OllamaService {
  private readonly baseUrl: string;
  private readonly remoteBaseUrl: string;
  private readonly remoteEnabled: boolean;
  private readonly remoteInferenceModel: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? env.OLLAMA_HOST).replace(/\/+$/, "");
    this.remoteBaseUrl = env.REMOTE_OLLAMA_HOST.replace(/\/+$/, "");
    this.remoteEnabled = env.OLLAMA_REMOTE_ENABLED === "true";
    this.remoteInferenceModel = env.REMOTE_INFERENCE_MODEL;
  }

  private async request<T>(
    path: string,
    body: unknown,
    timeoutMs = 120_000,
  ): Promise<T> {
    return this.requestAt<T>(this.baseUrl, path, body, timeoutMs);
  }

  private async requestAt<T>(
    baseUrl: string,
    path: string,
    body: unknown,
    timeoutMs = 120_000,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`[JAGAT:OLLAMA] POST ${path} failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  }

  private completionTargets(model: string): CompletionTarget[] {
    const targets: CompletionTarget[] = [];

    if (this.remoteEnabled) {
      targets.push({
        label: "remote",
        baseUrl: this.remoteBaseUrl,
        model: this.remoteInferenceModel || model,
      });
    }

    targets.push({ label: "local", baseUrl: this.baseUrl, model });
    return targets;
  }

  private logRemoteFallback(path: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[JAGAT:OLLAMA] Remote ${path} failed; falling back to local: ${message}`);
  }

  getCompletionModelLabel(localModel: string): string {
    return this.remoteEnabled
      ? `${this.remoteInferenceModel || localModel} (remote-first)`
      : localModel;
  }

  /**
   * Convert text into a high-dimensional vector embedding.
   *
   * Embeddings intentionally stay on the local Ollama node by default so Qdrant
   * vector dimensions and ingestion behavior remain stable.
   */
  async generateEmbedding(
    text: string,
    model = "nomic-embed-text",
  ): Promise<number[]> {
    if (!text.trim()) {
      throw new Error("[JAGAT:OLLAMA] Cannot embed empty text.");
    }

    const data = await this.request<OllamaEmbeddingResponse>(
      "/api/embeddings",
      { model, prompt: text },
      30_000,
    );

    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error(`[JAGAT:OLLAMA] Model "${model}" returned an empty embedding vector.`);
    }

    return data.embedding;
  }

  /**
   * Generate a non-streaming completion.
   *
   * When OLLAMA_REMOTE_ENABLED=true, completion tries the remote worker first
   * with REMOTE_INFERENCE_MODEL, then falls back to the local model on failure.
   */
  async generateCompletion(
    prompt: string,
    systemPrompt: string,
    model = "llama3",
    options?: OllamaGenerationOptions,
    signal?: AbortSignal,
    format?: "json",
  ): Promise<OllamaGenerateResponse> {
    if (!prompt.trim()) {
      throw new Error("[JAGAT:OLLAMA] Cannot generate from empty prompt.");
    }

    let lastError: unknown;

    for (const target of this.completionTargets(model)) {
      const body: Record<string, unknown> = {
        model: target.model,
        prompt,
        system: composeSovereignSystemPrompt(systemPrompt),
        stream: false,
      };

      if (options) body.options = options;
      if (format) body.format = format;

      try {
        return await this.requestAt<OllamaGenerateResponse>(
          target.baseUrl,
          "/api/generate",
          body,
          180_000,
          signal,
        );
      } catch (err) {
        lastError = err;
        if (signal?.aborted) throw err;
        if (target.label === "remote") {
          this.logRemoteFallback("/api/generate", err);
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Generate a streaming completion from Ollama.
   *
   * Fallback happens only before a stream is successfully opened. If the remote
   * stream opens and later fails mid-stream, the caller owns that stream error.
   */
  async generateCompletionStream(
    prompt: string,
    systemPrompt: string,
    model = "llama3",
    options?: OllamaGenerationOptions,
    signal?: AbortSignal,
  ): Promise<globalThis.Response> {
    if (!prompt.trim()) {
      throw new Error("[JAGAT:OLLAMA] Cannot generate from empty prompt.");
    }

    let lastError: unknown;

    for (const target of this.completionTargets(model)) {
      const body: Record<string, unknown> = {
        model: target.model,
        prompt,
        system: composeSovereignSystemPrompt(systemPrompt),
        stream: true,
      };

      if (options) body.options = options;

      try {
        const response = await fetch(`${target.baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(300_000)])
            : AbortSignal.timeout(300_000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`[JAGAT:OLLAMA] POST /api/generate stream failed (${response.status}): ${errorText}`);
        }

        return response;
      } catch (err) {
        lastError = err;
        if (target.label === "remote") {
          this.logRemoteFallback("/api/generate stream", err);
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * List models on the primary local Ollama instance.
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`[JAGAT:OLLAMA] GET /api/tags failed (${response.status})`);
    }

    const data = (await response.json()) as { models: OllamaModelInfo[] };
    return data.models ?? [];
  }

  /**
   * Quick connectivity check against the primary local Ollama node.
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const ollamaService = new OllamaService();
