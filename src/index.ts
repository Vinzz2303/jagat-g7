// ============================================================================
// JAGAT AI — Core Server Entry Point
// Sovereign Autonomous Intelligence Infrastructure — Stage 3
// ============================================================================
//
// Lightweight, production-grade Express server with:
//   • Async error boundary (no unhandled rejections crash the process)
//   • Startup health probes for Ollama, Qdrant, and Redis
//   • Graceful shutdown handling
//   • Security hardening via Helmet + CORS
// ============================================================================

import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";

import { env } from "./config/index.js";
import { pingOllama, pingQdrant, pingRedis, disconnectRedis } from "./services/index.js";
import { normalizeAgentMode, researchAgent, type ResearchFilters } from "./agents/index.js";
import { validateFormalIngestRequest } from "./ingestion/schema.js";
import {
  isIdentityQuestion,
  isCreatorQuestion,
  isFaturachmanQuestion,
  isArchitectureMottoQuestion,
  isPublicMissionQuestion,
  JAGAT_IDENTITY_RESPONSE,
  JAGAT_CREATOR_RESPONSE,
  JAGAT_FATURACHMAN_RESPONSE,
  JAGAT_ARCHITECTURE_MOTTO_RESPONSE,
  JAGAT_PUBLIC_MISSION_RESPONSE,
} from "./prompts/identity.js";
import { colonyRouter } from "./colony/routes.js";
import { schedulerLoop } from "./colony/index.js";
import { reconcileLedgerAndRedis, closeMissionLedger, ledgerEnabled } from "./colony/mission-ledger.js";
import * as whatsappAdapter from "./colony/whatsapp-adapter.js";

// ── Express App ──────────────────────────────────────────────────────────────

const app = express();

const INTERNAL_LEAK_PATTERNS = [
  "DIREKTIF RISET",
  "Threshold Kemiripan",
  "Mode Sumber",
  "Topik Investigasi",
  "Instruksi Output",
  "Gunakan struktur berikut",
  "Pengetahuan umum model lokal",
  "Hasil analisis inteligensi untuk topik",
  "Jika Anda bertanya tentang identitas saya",
  "Dilarang menulis frasa",
  "Dilarang mengklaim bahwa saya Codex",
  "Dilarang membocorkan rahasia dapur",
  "PROTOKOL MEMORI BERDAULAT",
  "PROTOKOL DEDUKSI",
  "PROTOKOL PENOLAKAN",
  "FORMAT UMUM:",
];

function findInternalLeakIndex(text: string): number {
  const lower = text.toLowerCase();
  const indexes = INTERNAL_LEAK_PATTERNS
    .map((pattern) => lower.indexOf(pattern.toLowerCase()))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function isInternalPromptDisclosureRequest(text: string): boolean {
  return /system prompt|prompt internal|direktif riset|threshold kemiripan|mode sumber|instruksi internal|developer message|rahasia prompt/i.test(text);
}

const INTERNAL_PROMPT_REFUSAL_RESPONSE = [
  "Saya tidak dapat menampilkan instruksi internal, prompt sistem, atau parameter operasional.",
  "Saya bisa membantu dengan ringkasan kemampuan publik JAGAT G7, rancangan benchmark, atau rencana implementasi yang aman.",
].join("\n\n");

function isRuntimeStatusQuestion(text: string): boolean {
  return /model aktif|pakai model apa|model apa|runtime|remote worker|server b|ollama|qwen|llama/i.test(text);
}

function buildRuntimeStatusResponse(): string {
  const remoteActive = env.OLLAMA_REMOTE_ENABLED === "true";
  const inferenceModel = remoteActive
    ? `${env.REMOTE_INFERENCE_MODEL} (remote-first via Server B)`
    : `${env.INFERENCE_MODEL} (local)`;

  return [
    `Runtime inference aktif: ${inferenceModel}.`,
    `Fallback lokal: ${env.INFERENCE_MODEL} di ${env.OLLAMA_HOST}.`,
    "Embedding dan pencarian memori tetap berjalan lokal agar Qdrant stabil.",
    "Catatan: 14B cocok untuk review/offline yang lebih berat, sedangkan 7B lebih masuk akal untuk console live karena CPU Server B masih lambat untuk 14B.",
  ].join("\n");
}

function isLiveCurrentAffairsQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  const internalCommercialQuestion =
    /paket produk|produk apa saja|bisa dijual|delivery scope|commercial readiness|harga paket|harga.*produk/i.test(lower);

  if (internalCommercialQuestion) return false;

  const asksCurrent =
    /\b(sekarang|hari ini|terbaru|terkini|current|latest|real[- ]?time|live)\b/i.test(lower);
  const realtimeDomain =
    /geopolitik|berita|news|harga|market|crypto|saham|perang|pemilu|regulasi|cuaca/i.test(lower);

  return asksCurrent && realtimeDomain;
}

