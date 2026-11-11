// @ts-nocheck
import { ollamaService } from './ollama.js';
import * as dotenv from 'dotenv';
dotenv.config();

export class HybridRouter {
  
  /**
   * Fast logic using Groq (Llama-3-8b-8192)
   * Perfect for rapid decisions (e.g., Browser Agent clicking)
   */
  static async callGroqFast(prompt: string, systemContext: string = "You are a helpful assistant.", jsonMode: boolean = false): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log("[HybridRouter] Groq API Key missing. Falling back to local Ollama.");
      return this.fallbackToOllama(prompt, systemContext, jsonMode);
    }

    try {
      const body: any = {
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: prompt }
        ],
        temperature: 0.1
      };

      if (jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error: ${response.status} ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      console.error("[HybridRouter] Groq failed, falling back to local Ollama.", err);
      return this.fallbackToOllama(prompt, systemContext, jsonMode);
    }
  }

  /**
   * Deep reasoning using Gemini 1.5 Flash
   * Perfect for B2B Copywriting and deep text analysis
   */
  static async callGeminiSmart(prompt: string, systemContext: string = "You are a helpful assistant."): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("[HybridRouter] Gemini API Key missing. Falling back to local Ollama.");
      return this.fallbackToOllama(prompt, systemContext, false);
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemContext } },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (err) {
      console.error("[HybridRouter] Gemini failed, falling back to local Ollama.", err);
      return this.fallbackToOllama(prompt, systemContext, false);
    }
  }

  /**
   * Fallback to Sovereign Local AI (Ollama)
   */
  private static async fallbackToOllama(prompt: string, systemContext: string, jsonMode: boolean): Promise<string> {
    const format = jsonMode ? 'json' : undefined;
    const res = await ollamaService.generateCompletion(
      prompt,
      systemContext,
      process.env.INFERENCE_MODEL || 'qwen2.5:7b',
      { temperature: jsonMode ? 0.1 : 0.7 }
    );
    return res.response.trim();
  }

  /**
   * Sovereign Agentic Execution (God Mode)
   * Supports Multimodal (Images) and forces structured JSON for ReAct Loop
   */
  static async callGeminiAgentic(
    prompt: string, 
    systemContext: string, 
    imagesBase64: { mimeType: string, data: string }[] = []
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for Agentic God Mode.");
    }

    const parts: any[] = [{ text: prompt }];
    
    // Add images if any
    for (const img of imagesBase64) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data
        }
      });
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemContext } },
          contents: [{ parts: parts }],
          generationConfig: { 
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (err) {
      console.error("[HybridRouter] Agentic Gemini failed, falling back to local Ollama.", err);
      // Fallback: gunakan Ollama lokal agar bot tidak mati diam-diam
      try {
        return await this.fallbackToOllama(prompt, systemContext, true);
      } catch (ollamaErr) {
        console.error("[HybridRouter] Ollama fallback also failed.", ollamaErr);
        throw new Error(`Semua AI engine gagal. Gemini: ${(err as any)?.message}. Ollama: ${(ollamaErr as any)?.message}`);
      }
    }
  }
}
