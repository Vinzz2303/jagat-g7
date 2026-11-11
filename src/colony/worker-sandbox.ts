// ============================================================================
// JAGAT Colony — Worker Sandbox
// Sandboxed filesystem adapter for controlled agent codebase access.
//
// C5B-0: This module is the ONLY legitimate path for colony agents to interact
// with the local filesystem. Direct `fs` usage by agents is forbidden.
//
// Security model:
//   1. ALLOWED_ROOTS whitelist — only listed directories are accessible
//   2. BLOCKED_PATTERNS — sensitive files are always denied
//   3. Permission check — agent role must have canReadCodebase/canSearchCodebase
//   4. Audit trail — every operation (success or denied) is logged
//   5. Size limits — files larger than MAX_FILE_SIZE are truncated
//
// C5B-0/C5B-1: Read-only operations only. No write operations.
// C5B-2+: Patch proposal will be added as a separate concern.
// ============================================================================

import { readFile as fsReadFile, readdir, stat } from "node:fs/promises";
import { join, resolve, relative, extname } from "node:path";
import { getRedisClient } from "../services/redis.service.js";
import {
  type AgentRole,
  type WorkerAction,
  type AgentPermission,
  DEFAULT_PERMISSIONS,
  REDIS_KEYS,
} from "./types.js";
import { emitAudit } from "./audit-engine.js";

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Role-scoped allowed roots.
 * Each agent role can only access directories appropriate to its function.
 *
 * builder/reviewer  → src/ only (code work, no strategic ops docs)
 * researcher/planner → src/ + ops/ (need strategy docs for context)
 * director/reporter  → no codebase access (canReadCodebase = false, blocked before here)
 */
const ALLOWED_ROOTS_BY_ROLE: Partial<Record<string, string[]>> = {
  builder:    ["c:/JAGAT/src", "c:/JAGAT/jagat-ui/src"].map(normalizePath),
  reviewer:   ["c:/JAGAT/src", "c:/JAGAT/jagat-ui/src"].map(normalizePath),
  researcher: ["c:/JAGAT/src", "c:/JAGAT/ops", "c:/JAGAT/jagat-ui/src"].map(normalizePath),
  planner:    ["c:/JAGAT/src", "c:/JAGAT/ops", "c:/JAGAT/jagat-ui/src"].map(normalizePath),
};

/** Fallback roots for any role not explicitly listed above */
const DEFAULT_ALLOWED_ROOTS = ["c:/JAGAT/src"].map(normalizePath);

/** Get allowed roots for a given role */
function getAllowedRoots(agentRole?: string): string[] {
  return (agentRole ? ALLOWED_ROOTS_BY_ROLE[agentRole] : undefined)
    ?? DEFAULT_ALLOWED_ROOTS;
}

/** Glob-like patterns that are always blocked, regardless of ALLOWED_ROOTS. */
const BLOCKED_PATTERNS = [
  ".env",
  ".git",
  "node_modules",
  "dist",
  "package-lock.json",
  "qdrant_data",
  "qdrant_storage",
  ".secret",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  "cookie-signer",   // cookie signing internals
  "auth.ts",         // auth module — internal secret handling
];

/** Binary extensions that cannot be meaningfully read as text */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".woff", ".woff2", ".ttf", ".eot",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".exe", ".dll", ".so", ".dylib",
]);

/** Maximum file size in bytes (100KB) */
const MAX_FILE_SIZE = 100 * 1024;

/** Maximum total bytes per task execution (500KB) */
const MAX_TASK_BYTES = 500 * 1024;

/** Maximum directory listing depth */
const MAX_DIR_DEPTH = 3;

/** Maximum files returned by directory listing */
const MAX_DIR_ENTRIES = 100;

// ── Types ───────────────────────────────────────────────────────────────────

export interface DirectoryEntry {
  name: string;
  path: string;         // relative to JAGAT root
  isDirectory: boolean;
  sizeBytes?: number;
  extension?: string;
}

export interface SearchResult {
  file: string;         // relative path
  line: number;
  content: string;      // the matching line
  matchStart: number;   // char index of match
}

export interface SandboxConfig {
  allowedRootsByRole: Partial<Record<string, string[]>>;
  defaultAllowedRoots: string[];
  blockedPatterns: string[];
  maxFileSize: number;
  maxTaskBytes: number;
}

// ── Path Security ───────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return resolve(p).replace(/\\/g, "/").toLowerCase();
}