const LIVE_DATA_LIMITATION_RESPONSE = [
  "Console ini belum memakai browser/news lookup live untuk menjawab kondisi real-time.",
  "Saya bisa memakai memori lokal JAGAT untuk memberi kerangka analisis dan risiko, tetapi tidak boleh mengklaim kondisi terbaru tanpa sumber live.",
  "Untuk jawaban aktual, aktifkan modul browser/search atau kirim sumber terbaru, lalu saya rangkum dan petakan implikasinya.",
].join("\n\n");

// ── Security & Parsing Middleware ────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check Endpoint ────────────────────────────────────────────────────

app.get("/health", async (_req: Request, res: Response) => {
  const [ollama, qdrant, redis] = await Promise.allSettled([
    pingOllama(),
    pingQdrant(),
    pingRedis(),
  ]);

  const status = {
    status: "operational",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      ollama: ollama.status === "fulfilled" ? (ollama.value ? "connected" : "unreachable") : "error",
      qdrant: qdrant.status === "fulfilled" ? (qdrant.value ? "connected" : "unreachable") : "error",
      redis: redis.status === "fulfilled" ? (redis.value ? "connected" : "unreachable") : "error",
    },
  };

  const allHealthy = Object.values(status.services).every((s) => s === "connected");
  res.status(allHealthy ? 200 : 503).json(status);
});

// ── Colony Engine Routes ─────────────────────────────────────────────────────

app.use("/colony", colonyRouter);

// ── Root Endpoint ────────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "JAGAT G7 Sovereign Super Intelligence Core",
    version: "0.1.0",
    stage: "Stage 3 — Proprietary System",
    status: "online",
    endpoints: ["/health", "/research", "/research/ingest", "/colony"],
  });
});

// ── Research Agent Endpoints ─────────────────────────────────────────────────

/**
 * POST /research
 * Body: { "topic": "string" }
 * SSE streaming research — sends tokens in real-time.
 * Events: meta → token* → done
 */
