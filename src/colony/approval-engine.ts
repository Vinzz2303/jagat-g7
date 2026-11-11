// ============================================================================
// JAGAT Colony — Approval Engine
// Manajemen approval requests untuk founder
// ============================================================================

import { getRedisClient } from "../services/redis.service.js";
import { type ApprovalRequest, REDIS_KEYS } from "./types.js";

// ── ID Generator ────────────────────────────────────────────────────────────

async function nextApprovalId(): Promise<string> {
  const redis = getRedisClient();
  const seq = await redis.incr(REDIS_KEYS.approvalSequence());
  return `APPROVAL-${Date.now().toString(36)}-${seq}`;
}

// ── Approval CRUD ───────────────────────────────────────────────────────────

export async function createApproval(params: {
  taskId: string;
  requestedBy: string;
  type: ApprovalRequest["type"];
  description: string;
}): Promise<ApprovalRequest> {
  const redis = getRedisClient();
  const approvalId = await nextApprovalId();
  const now = new Date().toISOString();

  const approval: ApprovalRequest = {
    approvalId,
    taskId: params.taskId,
    requestedBy: params.requestedBy,
    requestedAt: now,
    type: params.type,
    description: params.description,
    status: "pending",
  };

  await redis.set(REDIS_KEYS.approval(approvalId), JSON.stringify(approval));
  await redis.sadd(REDIS_KEYS.pendingApprovals(), approvalId);

  return approval;
}

export async function getApproval(approvalId: string): Promise<ApprovalRequest | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.approval(approvalId));
  return data ? (JSON.parse(data) as ApprovalRequest) : null;
}

export async function respondToApproval(
  approvalId: string,
  response: "approved" | "rejected",
  respondedBy: string,
  note?: string,
): Promise<ApprovalRequest> {
  const redis = getRedisClient();
  const approval = await getApproval(approvalId);
  if (!approval) throw new Error(`Approval ${approvalId} not found`);
  if (approval.status !== "pending") throw new Error(`Approval ${approvalId} already ${approval.status}`);

  approval.status = response;
  approval.respondedAt = new Date().toISOString();
  approval.respondedBy = respondedBy;
  approval.responseNote = note;

  await redis.set(REDIS_KEYS.approval(approvalId), JSON.stringify(approval));
  await redis.srem(REDIS_KEYS.pendingApprovals(), approvalId);

  return approval;
}

export async function listPendingApprovals(): Promise<ApprovalRequest[]> {
  const redis = getRedisClient();
  const ids = await redis.smembers(REDIS_KEYS.pendingApprovals());

  const approvals: ApprovalRequest[] = [];
  for (const id of ids) {
    const a = await getApproval(id);
    // Double-check status in case srem failed during respondToApproval
    if (a && a.status === "pending") approvals.push(a);
  }

  return approvals.sort((a, b) =>
    new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime(),
  );
}
