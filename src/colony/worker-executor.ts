// ============================================================================
// JAGAT Colony — Worker Executor
// Real worker execution engine for C5B-1 and C5B-2.
//
// Replaces simulation with actual codebase operations when agents have
// filesystem permissions. Agents with canReadCodebase perform real file reads
// and analysis. Others fall back to simulation.
//
// C5B-1: Read files, analyze with LLM, attach evidence.
// C5B-2: Builder additionally generates structured patch proposals.
//
// Flow (builder with C5B-2):
//   task approved → running
//     → worker reads files via sandbox (role-scoped roots)
//     → generates analysis + structured diff via LLM
//     → if task implies code change: submitProposal() to patch-engine
//     → posts progress and proposal notification to chat
//     → attaches evidence
//     → moves task to review
// ============================================================================

import { taskEngine, chatEngine, agentRegistry, auditEngine } from "./index.js";
import { getRedisClient } from "../services/redis.service.js";
import {
  readFile,
  listDirectory,
  searchInFiles,
  resetTaskBytes,
  getTaskBytesUsed,
  getWorkerActions,
} from "./worker-sandbox.js";
import {
  submitProposal,
  formatProposalSummary,
  PatchEngineError,
} from "./patch-engine.js";
import { ollamaService } from "../services/ollama.js";
import { composeSovereignSystemPrompt } from "../prompts/identity.js";
import { env } from "../config/index.js";
import { recordRuntimeEvent } from "./model-arena.js";
import {
  type ColonyTask,
  type AgentRole,
  type TaskEvidence,
  type WorkerAction,
  type PatchHunk,
  DEFAULT_PERMISSIONS,
} from "./types.js";

// ── Constants ───────────────────────────────────────────────────────────────

const INFERENCE_MODEL = env.INFERENCE_MODEL ?? "llama3";
const MAX_CONTEXT_LENGTH = 8000; // chars of file content to send to LLM
const WORKER_INFERENCE_TIMEOUT_MS = 180_000;
const WORKER_LOCK_TTL_SECONDS = 15 * 60;

async function releaseWorkerLock(lockKey: string, lockValue: string): Promise<void> {
  const redis = getRedisClient();
  const currentValue = await redis.get(lockKey);
  if (currentValue === lockValue) {
    await redis.del(lockKey);
  }
}

const AGENT_NAMES: Record<AgentRole, string> = {
  director: "Colony Director",
  planner: "Architect Agent",
  researcher: "Research & Memory Agent",
  builder: "Builder / Coder Agent",
  reviewer: "Reviewer / QA Agent",
  reporter: "Reporter / Ops Agent",
};

// ── Role-Specific Work Strategies ───────────────────────────────────────────

interface WorkStrategy {
  /** Directories to scan for relevant files */
  scanDirs: string[];
  /** File patterns to prioritize (checked against filename) */
  priorityPatterns: string[];
  /** Search queries to run for context discovery */
  searchQueries: (task: ColonyTask) => string[];
  /** LLM prompt template for analysis */
  analysisPrompt: string;
}

