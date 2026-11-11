// ============================================================================
// JAGAT AI - Hybrid Inference Engine (Gemini / Ollama)
// Native fetch implementation mimicking Ollama NDJSON stream output.
// ============================================================================

import { env } from "../config/index.js";
import { composeSovereignSystemPrompt } from "../prompts/identity.js";
import { ollamaService, type OllamaGenerateResponse } from "./ollama.js";

interface InferenceGenerationOptions {
  temperature?: number;
  top_p?: number;
  num_predict?: number;
  repeat_penalty?: number;
}

export class InferenceService {
  private readonly geminiApiKey: string | undefined;
  // Default to Gemini 1.5 Pro for sovereign intelligence
  private readonly geminiModel = "gemini-1.5-pro-latest";

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  getCompletionModelLabel(): string {
    if (this.geminiApiKey) {
      return `${this.geminiModel} (Hybrid AGI Core)`;
    }
    return ollamaService.getCompletionModelLabel(env.INFERENCE_MODEL);
  }

  /**
   * Generate a non-streaming completion using Gemini if available, else Ollama.
   */
  async generateCompletion(
    prompt: string,
    systemPrompt: string,
    model: string,
    options?: InferenceGenerationOptions,
  ): Promise<OllamaGenerateResponse> {
    if (!this.geminiApiKey) {
      console.warn("[JAGAT:INFERENCE] GEMINI_API_KEY not found, falling back to local Ollama.");
      return ollamaService.generateCompletion(prompt, systemPrompt, model, options);
    }

    const sovereignSystemPrompt = composeSovereignSystemPrompt(systemPrompt);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: { text: sovereignSystemPrompt } },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.3,
              topP: options?.top_p ?? 0.85,
              maxOutputTokens: options?.num_predict ?? 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[JAGAT:INFERENCE] Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      return {
        model: this.geminiModel,
        created_at: new Date().toISOString(),
        response: textResponse,
        done: true,
      };
    } catch (err) {
      console.error("[JAGAT:INFERENCE] Gemini generate failed, falling back to Ollama:", err);
      return ollamaService.generateCompletion(prompt, systemPrompt, model, options);
    }
  }

  /**
   * Generate a streaming completion from Gemini, mapped to Ollama's NDJSON format.
   */
  async generateCompletionStream(
    prompt: string,
    systemPrompt: string,
    model: string,
    options?: InferenceGenerationOptions,
    signal?: AbortSignal,
  ): Promise<globalThis.Response> {
    if (!this.geminiApiKey) {
      return ollamaService.generateCompletionStream(prompt, systemPrompt, model, options, signal);
    }

    const sovereignSystemPrompt = composeSovereignSystemPrompt(systemPrompt);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:streamGenerateContent?alt=sse&key=${this.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),
          body: JSON.stringify({
            system_instruction: { parts: { text: sovereignSystemPrompt } },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.3,
              topP: options?.top_p ?? 0.85,
              maxOutputTokens: options?.num_predict ?? 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[JAGAT:INFERENCE] Gemini Stream error (${response.status}): ${errorText}`);
      }

      // Convert Gemini SSE format to Ollama NDJSON format via ReadableStream
      const geminiStream = response.body;
      if (!geminiStream) {
        throw new Error("[JAGAT:INFERENCE] Gemini returned null body.");
      }

      const reader = geminiStream.getReader();
      const decoder = new TextDecoder("utf-8");
      const encoder = new TextEncoder();

      const ndjsonStream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const dataStr = line.slice(6).trim();
                  if (dataStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (chunkText) {
                      const ndjsonObj = { response: chunkText, done: false };
                      controller.enqueue(encoder.encode(JSON.stringify(ndjsonObj) + "\n"));
                    }
                  } catch (e) {
                    // skip parse errors
                  }
                }
              }
            }
            // Send done signal
            controller.enqueue(encoder.encode(JSON.stringify({ response: "", done: true }) + "\n"));
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
        cancel() {
          reader.cancel();
        }
      });

      return new Response(ndjsonStream, {
        headers: { "Content-Type": "application/x-ndjson" }
      });

    } catch (err) {
      console.error("[JAGAT:INFERENCE] Gemini stream failed, falling back to Ollama:", err);
      return ollamaService.generateCompletionStream(prompt, systemPrompt, env.INFERENCE_MODEL, options, signal);
    }
  }
}

export const inferenceService = new InferenceService();