function isWithinAllowedRoot(normalizedPath: string, root: string): boolean {
  return normalizedPath === root || normalizedPath.startsWith(`${root}/`);
}

/**
 * Validate that a path is within the agent's allowed roots and does not match BLOCKED_PATTERNS.
 * Returns normalized path if valid, throws SandboxError if not.
 *
 * agentRole is used to scope allowed roots per C5B-2 role-based access.
 */
function validatePath(rawPath: string, agentRole?: string): string {
  const normalized = normalizePath(rawPath);
  const allowedRoots = getAllowedRoots(agentRole);

  // Check against role-scoped allowed roots
  const isAllowed = allowedRoots.some((root) => isWithinAllowedRoot(normalized, root));
  if (!isAllowed) {
    throw new SandboxError(
      `Path outside allowed roots for role '${agentRole ?? "unknown"}': ${rawPath}`,
      "PATH_OUTSIDE_SANDBOX",
    );
  }

  // Check against blocked patterns
  const pathParts = normalized.split("/");
  const fileName = pathParts[pathParts.length - 1] ?? "";

  for (const pattern of BLOCKED_PATTERNS) {
    // Check filename match (exact or prefix for non-extension patterns)
    if (fileName === pattern.toLowerCase() ||
        (!pattern.includes(".") && fileName.startsWith(pattern.toLowerCase()))) {
      throw new SandboxError(
        `Blocked file pattern: ${pattern}`,
        "BLOCKED_PATTERN",
      );
    }
    // Check if any path segment matches
    if (pathParts.some((part) => part === pattern.toLowerCase())) {
      throw new SandboxError(
        `Blocked path segment: ${pattern}`,
        "BLOCKED_PATTERN",
      );
    }
    // Check extension match (for patterns like .key, .pem)
    if (pattern.startsWith(".") && fileName.endsWith(pattern.toLowerCase())) {
      throw new SandboxError(
        `Blocked file extension: ${pattern}`,
        "BLOCKED_PATTERN",
      );
    }
  }

  // Prevent path traversal
  if (normalized.includes("..")) {
    throw new SandboxError(
      "Path traversal detected",
      "PATH_TRAVERSAL",
    );
  }

  return normalized;
}

/**
 * Check that the agent role has the required permission.
 */
function assertPermission(
  agentRole: AgentRole,
  permission: keyof AgentPermission,
): void {
  const perms = DEFAULT_PERMISSIONS[agentRole];
  if (!perms[permission]) {
    throw new SandboxError(
      `Agent role '${agentRole}' lacks permission '${permission}'`,
      "PERMISSION_DENIED",
    );
  }
}

/** The canonical JAGAT project root (normalized). Used by patch-engine path resolution. */
export const JAGAT_ROOT = normalizePath("c:/JAGAT");

/**
 * Public path validator for patch-engine use.
 *
 * Accepts EITHER an absolute path OR a path relative to JAGAT_ROOT.
 * Resolves the path safely, then enforces:
 *   - no ../ traversal (via resolve + isWithinAllowedRoot)
 *   - role-scoped allowed roots
 *   - BLOCKED_PATTERNS
 *   - directory boundary (must be inside JAGAT_ROOT regardless of role)
 *
 * This is the SINGLE source of truth for path security in colony — both
 * sandbox reads and patch writes must pass through this function.
 *
 * @throws SandboxError with code PATH_OUTSIDE_SANDBOX | BLOCKED_PATTERN | PATH_TRAVERSAL
 */
export function validatePatchPath(rawPath: string, agentRole: string): string {
  // Resolve relative paths against JAGAT_ROOT first
  // Using node:path resolve: if rawPath is absolute, it wins; if relative, JAGAT_ROOT is base.
  // We then normalize to forward-slash lowercase for consistent comparison.
  const absoluteCandidate = rawPath.startsWith("/") || /^[a-z]:/i.test(rawPath)
    ? normalizePath(rawPath)
    : normalizePath(resolve("c:/JAGAT", rawPath));

  // Hard outer boundary: regardless of role, path must be inside JAGAT_ROOT
  if (!isWithinAllowedRoot(absoluteCandidate, JAGAT_ROOT)) {
    throw new SandboxError(
      `Path outside JAGAT root boundary: ${rawPath}`,
      "PATH_OUTSIDE_SANDBOX",
    );
  }

  // Now run full validatePath (role-scoped roots + BLOCKED_PATTERNS + traversal)
  return validatePath(absoluteCandidate, agentRole);
}

