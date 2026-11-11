// ============================================================================
// JAGAT Colony — Directive Engine
// Interprets natural language founder directives into structured task proposals.
//
// Flow:
// 1. Detect if message is addressed to a colony role
// 2. Query sovereign memory for relevant context
// 3. Use Ollama LLM to generate structured task proposals (JSON)
// 4. Store drafts in Redis with TTL
// 5. Founder approves/rejects drafts via /approve-draft or /reject-draft
//
// C5A-2: Governance guard — LLM proposals are ALWAYS drafts, never auto-created.
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import { ollamaService } from "../services/ollama.js";
import { memoryReader, auditEngine } from "./index.js";
import { getPlannerLessonContext } from "./lesson-engine.js";
import { composeSovereignSystemPrompt } from "../prompts/identity.js";
import { env } from "../config/index.js";
import type { AgentRole, PlannerLessonContext } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface TaskProposal {
  title: string;
  objective: string;
  assignedAgent: AgentRole;
  priority: "critical" | "high" | "medium" | "low";
  acceptanceCriteria: string[];
  reasoning: string;
}

export interface DraftBatch {
  draftId: string;
  proposals: TaskProposal[];
  directive: string;
  targetRole: string;
  contextFragments: number;
  lessonContextFragments?: number;
  lessonIdsUsed?: string[];
  createdBy: string;
  createdAt: string;
  status: "pending" | "approved" | "partially_approved" | "rejected" | "expired";
}

export interface DirectiveDetection {
  isDirective: boolean;
  targetRole: AgentRole | null;
  content: string;  // cleaned content without the role prefix
}