app.post("/research", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, filters, agentMode: rawAgentMode } = req.body as {
      topic?: string;
      filters?: ResearchFilters;
      agentMode?: unknown;
    };

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      res.status(400).json({
        error: "Bad Request",
        message: 'Request body must include a non-empty "topic" string.',
      });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "status", data: "Menyiapkan pipeline riset..." })}\n\n`);

    // ── SOVEREIGN IDENTITY FAST-PATH ──────────────────────────────────────────
    // Pertanyaan identitas / pembuat dijawab secara deterministik — tidak
    // pernah bergantung pada probabilitas LLM.  Ini memastikan JAGAT G7
    // selalu mendeklarasikan identitasnya dengan tepat tanpa variasi.
    const trimmedTopic = topic.trim();
    if (isFaturachmanQuestion(trimmedTopic)) {
      const sovereignResponse = JAGAT_FATURACHMAN_RESPONSE;
      res.write(`data: ${JSON.stringify({ type: "token", data: sovereignResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isArchitectureMottoQuestion(trimmedTopic)) {
      const sovereignResponse = JAGAT_ARCHITECTURE_MOTTO_RESPONSE;
      res.write(`data: ${JSON.stringify({ type: "token", data: sovereignResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isPublicMissionQuestion(trimmedTopic)) {
      const sovereignResponse = JAGAT_PUBLIC_MISSION_RESPONSE;
      res.write(`data: ${JSON.stringify({ type: "token", data: sovereignResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isCreatorQuestion(trimmedTopic)) {
      const sovereignResponse = JAGAT_CREATOR_RESPONSE;
      res.write(`data: ${JSON.stringify({ type: "token", data: sovereignResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isIdentityQuestion(trimmedTopic)) {
      const sovereignResponse = JAGAT_IDENTITY_RESPONSE;
      res.write(`data: ${JSON.stringify({ type: "token", data: sovereignResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isInternalPromptDisclosureRequest(trimmedTopic)) {
      res.write(`data: ${JSON.stringify({ type: "token", data: INTERNAL_PROMPT_REFUSAL_RESPONSE })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    // ── END FAST-PATH ─────────────────────────────────────────────────────────

    if (isRuntimeStatusQuestion(trimmedTopic)) {
      res.write(`data: ${JSON.stringify({ type: "token", data: buildRuntimeStatusResponse() })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }
    if (isLiveCurrentAffairsQuestion(trimmedTopic)) {
      res.write(`data: ${JSON.stringify({ type: "token", data: LIVE_DATA_LIMITATION_RESPONSE })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", data: { timing: { embeddingMs: 0, searchMs: 0, inferenceMs: 0, totalMs: 0 } } })}\n\n`);
      res.end();
      return;
    }

    const agentMode = normalizeAgentMode(rawAgentMode);
    const { meta, ollamaStream } = await researchAgent.executeResearchStream(
      trimmedTopic,
      undefined,
      filters,
      agentMode,
    );

    // Send meta event (embedding + search timing, context info)
    res.write(`data: ${JSON.stringify({ type: "meta", data: meta })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "status", data: "Worker inferensi sedang menghasilkan analisis..." })}\n\n`);

    // Stream Ollama NDJSON tokens → SSE events
    const reader = ollamaStream.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: "error", data: "Ollama stream body null" })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let guardedTokenBuffer = "";
    let streamBlockedForLeak = false;

    streamLoop:
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as { response?: string; done?: boolean };
          if (chunk.response) {
            guardedTokenBuffer += chunk.response;
            const leakIndex = findInternalLeakIndex(guardedTokenBuffer);
            if (leakIndex >= 0) {
              const safeText = guardedTokenBuffer.slice(0, leakIndex).trimEnd();
              if (safeText) {
                res.write(`data: ${JSON.stringify({ type: "token", data: safeText })}\n\n`);
              }
              guardedTokenBuffer = "";
              streamBlockedForLeak = true;
              await reader.cancel().catch(() => undefined);
              break streamLoop;
            }

            if (guardedTokenBuffer.length > 240) {
              const flushLength = guardedTokenBuffer.length - 160;
              const safeFlush = guardedTokenBuffer.slice(0, flushLength);
              guardedTokenBuffer = guardedTokenBuffer.slice(flushLength);
              res.write(`data: ${JSON.stringify({ type: "token", data: safeFlush })}\n\n`);
            }
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    // Process any remaining buffer
    if (!streamBlockedForLeak && buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer.trim()) as { response?: string };
        if (chunk.response) {
          guardedTokenBuffer += chunk.response;
        }
      } catch {
        // skip
      }
    }

    if (guardedTokenBuffer && !streamBlockedForLeak) {
      const leakIndex = findInternalLeakIndex(guardedTokenBuffer);
      const safeText = leakIndex >= 0 ? guardedTokenBuffer.slice(0, leakIndex).trimEnd() : guardedTokenBuffer;
      if (safeText) {
        res.write(`data: ${JSON.stringify({ type: "token", data: safeText })}\n\n`);
      }
    }

    // Send final timing metrics
    const inferenceMs = Math.round(performance.now() - meta.inferenceStartTime);
    const totalMs = Math.round(performance.now() - meta.totalStartTime);

    res.write(`data: ${JSON.stringify({
      type: "done",
      data: {
        timing: { embeddingMs: meta.embeddingMs, searchMs: meta.searchMs, inferenceMs, totalMs },
      },
    })}\n\n`);

    res.end();
  } catch (err) {
    // If headers already sent, we can't send JSON error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", data: err instanceof Error ? err.message : "Unknown error" })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
});

/**
 * POST /research/ingest
 * Body: { "content": "string", "metadata": { title, source, category, doc_type, owner, created_at, trust_level, provenance, notes? } }
 * Ingest a document into the sovereign knowledge base.
 */
app.post("/research/ingest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validateFormalIngestRequest(req.body);

    if (!validation.ok || !validation.value) {
      res.status(400).json({
        error: "Bad Request",
        message: validation.message ?? "Request ingest tidak valid.",
      });
      return;
    }

    const docId = await researchAgent.ingestDocument(
      validation.value.content,
      validation.value.metadata,
    );
    res.status(201).json({ id: docId, status: "ingested", metadata: validation.value.metadata });
  } catch (err) {
    next(err);
  }
});

// ── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found", message: "The requested resource does not exist." });
});

// ── Global Async Error Handler ───────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[JAGAT:ERROR]", err.stack ?? err.message);
  res.status(500).json({
    error: "Internal Server Error",
    message: env.isDev ? err.message : "An unexpected error occurred.",
  });
});

// ── Startup Sequence ─────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          JAGAT G7 — Sovereign Super Intelligence Core   ║");
  console.log("║          Stage 3: Proprietary System Initializing       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // Probe infrastructure dependencies
  console.log("[JAGAT:BOOT] Probing infrastructure dependencies...\n");

  const [ollamaOk, qdrantOk, redisOk] = await Promise.all([
    pingOllama(),
    pingQdrant(),
    pingRedis(),
  ]);

  // Initialize sovereign knowledge base collection in Qdrant (idempotent)
  if (qdrantOk) {
    try {
      await researchAgent.ensureKnowledgeBase();
      console.log("  🧠 Knowledge base initialized.");
    } catch (err) {
      console.warn("  ⚠️  Knowledge base init failed (non-fatal):", err);
    }
  }

  const statusIcon = (ok: boolean) => (ok ? "✅" : "⚠️ ");

  console.log(`  ${statusIcon(ollamaOk)} Ollama   → ${env.OLLAMA_HOST}  ${ollamaOk ? "(connected)" : "(unreachable — will retry at runtime)"}`);
  console.log(`  ${statusIcon(qdrantOk)} Qdrant   → ${env.QDRANT_HOST}  ${qdrantOk ? "(connected)" : "(unreachable — will retry at runtime)"}`);
  console.log(`  ${statusIcon(redisOk)}  Redis    → ${env.REDIS_HOST}:${env.REDIS_PORT}  ${redisOk ? "(connected)" : "(unreachable — will retry at runtime)"}`);
  console.log("");

  // Rebuild scheduler projection from durable ledger before serving any work.
  // Fail closed if enabled but database or Redis cannot be reconciled.
  if (ledgerEnabled()) {
    const restored = await reconcileLedgerAndRedis();
    console.log(`[JAGAT:CORE] Durable ledger restored: ${restored.missions} missions / ${restored.tasks} tasks`);
  }

  // Start listening
  app.listen(env.PORT, () => {
    console.log(`[JAGAT:CORE] Server listening on http://127.0.0.1:${env.PORT}`);
    console.log(`[JAGAT:CORE] Environment: ${env.NODE_ENV}`);
    schedulerLoop.startC6SchedulerLoop();

    // Auto-connect WhatsApp if WA_AUTO_CONNECT=true (non-blocking, QR will be emitted if needed)
    const waAutoConnect = (process.env.WA_AUTO_CONNECT ?? "false").toLowerCase() === "true";
    const waEnabled = (process.env.WA_ENABLED ?? "false").toLowerCase() === "true";
    if (waAutoConnect && waEnabled) {
      console.log("[JAGAT:CORE] WhatsApp auto-connect enabled. Initializing...");
      whatsappAdapter.connectWhatsApp().catch((err) => {
        console.error("[JAGAT:CORE] WhatsApp auto-connect failed (non-fatal):", err?.message ?? err);
      });
    } else if (waEnabled) {
      console.log("[JAGAT:CORE] WhatsApp enabled but WA_AUTO_CONNECT=false. Use POST /colony/whatsapp/connect to connect manually.");
    }

    console.log(`[JAGAT:CORE] Ready to serve.\n`);
  });
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[JAGAT:CORE] Received ${signal}. Shutting down gracefully...`);
  schedulerLoop.stopC6SchedulerLoop();
  await whatsappAdapter.disconnectWhatsApp().catch(() => {});
  await disconnectRedis();
  closeMissionLedger();
  console.log("[JAGAT:CORE] All connections closed. Goodbye.\n");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Catch unhandled async errors at the process level
process.on("unhandledRejection", (reason) => {
  console.error("[JAGAT:FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[JAGAT:FATAL] Uncaught Exception:", err);
  // Don't exit — Baileys and other libs may throw recoverable errors
  // process.exit(1);
});

// ── Launch ───────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  console.error("[JAGAT:FATAL] Bootstrap failed:", err);
  process.exit(1);
});