// ── Error Class ─────────────────────────────────────────────────────────────

export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PATH_OUTSIDE_SANDBOX"
      | "BLOCKED_PATTERN"
      | "PATH_TRAVERSAL"
      | "PERMISSION_DENIED"
      | "FILE_TOO_LARGE"
      | "TASK_BYTES_EXCEEDED"
      | "BINARY_FILE"
      | "NOT_FOUND"
      | "READ_ERROR",
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

// ── Task Byte Tracking ──────────────────────────────────────────────────────

const taskBytesTracker = new Map<string, number>();
const MAX_TRACKER_ENTRIES = 500;

function trackBytes(taskId: string, bytes: number): void {
  // Auto-cleanup old entries if tracker grows too large
  if (taskBytesTracker.size > MAX_TRACKER_ENTRIES) {
    const oldest = taskBytesTracker.keys().next().value;
    if (oldest) taskBytesTracker.delete(oldest);
  }

  const current = taskBytesTracker.get(taskId) ?? 0;
  const newTotal = current + bytes;
  if (newTotal > MAX_TASK_BYTES) {
    throw new SandboxError(
      `Task ${taskId} exceeded max bytes (${newTotal}/${MAX_TASK_BYTES})`,
      "TASK_BYTES_EXCEEDED",
    );
  }
  taskBytesTracker.set(taskId, newTotal);
}

export function resetTaskBytes(taskId: string): void {
  taskBytesTracker.delete(taskId);
}

export function getTaskBytesUsed(taskId: string): number {
  return taskBytesTracker.get(taskId) ?? 0;
}

// ── Worker Action Logging ───────────────────────────────────────────────────

let actionSeq = 0;

async function logWorkerAction(action: WorkerAction): Promise<void> {
  const redis = getRedisClient();

  // Store in task-specific list
  await redis.rpush(
    REDIS_KEYS.workerActions(action.taskId),
    JSON.stringify(action),
  );

  // Index for global queries
  await redis.sadd(REDIS_KEYS.workerActionIndex(), action.taskId);

  // Audit trail
  const auditAction = action.status === "denied" ? "worker.denied" as const : `worker.${action.type}` as const;
  await emitAudit({
    actor: `agent:${action.agentRole}`,
    actorRole: action.agentRole,
    action: auditAction,
    resource: `task:${action.taskId}`,
    detail: {
      actionId: action.actionId,
      type: action.type,
      target: action.target,
      status: action.status,
      resultSummary: action.resultSummary,
      bytesRead: action.bytesRead,
    },
  });
}

function createAction(
  taskId: string,
  agentRole: AgentRole,
  type: WorkerAction["type"],
  target: string,
): WorkerAction {
  actionSeq++;
  return {
    actionId: `WA-${Date.now().toString(36)}-${actionSeq}`,
    taskId,
    agentRole,
    type,
    target,
    status: "completed",
    timestamp: new Date().toISOString(),
  };
}

// ── Public API: Read-Only Operations ────────────────────────────────────────

/**
 * Read a file's contents. Returns the text content.
 * Validates path, checks permissions, logs action, enforces size limits.
 */
export async function readFile(
  path: string,
  taskId: string,
  agentRole: AgentRole,
): Promise<string> {
  const action = createAction(taskId, agentRole, "file_read", path);

  try {
    assertPermission(agentRole, "canReadCodebase");
    const validated = validatePath(path, agentRole);

    // Check for binary extension
    const ext = extname(validated).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      throw new SandboxError(`Binary file cannot be read as text: ${ext}`, "BINARY_FILE");
    }

    // Check file size
    const fileStat = await stat(validated).catch(() => null);
    if (!fileStat) {
      throw new SandboxError(`File not found: ${path}`, "NOT_FOUND");
    }
    if (fileStat.size > MAX_FILE_SIZE) {
      throw new SandboxError(
        `File too large: ${fileStat.size} bytes (max ${MAX_FILE_SIZE})`,
        "FILE_TOO_LARGE",
      );
    }

    // Track bytes
    trackBytes(taskId, fileStat.size);

    // Read file
    const content = await fsReadFile(validated, "utf-8");

    action.status = "completed";
    action.bytesRead = fileStat.size;
    action.resultSummary = `Read ${content.split("\n").length} lines, ${fileStat.size} bytes`;
    await logWorkerAction(action);

    console.log(`[Colony:Sandbox] ${agentRole} read ${path} (${fileStat.size}B) for task ${taskId}`);
    return content;
  } catch (err) {
    action.status = err instanceof SandboxError ? "denied" : "failed";
    action.resultSummary = err instanceof Error ? err.message : "Unknown error";
    await logWorkerAction(action);
    throw err;
  }
}

