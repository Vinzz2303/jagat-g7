import { readFile } from "node:fs/promises";
import * as taskEngine from "./task-engine.js";
import { emitAudit } from "./audit-engine.js";
import { assessTaskAutonomyPolicy } from "./autonomous-policy.js";

export interface FounderOptedBacklogItem { id: string; title: string; risk: string; acceptanceCriteria: string; sourceOfTruth: string; }
const HIGH_RISK_BACKLOG_TERMS = /\b(?:auth|secret|token|credential|env|production|deploy|release|scheduler|worker|shell|command|script|migration|database|schema|payment|billing|security|delete|remove|config)\b/i;
const BUILDER_PROPOSAL_TAG = "founder-approved-low-risk-patch-proposal";
const BACKLOG_SOURCES = [
  { file: new URL("../../ops/TECHNICAL_BACKLOG.md", import.meta.url), path: "ops/TECHNICAL_BACKLOG.md" },
  { file: new URL("../../ops/PRODUCT_BACKLOG.md", import.meta.url), path: "ops/PRODUCT_BACKLOG.md" },
];

export function parseFounderOptedBacklog(markdown: string, sourceOfTruth: string): FounderOptedBacklogItem[] {
  const lines = markdown.split(/\r?\n/);
  const headerLine = lines.findIndex((line) => line.trim().startsWith("|") && line.trim().endsWith("|") && line.split("|").map((cell) => cell.trim().toLowerCase()).includes("id") && line.split("|").map((cell) => cell.trim().toLowerCase()).includes("status"));
  if (headerLine < 0) return [];
  const headers = lines[headerLine]!.split("|").map((cell) => cell.trim().toLowerCase());
  if (["id", "task", "risk", "risiko", "acceptance criteria", "status"].some((name) => headers.filter((header) => header === name).length > 1) || (headers.includes("risk") && headers.includes("risiko"))) return [];
  const column = (name: string) => headers.indexOf(name);
  const riskColumn = Math.max(column("risk"), column("risiko"));
  const required = [column("id"), column("task"), riskColumn, column("acceptance criteria"), column("status")];
  if (required.some((index) => index < 0)) return [];
  return lines.slice(headerLine + 2).flatMap((line) => {
    if (!line.trim().startsWith("|")) return [];
    const cells = line.split("|").map((cell) => cell.trim().replace(/`/g, ""));
    if (cells[column("status")] !== "Auto-Propose") return [];
    const item = { id: cells[column("id")] ?? "", title: cells[column("task")] ?? "", risk: cells[riskColumn] ?? "", acceptanceCriteria: cells[column("acceptance criteria")] ?? "", sourceOfTruth };
    return item.id && item.title && item.acceptanceCriteria ? [item] : [];
  });
}

export function isLowRiskBacklogItem(item: FounderOptedBacklogItem): boolean {
  const text = `${item.title} ${item.risk} ${item.acceptanceCriteria}`;
  return /^[A-Z]+-\d+[A-Z]?$/.test(item.id)
    && item.title.length <= 180 && item.risk.length <= 500 && item.acceptanceCriteria.length <= 1200
    && !HIGH_RISK_BACKLOG_TERMS.test(text);
}

export async function readFounderOptedBacklogItems(): Promise<FounderOptedBacklogItem[]> {
  const batches = await Promise.all(BACKLOG_SOURCES.map(async (source) =>
    parseFounderOptedBacklog(await readFile(source.file, "utf8"), source.path)));
  return batches.flat().filter(isLowRiskBacklogItem);
}

export async function createNextOptedBacklogTask(): Promise<string | null> {
  const items = await readFounderOptedBacklogItems();
  const { tasks } = await taskEngine.listTasks({ limit: 10000 });
  for (const item of items) {
    const backlogTag = `backlog:${item.id}`;
    if (tasks.some((task) => task.tags?.includes(backlogTag))) continue;
    const tags = [BUILDER_PROPOSAL_TAG, backlogTag];
    const objective = `Backlog ${item.id}: ${item.title}. Risk: ${item.risk}. Acceptance: ${item.acceptanceCriteria}`;
    if (assessTaskAutonomyPolicy({ assignedAgent: "builder", phase: "C6", priority: "low", title: item.title, objective, tags }).founderApprovalRequired) continue;
    const task = await taskEngine.createTask({ title: item.title, objective, phase: "C6", sourceOfTruth: item.sourceOfTruth, assignedAgent: "builder", priority: "low", acceptanceCriteria: [item.acceptanceCriteria], founderApprovalRequired: false, tags, createdBy: "c6-backlog-intake" });
    await emitAudit({ actor: "C6 Backlog Intake", actorRole: "system", action: "task.create", resource: `task:${task.taskId}`, detail: { backlogId: item.id, sourceOfTruth: item.sourceOfTruth } });
    return task.taskId;
  }
  return null;
}