export interface DirectiveResult {
  detected: boolean;
  targetRole: AgentRole | null;
  draftId: string | null;
  proposals: TaskProposal[];
  contextUsed: number;
  lessonContextUsed: number;
  lessonIdsUsed: string[];
  inferenceMs: number;
  error?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const VALID_ROLES: AgentRole[] = ["director", "planner", "researcher", "builder", "reviewer", "reporter"];

const DRAFT_TTL_SECONDS = 30 * 60; // 30 minutes
const DRAFT_KEY_PREFIX = "colony:draft:";
const DRAFT_INDEX_KEY = "colony:draft:index";
const INFERENCE_MODEL = env.INFERENCE_MODEL ?? "llama3";

// ── Role Detection Patterns ─────────────────────────────────────────────────

const ROLE_ALIASES: Record<string, AgentRole> = {
  // English
  director: "director",
  planner: "planner",
  architect: "planner",
  researcher: "researcher",
  research: "researcher",
  builder: "builder",
  coder: "builder",
  developer: "builder",
  reviewer: "reviewer",
  qa: "reviewer",
  reporter: "reporter",
  ops: "reporter",
  // Indonesian
  direktur: "director",
  perencana: "planner",
  arsitek: "planner",
  peneliti: "researcher",
  riset: "researcher",
  pembangun: "builder",
  peninjau: "reviewer",
  pelapor: "reporter",
};

/**
 * Detect if a message is a directive addressed to a colony role.
 *
 * Patterns:
 *   "Director, buat 3 task..."
 *   "Builder tolong implement..."
 *   "@planner breakdown roadmap..."
 *   "Arahan: fokuskan colony ke..."
 */
export function detectDirective(content: string): DirectiveDetection {
  const trimmed = content.trim();

  // Skip if it's a / command
  if (trimmed.startsWith("/")) {
    return { isDirective: false, targetRole: null, content: trimmed };
  }

  // Pattern 1: "Role, <directive>" or "Role: <directive>"
  const commaMatch = trimmed.match(/^(\w+)[,:]\s+(.+)/s);
  if (commaMatch) {
    const role = resolveRole(commaMatch[1]!);
    if (role) {
      return { isDirective: true, targetRole: role, content: commaMatch[2]! };
    }
  }

  // Pattern 2: "@role <directive>"
  const atMatch = trimmed.match(/^@(\w+)\s+(.+)/s);
  if (atMatch) {
    const role = resolveRole(atMatch[1]!);
    if (role) {
      return { isDirective: true, targetRole: role, content: atMatch[2]! };
    }
  }

  // Pattern 3: "Role tolong <directive>"
  const tolongMatch = trimmed.match(/^(\w+)\s+tolong\s+(.+)/si);
  if (tolongMatch) {
    const role = resolveRole(tolongMatch[1]!);
    if (role) {
      return { isDirective: true, targetRole: role, content: tolongMatch[2]! };
    }
  }

  // Pattern 4: "Arahan: <directive>" (defaults to director)
  const arahanMatch = trimmed.match(/^arahan[:\s]+(.+)/si);
  if (arahanMatch) {
    return { isDirective: true, targetRole: "director", content: arahanMatch[1]! };
  }

  return { isDirective: false, targetRole: null, content: trimmed };
}

function resolveRole(input: string): AgentRole | null {
  const normalized = input.toLowerCase().trim();
  return ROLE_ALIASES[normalized] ?? null;
}

// ── Directive Interpreter ───────────────────────────────────────────────────

/**
 * Interpret a detected directive using LLM + sovereign memory.
 * Returns structured task proposals as drafts.
 */
export async function interpretDirective(
  directive: string,
  targetRole: AgentRole,
  actor: string,
  roomId: string,
): Promise<DirectiveResult> {
  const result: DirectiveResult = {
    detected: true,
    targetRole,
    draftId: null,
    proposals: [],
    contextUsed: 0,
    lessonContextUsed: 0,
    lessonIdsUsed: [],
    inferenceMs: 0,
  };

  try {
    // Step 1: Query memory for context
    const ctx = await memoryReader.queryColonyContext(directive, {
      limit: 5,
    });
    result.contextUsed = ctx.fragments.length;

    // Step 2: Retrieve prior mission lessons as advisory-only planner context
    const lessonContext = await getPlannerLessonContext({
      directive,
      limit: 3,
    });
    result.lessonContextUsed = lessonContext.lessons.length;
    result.lessonIdsUsed = lessonContext.lessons.map((lesson) => lesson.lessonId);

    // Step 3: Build LLM prompt
    const prompt = buildDirectivePrompt(directive, targetRole, ctx, lessonContext);

    // Step 4: LLM inference
    const inferenceStart = performance.now();
    const completion = await ollamaService.generateCompletion(
      prompt,
      composeSovereignSystemPrompt(DIRECTIVE_SYSTEM_PROMPT),
      INFERENCE_MODEL,
      {
        temperature: 0.2,  // Low temp for structured output
        top_p: 0.9,
        num_predict: 2048,
      },
    );
    result.inferenceMs = Math.round(performance.now() - inferenceStart);

    // Step 5: Parse JSON proposals from LLM output
    const proposals = parseProposals(completion.response);
    if (proposals.length === 0) {
      result.error = "LLM tidak menghasilkan task proposals yang valid.";
      return result;
    }
    result.proposals = proposals;

    // Step 6: Store draft batch in Redis
    const draftId = `DRAFT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const batch: DraftBatch = {
      draftId,
      proposals,
      directive,
      targetRole,
      contextFragments: ctx.fragments.length,
      lessonContextFragments: lessonContext.lessons.length,
      lessonIdsUsed: result.lessonIdsUsed,
      createdBy: actor,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    const redis = getRedisClient();
    await redis.set(
      `${DRAFT_KEY_PREFIX}${draftId}`,
      JSON.stringify(batch),
      "EX",
      DRAFT_TTL_SECONDS,
    );
    await redis.sadd(DRAFT_INDEX_KEY, draftId);

    result.draftId = draftId;

    // Audit
    await auditEngine.emitAudit({
      actor,
      actorRole: "founder",
      action: "directive.interpret",
      resource: `draft:${draftId}`,
      detail: {
        directive,
        targetRole,
        proposalCount: proposals.length,
        contextFragments: ctx.fragments.length,
        lessonContextFragments: lessonContext.lessons.length,
        lessonIdsUsed: result.lessonIdsUsed,
        inferenceMs: result.inferenceMs,
        roomId,
      },
    });

    console.log(
      `[Colony:Directive] Interpreted "${directive.slice(0, 50)}..." → ${proposals.length} proposals (draft: ${draftId}, memory: ${ctx.fragments.length}, lessons: ${lessonContext.lessons.length}, inference: ${result.inferenceMs}ms)`,
    );

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error during directive interpretation";
    console.error(`[Colony:Directive] Failed:`, err);
    return result;
  }
}

// ── Draft Management ────────────────────────────────────────────────────────

export async function getDraft(draftId: string): Promise<DraftBatch | null> {
  const redis = getRedisClient();
  const data = await redis.get(`${DRAFT_KEY_PREFIX}${draftId}`);
  return data ? (JSON.parse(data) as DraftBatch) : null;
}

export async function updateDraftStatus(
  draftId: string,
  status: DraftBatch["status"],
): Promise<void> {
  const redis = getRedisClient();
  const draft = await getDraft(draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found or expired`);
  }