/**
 * Read specific line range from a file.
 */
export async function readLines(
  path: string,
  startLine: number,
  endLine: number,
  taskId: string,
  agentRole: AgentRole,
): Promise<string> {
  const action = createAction(taskId, agentRole, "read_lines", `${path}:${startLine}-${endLine}`);

  try {
    assertPermission(agentRole, "canReadCodebase");
    const validated = validatePath(path, agentRole);

    const ext = extname(validated).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      throw new SandboxError(`Binary file cannot be read as text: ${ext}`, "BINARY_FILE");
    }

    const fileStat = await stat(validated).catch(() => null);
    if (!fileStat) {
      throw new SandboxError(`File not found: ${path}`, "NOT_FOUND");
    }

    const content = await fsReadFile(validated, "utf-8");
    const lines = content.split("\n");
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    const selected = lines.slice(start, end).join("\n");

    const bytesRead = Buffer.byteLength(selected, "utf-8");
    trackBytes(taskId, bytesRead);

    action.status = "completed";
    action.bytesRead = bytesRead;
    action.resultSummary = `Read lines ${startLine}-${endLine} (${end - start} lines, ${bytesRead} bytes)`;
    await logWorkerAction(action);

    return selected;
  } catch (err) {
    action.status = err instanceof SandboxError ? "denied" : "failed";
    action.resultSummary = err instanceof Error ? err.message : "Unknown error";
    await logWorkerAction(action);
    throw err;
  }
}

/**
 * List directory contents (non-recursive, capped).
 */
export async function listDirectory(
  path: string,
  taskId: string,
  agentRole: AgentRole,
  depth: number = 1,
): Promise<DirectoryEntry[]> {
  const action = createAction(taskId, agentRole, "dir_list", path);

  try {
    assertPermission(agentRole, "canReadCodebase");
    const validated = validatePath(path, agentRole);
    const actualDepth = Math.min(depth, MAX_DIR_DEPTH);

    const entries = await listDirRecursive(validated, actualDepth, 0, agentRole);
    const capped = entries.slice(0, MAX_DIR_ENTRIES);

    action.status = "completed";
    action.resultSummary = `Listed ${capped.length} entries (depth ${actualDepth})`;
    await logWorkerAction(action);

    console.log(`[Colony:Sandbox] ${agentRole} listed ${path} → ${capped.length} entries for task ${taskId}`);
    return capped;
  } catch (err) {
    action.status = err instanceof SandboxError ? "denied" : "failed";
    action.resultSummary = err instanceof Error ? err.message : "Unknown error";
    await logWorkerAction(action);
    throw err;
  }
}

/**
 * Search for text pattern in files within a directory.
 * Simple line-by-line search — no regex for safety.
 */
export async function searchInFiles(
  query: string,
  directory: string,
  taskId: string,
  agentRole: AgentRole,
  options?: { maxResults?: number; caseSensitive?: boolean },
): Promise<SearchResult[]> {
  const action = createAction(taskId, agentRole, "search", `"${query}" in ${directory}`);

  try {
    assertPermission(agentRole, "canSearchCodebase");
    const validated = validatePath(directory, agentRole);
    const maxResults = options?.maxResults ?? 50;
    const caseSensitive = options?.caseSensitive ?? false;

    const results: SearchResult[] = [];
    await searchRecursive(
      validated,
      caseSensitive ? query : query.toLowerCase(),
      caseSensitive,
      results,
      maxResults,
      taskId,
      agentRole,
      0,
    );

    action.status = "completed";
    action.resultSummary = `Found ${results.length} matches for "${query}" in ${directory}`;
    await logWorkerAction(action);

    console.log(`[Colony:Sandbox] ${agentRole} searched "${query}" in ${directory} → ${results.length} results for task ${taskId}`);
    return results;
  } catch (err) {
    action.status = err instanceof SandboxError ? "denied" : "failed";
    action.resultSummary = err instanceof Error ? err.message : "Unknown error";
    await logWorkerAction(action);
    throw err;
  }
}

// ── Query Worker Actions ────────────────────────────────────────────────────

/**
 * Retrieve all worker actions for a task (for founder transparency).
 */