const WORK_STRATEGIES: Partial<Record<AgentRole, WorkStrategy>> = {
  builder: {
    scanDirs: ["c:/JAGAT/src/colony", "c:/JAGAT/src/services", "c:/JAGAT/jagat-ui/src"],
    priorityPatterns: [".ts", ".tsx", ".js", ".jsx"],
    searchQueries: (task) => {
      // Extract key terms from task title and objective
      const terms = extractKeyTerms(task.title + " " + task.objective);
      return terms.slice(0, 3);
    },
    analysisPrompt: `Anda adalah Builder Agent JAGAT Colony. Analisis file-file berikut dan berikan:
1. Ringkasan struktur kode yang relevan
2. Bug atau gap yang ditemukan
3. Rekomendasi implementasi untuk task ini
4. File mana yang perlu dimodifikasi dan kenapa

Jika Anda menemukan perubahan kode yang spesifik dan dapat diimplementasikan,
sertakan juga blok JSON PATCH_PROPOSAL di akhir analisis Anda dengan format:
<PATCH_PROPOSAL>
{
  "title": "ringkasan singkat perubahan",
  "rationale": "kenapa perubahan ini diperlukan",
  "estimatedRisk": "low|medium|high",
  "trainingDataTags": ["tag1", "tag2"],
  "hunks": [
    {
      "filePath": "path/relative/to/JAGAT/root",
      "startLine": 1,
      "endLine": 5,
      "originalContent": "TEKS ASLI DARI FILE (harus persis sama)",
      "proposedContent": "TEKS BARU YANG DIUSULKAN",
      "unifiedDiff": "--- a/path\n+++ b/path\n@@ @@\n-original\n+proposed"
    }
  ]
}
</PATCH_PROPOSAL>

Jika tidak ada perubahan kode yang spesifik, jangan sertakan blok PATCH_PROPOSAL.
Berikan analisis yang konkret dan actionable.`,
  },

  reviewer: {
    scanDirs: ["c:/JAGAT/src/colony", "c:/JAGAT/src/services"],
    priorityPatterns: [".ts", ".tsx"],
    searchQueries: (task) => {
      const terms = extractKeyTerms(task.title + " " + task.objective);
      return [...terms.slice(0, 2), "TODO", "FIXME"];
    },
    analysisPrompt: `Anda adalah Reviewer / QA Agent JAGAT Colony. Review file-file berikut dan berikan:
1. Potensi bug atau edge case yang belum ditangani
2. Code quality assessment (naming, structure, error handling)
3. Security concerns
4. Compliance terhadap acceptance criteria task
5. Verdict: PASS, NEEDS_WORK, atau FAIL

Berikan review yang detail dan constructive.`,
  },

  researcher: {
    scanDirs: ["c:/JAGAT/ops", "c:/JAGAT/src/colony"],
    priorityPatterns: [".md", ".ts"],
    searchQueries: (task) => extractKeyTerms(task.title + " " + task.objective).slice(0, 3),
    analysisPrompt: `Anda adalah Research & Memory Agent JAGAT Colony. Analisis dokumen berikut dan berikan:
1. Ringkasan konteks yang relevan untuk task ini
2. Gap pengetahuan yang perlu diisi
3. Dokumen terkait yang perlu dibaca
4. Rekomendasi untuk agent lain berdasarkan temuan

Berikan analisis yang terstruktur dan actionable.`,
  },

  planner: {
    scanDirs: ["c:/JAGAT/ops", "c:/JAGAT/src/colony"],
    priorityPatterns: [".md", ".ts"],
    searchQueries: (task) => extractKeyTerms(task.title + " " + task.objective).slice(0, 2),
    analysisPrompt: `Anda adalah Planner / Architect Agent JAGAT Colony. Analisis codebase dan dokumen berikut, lalu berikan:
1. Breakdown task menjadi sub-steps yang jelas
2. Dependency map — apa yang harus dilakukan dulu
3. Risk flags — hal yang perlu diperhatikan
4. Estimasi effort (simple/moderate/complex)

Berikan planning yang terstruktur dan realistis.`,
  },
};

// ── Public API ──────────────────────────────────────────────────────────────

export interface WorkerResult {
  taskId: string;
  agentRole: AgentRole;
  filesRead: string[];
  searchesPerformed: string[];
  totalBytesRead: number;
  output: string;
  evidence: TaskEvidence;
  actions: WorkerAction[];
  inferenceMs: number;
}

/**
 * Check if an agent role should use real worker execution (vs simulation).
 */
export function shouldUseRealWorker(agentRole: AgentRole): boolean {
  const perms = DEFAULT_PERMISSIONS[agentRole];
  return perms.canReadCodebase || perms.canSearchCodebase;
}

/**
 * Execute real worker operations for a task.
 * Reads relevant files, analyzes them with LLM, and produces evidence.
 */