  draft.status = status;
  await redis.set(
    `${DRAFT_KEY_PREFIX}${draftId}`,
    JSON.stringify(draft),
    "EX",
    DRAFT_TTL_SECONDS,
  );
}

export async function listPendingDrafts(): Promise<DraftBatch[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(DRAFT_INDEX_KEY);
  const drafts: DraftBatch[] = [];

  for (const id of ids) {
    const draft = await getDraft(id);
    if (draft && draft.status === "pending") {
      drafts.push(draft);
    } else if (!draft) {
      // Expired — remove from index
      await redis.srem(DRAFT_INDEX_KEY, id);
    }
  }

  return drafts;
}

// ── Format for Chat ─────────────────────────────────────────────────────────

export function formatProposalsForChat(result: DirectiveResult): string {
  if (result.error) {
    return `❌ Gagal menginterpretasi arahan: ${result.error}`;
  }

  if (result.proposals.length === 0) {
    return "⚠️ Tidak ada task proposals yang dihasilkan dari arahan ini.";
  }

  const lines = [
    `🧠 **Directive Interpretation** → ${result.proposals.length} task proposals`,
    `📎 Draft ID: \`${result.draftId}\` | ⏱️ ${result.inferenceMs}ms | 📚 ${result.contextUsed} memory docs | lessons ${result.lessonContextUsed}`,
    ``,
  ];

  for (let i = 0; i < result.proposals.length; i++) {
    const p = result.proposals[i]!;
    const priorityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[p.priority];
    lines.push(
      `**[${i + 1}] ${p.title}**`,
      `${priorityEmoji} ${p.priority} → **${p.assignedAgent}**`,
      `📋 ${p.objective}`,
      `✅ Criteria: ${p.acceptanceCriteria.join(" | ")}`,
      `💡 ${p.reasoning}`,
      ``,
    );
  }

  lines.push(
    `---`,
    `Untuk approve: \`/approve-draft ${result.draftId}\``,
    `Untuk approve sebagian: \`/approve-draft ${result.draftId} 1,3\``,
    `Untuk reject: \`/reject-draft ${result.draftId}\``,
    `⏳ Draft expires dalam 30 menit.`,
  );

  return lines.join("\n");
}

// ── LLM Prompt ──────────────────────────────────────────────────────────────

const DIRECTIVE_SYSTEM_PROMPT = `
Anda adalah AI Colony Director JAGAT G7, sistem eksekusi internal berdaulat.
Tugas Anda: menganalisis arahan founder dan menghasilkan task proposals terstruktur.
Output HARUS dalam format JSON yang valid. Tidak ada teks lain di luar JSON.
`.trim();