export async function getWorkerActions(taskId: string): Promise<WorkerAction[]> {
  const redis = getRedisClient();
  const raw = await redis.lrange(REDIS_KEYS.workerActions(taskId), 0, -1);
  return raw.map((r) => JSON.parse(r) as WorkerAction);
}

/**
 * Format worker actions as a readable report for the founder.
 */
export function formatWorkerReport(actions: WorkerAction[]): string {
  if (actions.length === 0) {
    return "📭 Tidak ada worker actions tercatat untuk task ini.";
  }

  const lines = [
    `🔧 **Worker Action Log** — ${actions.length} operations`,
    ``,
  ];

  for (const a of actions) {
    const statusEmoji = a.status === "completed" ? "✅" : a.status === "denied" ? "🚫" : "❌";
    const bytesStr = a.bytesRead ? ` (${a.bytesRead}B)` : "";
    lines.push(
      `${statusEmoji} \`${a.type}\` → ${a.target}${bytesStr}`,
      `   ${a.resultSummary ?? "no details"} — ${a.timestamp}`,
    );
  }

  return lines.join("\n");
}

/**
 * Get current sandbox configuration (for /sandbox-config command).
 */
export function getSandboxConfig(): SandboxConfig {
  return {
    allowedRootsByRole: { ...ALLOWED_ROOTS_BY_ROLE },
    defaultAllowedRoots: [...DEFAULT_ALLOWED_ROOTS],
    blockedPatterns: [...BLOCKED_PATTERNS],
    maxFileSize: MAX_FILE_SIZE,
    maxTaskBytes: MAX_TASK_BYTES,
  };
}

// ── Internal Helpers ────────────────────────────────────────────────────────

async function listDirRecursive(
  dir: string,
  maxDepth: number,
  currentDepth: number,
  agentRole?: string,
): Promise<DirectoryEntry[]> {
  if (currentDepth >= maxDepth) return [];

  const entries: DirectoryEntry[] = [];
  const dirEntries = await readdir(dir, { withFileTypes: true });

  for (const entry of dirEntries) {
    const fullPath = join(dir, entry.name);
    const normalized = normalizePath(fullPath);

    // Skip blocked paths silently
    try {
      validatePath(fullPath, agentRole);
    } catch {
      continue;
    }

    const jagRoot = normalizePath("c:/JAGAT");
    const relPath = relative(jagRoot, normalized).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      entries.push({
        name: entry.name,
        path: relPath,
        isDirectory: true,
      });

      // Recurse
      if (currentDepth + 1 < maxDepth) {
        const subEntries = await listDirRecursive(fullPath, maxDepth, currentDepth + 1, agentRole);
        entries.push(...subEntries);
      }
    } else {
      const fileStat = await stat(fullPath).catch(() => null);
      entries.push({
        name: entry.name,
        path: relPath,
        isDirectory: false,
        sizeBytes: fileStat?.size,
        extension: extname(entry.name),
      });
    }

    if (entries.length >= MAX_DIR_ENTRIES) break;
  }

  return entries;
}

async function searchRecursive(
  dir: string,
  query: string,
  caseSensitive: boolean,
  results: SearchResult[],
  maxResults: number,
  taskId: string,
  agentRole: string,
  depth: number,
): Promise<void> {
  if (depth > MAX_DIR_DEPTH || results.length >= maxResults) return;

  let dirEntries;
  try {
    dirEntries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // silently skip unreadable dirs
  }

  for (const entry of dirEntries) {
    if (results.length >= maxResults) break;

    const fullPath = join(dir, entry.name);

    // Skip blocked paths
    try {
      validatePath(fullPath, agentRole);
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      await searchRecursive(fullPath, query, caseSensitive, results, maxResults, taskId, agentRole, depth + 1);
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;

      // Check file size
      const fileStat = await stat(fullPath).catch(() => null);
      if (!fileStat || fileStat.size > MAX_FILE_SIZE) continue;
      trackBytes(taskId, fileStat.size);

      try {
        const content = await fsReadFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const jagRoot = normalizePath("c:/JAGAT");
        const relPath = relative(jagRoot, normalizePath(fullPath)).replace(/\\/g, "/");

        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i]!;
          const searchLine = caseSensitive ? line : line.toLowerCase();
          const matchIdx = searchLine.indexOf(query);

          if (matchIdx !== -1) {
            results.push({
              file: relPath,
              line: i + 1,
              content: line.trim().slice(0, 200), // cap line length
              matchStart: matchIdx,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}