export async function executeWorker(
  task: ColonyTask,
  roomId: string,
  _founderName: string,
): Promise<WorkerResult> {
  const agentRole = task.assignedAgent;
  const agentName = AGENT_NAMES[agentRole] ?? agentRole;
  const strategy = WORK_STRATEGIES[agentRole];
  const redis = getRedisClient();
  const lockKey = `colony:worker:lock:${task.taskId}`;
  const lockValue = `${agentRole}:${Date.now()}`;
  const lockAcquired = await redis.set(lockKey, lockValue, "EX", WORKER_LOCK_TTL_SECONDS, "NX");

  if (lockAcquired !== "OK") {
    throw new Error(`Worker execution already in progress for task ${task.taskId}`);
  }

  // Reset byte tracking for this task
  resetTaskBytes(task.taskId);

  // Audit: execution start
  await auditEngine.emitAudit({
    actor: agentName,
    actorRole: agentRole,
    action: "worker.execution_start",
    resource: `task:${task.taskId}`,
    detail: { title: task.title, objective: task.objective },
  });

  const result: WorkerResult = {
    taskId: task.taskId,
    agentRole,
    filesRead: [],
    searchesPerformed: [],
    totalBytesRead: 0,
    output: "",
    evidence: {
      type: "other",
      description: "",
      timestamp: new Date().toISOString(),
      agentRole,
    },
    actions: [],
    inferenceMs: 0,
  };

  try {
    // Step 1: Send working message
    await chatEngine.sendMessage({
      roomId,
      senderId: agentRole,
      senderRole: agentRole,
      senderName: agentName,
      content: `⚡ Task **${task.taskId}** → **running** (C5B real worker)\n🔍 Membaca codebase dan menganalisis...`,
      messageType: "agent_update",
      linkedTaskId: task.taskId,
    });

    // (try block continues below — lock released in finally)

    // Step 2: Discover relevant files
    const fileContents: Array<{ path: string; content: string }> = [];

    if (strategy) {
      // Search for relevant files first
      for (const query of strategy.searchQueries(task)) {
        for (const dir of strategy.scanDirs) {
          try {
            const searchResults = await searchInFiles(query, dir, task.taskId, agentRole, {
              maxResults: 10,
            });
            result.searchesPerformed.push(`"${query}" in ${dir} → ${searchResults.length} matches`);

            // Read top matching files (deduplicated)
            const seenFiles = new Set(result.filesRead);
            for (const match of searchResults) {
              const fullPath = `c:/JAGAT/${match.file}`;
              if (seenFiles.has(fullPath)) continue;
              if (fileContents.length >= 8) break; // cap at 8 files

              try {
                const content = await readFile(fullPath, task.taskId, agentRole);
                fileContents.push({ path: match.file, content });
                result.filesRead.push(fullPath);
                seenFiles.add(fullPath);
              } catch {
                // Skip unreadable files (sandbox enforces limits)
              }
            }
          } catch {
            // Search might fail for non-existent dirs — continue
          }
        }
      }

      // If not enough files found via search, scan key directories
      if (fileContents.length < 3) {
        for (const dir of strategy.scanDirs) {
          try {
            const entries = await listDirectory(dir, task.taskId, agentRole, 1);
            const relevantFiles = entries
              .filter((e) => !e.isDirectory)
              .filter((e) => strategy.priorityPatterns.some((p) => e.name.endsWith(p)))
              .slice(0, 5);

            for (const entry of relevantFiles) {
              const fullPath = `c:/JAGAT/${entry.path}`;
              if (result.filesRead.includes(fullPath)) continue;
              if (fileContents.length >= 8) break;

              try {
                const content = await readFile(fullPath, task.taskId, agentRole);
                fileContents.push({ path: entry.path, content });
                result.filesRead.push(fullPath);
              } catch {
                // Skip
              }
            }
          } catch {
            // Continue
          }
        }
      }
    }

    result.totalBytesRead = getTaskBytesUsed(task.taskId);

    // Step 3: Send progress update
    await chatEngine.sendMessage({
      roomId,
      senderId: agentRole,
      senderRole: agentRole,
      senderName: agentName,
      content: `📂 Membaca ${fileContents.length} file (${formatBytes(result.totalBytesRead)})\n${result.filesRead.map((f) => `  • ${f.split("/").slice(-2).join("/")}`).join("\n")}`,
      messageType: "agent_update",
      linkedTaskId: task.taskId,
    });

    // Step 4: Generate analysis with LLM
    if (fileContents.length > 0 && strategy) {
      const analysisOutput = await generateAnalysis(
        task,
        strategy.analysisPrompt,
        fileContents,
      );
      result.output = analysisOutput.output;
      result.inferenceMs = analysisOutput.inferenceMs;
    } else {
      result.output = `[C5B Worker] Tidak ada file yang relevan ditemukan untuk task "${task.title}". Agent ${agentName} membutuhkan arahan lebih spesifik tentang file atau direktori target.`;
    }

    // Step 5: Create evidence
    result.evidence = {
      type: agentRole === "reviewer" ? "review_verdict" : "document",
      description: `[C5B Real Worker] ${agentName}\n\n${result.output.slice(0, 2000)}`,
      timestamp: new Date().toISOString(),
      agentRole,
    };

    // Step 6: Post analysis to chat
    const outputPreview = result.output.length > 1500
      ? result.output.slice(0, 1500) + "\n\n…(truncated)"
      : result.output;

    await chatEngine.sendMessage({
      roomId,
      senderId: agentRole,
      senderRole: agentRole,
      senderName: agentName,
      content: `🧠 **Analisis ${agentName}** untuk task **${task.taskId}**\n\n${outputPreview}\n\n📊 Stats: ${fileContents.length} files read, ${formatBytes(result.totalBytesRead)}, inference: ${result.inferenceMs}ms`,
      messageType: "agent_update",
      linkedTaskId: task.taskId,
    });

    // Step 7: Attach evidence and move to review
    await taskEngine.addEvidence(task.taskId, result.evidence);

    // Step 7B: Builder patch proposal (C5B-2)
    // Only if builder read files and analysis suggests code changes
    if (agentRole === "builder" && fileContents.length > 0 && result.output) {
      await tryGeneratePatchProposal(
        task,
        agentName,
        result.output,
        result.filesRead,
        result.searchesPerformed,
        roomId,
      );
    }

    await taskEngine.updateTaskStatus(
      task.taskId,
      "review",
      agentName,
      `C5B worker execution complete — ${fileContents.length} files analyzed`,
    );

    await chatEngine.sendMessage({
      roomId,
      senderId: agentRole,
      senderRole: agentRole,
      senderName: agentName,
      content: `📋 Task **${task.taskId}** → status **review**\n✅ Evidence ditambahkan (C5B real worker). Menunggu review founder.\n🔍 Lihat detail: \`/worker-log ${task.taskId}\``,
      messageType: "agent_update",
      linkedTaskId: task.taskId,
    });

    // Set agent back to idle
    const agents = await agentRegistry.listAgents(agentRole);
    if (agents[0]) {
      await agentRegistry.updateAgentStatus(agents[0].agentId, "idle");
    }

    // Get all worker actions for the result
    result.actions = await getWorkerActions(task.taskId);

    // Audit: execution complete
    await auditEngine.emitAudit({
      actor: agentName,
      actorRole: agentRole,
      action: "worker.execution_complete",
      resource: `task:${task.taskId}`,
      detail: {
        filesRead: result.filesRead.length,
        searchesPerformed: result.searchesPerformed.length,
        totalBytesRead: result.totalBytesRead,
        inferenceMs: result.inferenceMs,
        outputLength: result.output.length,
      },
    });

    console.log(
      `[Colony:Worker] ${agentName} completed task ${task.taskId}: ` +
      `${result.filesRead.length} files, ${formatBytes(result.totalBytesRead)}, ` +
      `inference ${result.inferenceMs}ms`,
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    // Post error to chat (individual try/catch to not block cleanup)
    try {
      await chatEngine.sendMessage({
        roomId,
        senderId: agentRole,
        senderRole: agentRole,
        senderName: agentName,
        content: `❌ Worker execution gagal untuk task **${task.taskId}**: ${errorMsg}`,
        messageType: "agent_update",
        linkedTaskId: task.taskId,
      });
    } catch { /* best-effort chat notification */ }

    // Still attach evidence about the failure
    try {
      await taskEngine.addEvidence(task.taskId, {
        type: "other",
        description: `[C5B Worker Error] ${errorMsg}\n\nFiles read before error: ${result.filesRead.join(", ") || "none"}`,
        timestamp: new Date().toISOString(),
        agentRole,
      });
    } catch { /* best-effort evidence */ }

    try {
      await taskEngine.updateTaskStatus(
        task.taskId,
        "review",
        agentName,
        `C5B worker failed: ${errorMsg}`,
      );
    } catch { /* best-effort status update */ }

    // Set agent back to idle
    try {
      const agents = await agentRegistry.listAgents(agentRole);
      if (agents[0]) {
        await agentRegistry.updateAgentStatus(agents[0].agentId, "idle");
      }
    } catch { /* best-effort agent reset */ }

    try {
      result.actions = await getWorkerActions(task.taskId);
    } catch { /* best-effort actions */ }

    return result;
  } finally {
    // Always release worker lock — prevents 15-minute stale lock
    await releaseWorkerLock(lockKey, lockValue).catch(() => {
      console.error(`[Colony:Worker] Failed to release lock for task ${task.taskId}`);
    });
  }
}

// ── LLM Analysis ────────────────────────────────────────────────────────────

async function generateAnalysis(
  task: ColonyTask,
  systemPrompt: string,
  files: Array<{ path: string; content: string }>,
): Promise<{ output: string; inferenceMs: number }> {
  const inferenceStart = performance.now();
  try {
    // Build context from files (cap at MAX_CONTEXT_LENGTH)
    let contextLength = 0;
    const fileBlocks: string[] = [];

    for (const f of files) {
      const block = `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``;
      if (contextLength + block.length > MAX_CONTEXT_LENGTH) {
        // Truncate this file
        const remaining = MAX_CONTEXT_LENGTH - contextLength;
        if (remaining > 200) {
          const truncated = f.content.slice(0, remaining - 100);
          fileBlocks.push(`### File: ${f.path}\n\`\`\`\n${truncated}\n…(truncated)\n\`\`\``);
        }
        break;
      }
      fileBlocks.push(block);
      contextLength += block.length;
    }

    const prompt = `## TASK ASSIGNMENT

**Task ID:** ${task.taskId}
**Title:** ${task.title}
**Objective:** ${task.objective}
**Acceptance Criteria:**
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## FILES READ FROM CODEBASE

${fileBlocks.join("\n\n")}

## INSTRUCTIONS

${systemPrompt}

Jawab dalam Bahasa Indonesia. Berikan analisis yang detail dan terstruktur.`;

    const inferenceSignal = AbortSignal.timeout(WORKER_INFERENCE_TIMEOUT_MS);
    const completion = await withTimeout(
      ollamaService.generateCompletion(
        prompt,
        composeSovereignSystemPrompt(systemPrompt),
        INFERENCE_MODEL,
        {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 768,
        },
        inferenceSignal,
      ),
      WORKER_INFERENCE_TIMEOUT_MS,
      `Worker LLM analysis timed out after ${WORKER_INFERENCE_TIMEOUT_MS}ms`,
    );
    const inferenceMs = Math.round(performance.now() - inferenceStart);

    // T-043: Record runtime arena event (non-blocking, advisory only)
    recordRuntimeEvent(
      INFERENCE_MODEL,
      task.phase,
      inferenceMs,
      {
        taskId: task.taskId,
        agentRole: task.assignedAgent,
        outcome: "success",
        source: "worker-executor",
      },
    ).catch(() => {}); // fire-and-forget, never blocks worker

    return {
      output: completion.response || "[LLM returned empty response]",
      inferenceMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM error";
    const inferenceMs = Math.round(performance.now() - inferenceStart);
    console.error(`[Colony:Worker] LLM analysis failed:`, err);

    recordRuntimeEvent(
      INFERENCE_MODEL,
      task.phase,
      inferenceMs,
      {
        taskId: task.taskId,
        agentRole: task.assignedAgent,
        outcome: "failed",
        source: "worker-executor",
        errorCode: classifyRuntimeError(err),
      },
    ).catch(() => {});

    // Fallback: provide file summary without LLM
    const fileSummary = files.map((f) => {
      const lineCount = f.content.split("\n").length;
      return `• ${f.path} (${lineCount} lines)`;
    }).join("\n");

    return {
      output: `⚠️ LLM analysis unavailable (${msg}). File summary:\n\n${fileSummary}\n\nManual review required.`,
      inferenceMs,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function classifyRuntimeError(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("timed out") || msg.includes("timeout")) return "timeout";
  if (msg.includes("connection") || msg.includes("econnrefused") || msg.includes("fetch failed")) return "connection";
  if (msg.includes("empty response")) return "empty_response";
  return "llm_error";
}

function extractKeyTerms(text: string): string[] {
  // Extract meaningful words (skip common words)
  const stopWords = new Set([
    "dan", "atau", "yang", "di", "ke", "dari", "untuk", "dengan",
    "ini", "itu", "the", "and", "or", "to", "from", "for", "with",
    "is", "are", "was", "were", "be", "been", "task", "buat", "buatan",
    "in", "of", "a", "an", "on", "at", "by", "as",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Deduplicate
  return [...new Set(words)].slice(0, 5);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

// ── C5B-2: Patch Proposal Generation ────────────────────────────────────────

/**
 * Attempt to parse a PATCH_PROPOSAL JSON block from LLM analysis output
 * and submit it via patch-engine.
 *
 * This is called only for builder agents after analysis.
 * The LLM is prompted to include a <PATCH_PROPOSAL>...</PATCH_PROPOSAL> block
 * if it identifies a specific, implementable code change.
 *
 * Failures here are non-fatal — the task still moves to review.
 */
async function tryGeneratePatchProposal(
  task: ColonyTask,
  agentName: string,
  analysisOutput: string,
  contextFiles: string[],
  searchQueries: string[],
  roomId: string,
): Promise<void> {
  // Extract PATCH_PROPOSAL block from analysis
  const patchMatch = analysisOutput.match(/<PATCH_PROPOSAL>([\s\S]*?)<\/PATCH_PROPOSAL>/);
  if (!patchMatch) {
    // No patch proposal in this analysis — that's fine
    console.log(`[Colony:Worker] Builder found no patch proposal for task ${task.taskId}`);
    return;
  }

  let proposalData: {
    title?: string;
    rationale?: string;
    estimatedRisk?: string;
    trainingDataTags?: string[];
    hunks?: PatchHunk[];
  };

  try {
    const rawJson = patchMatch[1];
    if (!rawJson) {
      console.warn(`[Colony:Worker] PATCH_PROPOSAL regex matched but group is empty for task ${task.taskId}`);
      return;
    }
    proposalData = JSON.parse(rawJson.trim()) as typeof proposalData;
  } catch (parseErr) {
    console.warn(`[Colony:Worker] Failed to parse PATCH_PROPOSAL JSON for task ${task.taskId}:`, parseErr);
    return;
  }

  // Validate required fields
  if (
    !proposalData.title ||
    !proposalData.rationale ||
    !Array.isArray(proposalData.hunks) ||
    proposalData.hunks.length === 0
  ) {
    console.warn(`[Colony:Worker] PATCH_PROPOSAL missing required fields for task ${task.taskId}`);
    return;
  }

  const estimatedRisk = (["low", "medium", "high"].includes(proposalData.estimatedRisk ?? ""))
    ? (proposalData.estimatedRisk as "low" | "medium" | "high")
    : "medium";

  try {
    const proposal = await submitProposal({
      taskId: task.taskId,
      agentRole: task.assignedAgent,
      agentName,
      title: proposalData.title,
      rationale: proposalData.rationale,
      hunks: proposalData.hunks,
      estimatedRisk,
      contextFiles,
      searchQueries,
      evidenceSummary: analysisOutput.split("<PATCH_PROPOSAL>")[0]?.trim() ?? "",
      trainingDataTags: proposalData.trainingDataTags ?? [],
    });

    // Notify founder in chat
    await chatEngine.sendMessage({
      roomId,
      senderId: task.assignedAgent,
      senderRole: task.assignedAgent,
      senderName: agentName,
      content: [
        `🔧 **Patch Proposal Diajukan**`,
        ``,
        formatProposalSummary(proposal),
        ``,
        `Founder dapat review dan approve:`,
        `\`/patch-view ${proposal.proposalId}\``,
        `\`/patch-approve ${proposal.proposalId}\``,
        `\`/patch-reject ${proposal.proposalId} [alasan]\``,
      ].join("\n"),
      messageType: "agent_update",
      linkedTaskId: task.taskId,
    });

    console.log(`[Colony:Worker] Builder submitted patch proposal ${proposal.proposalId} for task ${task.taskId}`);

  } catch (err) {
    if (err instanceof PatchEngineError && err.code === "HUNK_MISMATCH") {
      console.warn(
        `[Colony:Worker] Patch proposal rejected (HUNK_MISMATCH) for task ${task.taskId}: ${err.message}`,
      );
      // Notify founder of the hallucination attempt
      await chatEngine.sendMessage({
        roomId,
        senderId: task.assignedAgent,
        senderRole: task.assignedAgent,
        senderName: agentName,
        content: `⚠️ Builder mengusulkan patch untuk task **${task.taskId}** namun hunk tidak cocok dengan file aktual (HUNK_MISMATCH). Proposal ditolak secara otomatis.`,
        messageType: "agent_update",
        linkedTaskId: task.taskId,
      });
    } else {
      console.warn(`[Colony:Worker] Patch proposal failed for task ${task.taskId}:`, err);
    }
  }
}
