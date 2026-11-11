// ============================================================================
// JAGAT Colony — Notification Dispatcher
// Fans out colony events to external channels (WhatsApp group).
// ============================================================================

import * as whatsapp from "./whatsapp-adapter.js";
import * as email from "./email-adapter.js";

// ── Config ───────────────────────────────────────────────────────────────────

let waGroupJid = process.env.WA_GROUP_JID ?? "";
const WA_ENABLED = process.env.WA_ENABLED !== "false";

/** Set the target WhatsApp group JID at runtime (persisted in memory). */
export function setTargetGroup(jid: string): void {
  waGroupJid = jid;
  console.log(`[Dispatcher] Target group JID set to: ${jid}`);
}

/** Get current target group JID. */
export function getTargetGroup(): string {
  return waGroupJid;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = "whatsapp" | "internal" | "email";

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  /** Optional: override group JID (default: WA_GROUP_JID from env) */
  groupJid?: string;
  /** Which channels to send to (default: all enabled) */
  channels?: NotificationChannel[];
  /** Email specific options */
  emailTo?: string | string[];
  emailSubject?: string;
  emailHtml?: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a notification to configured channels.
 * Currently supports WhatsApp group. Can be extended for Telegram, email, etc.
 */
export async function dispatchNotification(payload: NotificationPayload): Promise<NotificationResult[]> {
  const channels = payload.channels ?? ["whatsapp"];
  const results: NotificationResult[] = [];

  for (const channel of channels) {
    switch (channel) {
      case "whatsapp":
        results.push(await dispatchWhatsApp(payload));
        break;
      case "email":
        results.push(await dispatchEmail(payload));
        break;
      default:
        results.push({ channel, success: false, error: `Unknown channel: ${channel}` });
    }
  }

  return results;
}

/**
 * Convenience: dispatch a colony reporter summary to WhatsApp group.
 */
export async function dispatchReporterSummary(summary: string, cadence: "daily" | "weekly" | "heartbeat"): Promise<NotificationResult> {
  const title = cadence === "daily" ? "📊 Daily Colony Brief" : cadence === "weekly" ? "📈 Weekly Colony Readout" : "💓 JAGAT Heartbeat";
  // Heartbeat summary is already formatted for WhatsApp (short, with bold markers)
  const body = cadence === "heartbeat" ? summary : formatForWhatsApp(title, summary);

  return dispatchWhatsApp({ title, body });
}

/**
 * Convenience: dispatch a task status change notification.
 */
export async function dispatchTaskNotification(
  taskId: string,
  event: string,
  detail?: string
): Promise<NotificationResult> {
  const body = `🔧 *Task ${taskId}*\n${event}${detail ? `\n${detail}` : ""}`;
  return dispatchWhatsApp({ title: "Task Update", body });
}

/**
 * Convenience: dispatch an approval request notification.
 */
export async function dispatchApprovalRequest(
  approvalId: string,
  taskId: string,
  summary: string
): Promise<NotificationResult> {
  const body = `⚠️ *Approval Required*\nTask: ${taskId}\nApproval: ${approvalId}\n${summary}`;
  return dispatchWhatsApp({ title: "Approval Request", body });
}

/**
 * Convenience: dispatch a critical alert.
 */
export async function dispatchAlert(message: string): Promise<NotificationResult> {
  const body = `🚨 *JAGAT Alert*\n${message}`;
  return dispatchWhatsApp({ title: "Alert", body });
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function dispatchWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
  if (!WA_ENABLED) {
    return { channel: "whatsapp", success: false, error: "WhatsApp disabled (WA_ENABLED=false)" };
  }

  const groupJid = payload.groupJid ?? waGroupJid;
  if (!groupJid) {
    return { channel: "whatsapp", success: false, error: "No group JID configured (WA_GROUP_JID)" };
  }

  const status = whatsapp.getWhatsAppStatus();
  if (!status.connected) {
    return { channel: "whatsapp", success: false, error: "WhatsApp not connected" };
  }

  const sendResult = await whatsapp.sendToGroup(groupJid, payload.body);
  return { channel: "whatsapp", success: sendResult.success, error: sendResult.error };
}

async function dispatchEmail(payload: NotificationPayload): Promise<NotificationResult> {
  if (!payload.emailTo) {
    return { channel: "email", success: false, error: "No emailTo specified in payload" };
  }

  const subject = payload.emailSubject || payload.title;
  
  // Format body to HTML if no explicit HTML was provided
  const html = payload.emailHtml || `<p><b>${payload.title}</b></p><p>${payload.body.replace(/\n/g, '<br/>')}</p>`;
  
  const sendResult = await email.sendEmail({
    to: payload.emailTo,
    subject: subject,
    text: payload.body,
    html: html
  });

  return { channel: "email", success: sendResult.success, error: sendResult.error };
}

/**
 * Format a markdown summary for WhatsApp (strip unsupported markdown, add bold).
 */
function formatForWhatsApp(title: string, summary: string): string {
  // Convert ## headers to bold
  let formatted = summary
    .replace(/^##\s+(.+)$/gm, "*$1*")
    .replace(/^###\s+(.+)$/gm, "*$1*")
    // Convert markdown links to plain text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Convert code blocks to monospace
    .replace(/```(\w*)\n([\s\S]*?)```/g, "```$2```")
    // Trim excessive newlines
    .replace(/\n{3,}/g, "\n\n");

  return `${title}\n\n${formatted}`;
}