function buildDirectivePrompt(
  directive: string,
  targetRole: AgentRole,
  ctx: { fragments: Array<{ content: string; title: string; source: string; category: string; score: number }> },
  lessonContext: PlannerLessonContext,
): string {
  const contextBlock = ctx.fragments.length > 0
    ? ctx.fragments.map((f, i) =>
      `[Doc ${i + 1}] "${f.title}" (${f.category}, skor: ${(f.score * 100).toFixed(0)}%)\n${f.content}`,
    ).join("\n\n")
    : "Tidak ada konteks tambahan dari memori berdaulat.";

  const lessonBlock = lessonContext.lessons.length > 0
    ? lessonContext.lessons.map((lesson, i) =>
      `[Lesson ${i + 1}] ${lesson.lessonId} | ${lesson.category} | relevance ${lesson.relevanceScore}\n` +
      `Title: ${lesson.title}\n` +
      `Mission: ${lesson.missionId}\n` +
      `Reasons: ${lesson.relevanceReasons.join(", ")}\n` +
      `Content: ${lesson.content}`,
    ).join("\n\n")
    : "Tidak ada lesson advisory relevan dari mission sebelumnya.";

  return `
## ARAHAN FOUNDER

"${directive}"

Arahan ini ditujukan ke role: **${targetRole}**

## KONTEKS DARI MEMORI BERDAULAT

${contextBlock}

## LESSON ADVISORY DARI MISSION SEBELUMNYA

${lessonBlock}

## INSTRUKSI

Berdasarkan arahan founder, konteks memori, dan lesson advisory di atas:
1. Pecah arahan menjadi task-task yang konkret dan actionable
2. Assign setiap task ke agent yang paling tepat: director, planner, researcher, builder, reviewer, atau reporter
3. Tentukan prioritas: critical, high, medium, atau low
4. Berikan acceptance criteria yang measurable
5. Jelaskan reasoning kenapa task ini perlu

Gunakan lesson advisory hanya untuk:
- menghindari blocked pattern yang sama
- memperbaiki acceptance criteria
- memilih task investigasi lebih dulu bila ada gap yang pernah memblokir mission

Batasan:
- Maksimal 5 task
- Setiap task harus spesifik
- Jangan buat task redundan
- Jika konteks kurang, buat task "research" atau "investigasi" lebih dulu
- Lesson advisory bersifat advisory only
- Jangan membuat auto-replan, auto-retry, atau task otomatis hanya karena lesson ada
- Jangan menulis lesson ke Qdrant
- Semua hasil tetap berupa draft yang menunggu approval founder

## FORMAT OUTPUT (JSON ONLY)

Respond ONLY with a valid JSON array. No markdown, no explanation, JUST the JSON:

[
  {
    "title": "judul task singkat",
    "objective": "deskripsi objektif task",
    "assignedAgent": "builder",
    "priority": "high",
    "acceptanceCriteria": ["kriteria 1", "kriteria 2"],
    "reasoning": "alasan kenapa task ini diperlukan"
  }
]
`.trim();
}

// ── JSON Parser ─────────────────────────────────────────────────────────────

function parseProposals(llmOutput: string): TaskProposal[] {
  try {
    // Try to extract JSON from the response (LLM might wrap in markdown)
    let jsonStr = llmOutput.trim();

    // Remove markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1]!.trim();
    }

    // Find the JSON array
    const arrayStart = jsonStr.indexOf("[");
    const arrayEnd = jsonStr.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) {
      console.warn("[Colony:Directive] No JSON array found in LLM output");
      return [];
    }

    jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
    const parsed = JSON.parse(jsonStr) as unknown[];

    if (!Array.isArray(parsed)) return [];

    // Validate and sanitize each proposal
    const proposals: TaskProposal[] = [];
    for (const item of parsed) {
      if (!isValidProposal(item)) continue;
      const p = item as Record<string, unknown>;

      const assignedAgent = String(p.assignedAgent ?? "builder").toLowerCase();
      const validAgent = VALID_ROLES.includes(assignedAgent as AgentRole)
        ? (assignedAgent as AgentRole)
        : "builder";

      const priority = String(p.priority ?? "medium").toLowerCase();
      const validPriority = ["critical", "high", "medium", "low"].includes(priority)
        ? (priority as TaskProposal["priority"])
        : "medium";

      proposals.push({
        title: String(p.title).slice(0, 200),
        objective: String(p.objective).slice(0, 500),
        assignedAgent: validAgent,
        priority: validPriority,
        acceptanceCriteria: Array.isArray(p.acceptanceCriteria)
          ? (p.acceptanceCriteria as unknown[]).map(c => String(c).slice(0, 200)).slice(0, 5)
          : [String(p.acceptanceCriteria ?? "Task selesai")],
        reasoning: String(p.reasoning ?? "").slice(0, 300),
      });
    }

    return proposals.slice(0, 5); // Max 5 proposals
  } catch (err) {
    console.error("[Colony:Directive] JSON parse failed:", err);
    return [];
  }
}

function isValidProposal(item: unknown): boolean {
  if (typeof item !== "object" || item === null) return false;
  const p = item as Record<string, unknown>;
  return typeof p.title === "string" && p.title.length > 0;
}
