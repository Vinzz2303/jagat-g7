import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const FRESHNESS_LIMIT_MS = 6 * 60 * 60 * 1000;
export const SCHEDULE_GRACE_MS = 5 * 60 * 1000;
const SCHEDULE_INTERVAL_MS = 3 * 60 * 60 * 1000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revenue = path.join(root, 'ops/revenue');
export function normalizeScheduledTask(raw) {
  try {
    const task = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!task || typeof task !== 'object') throw new Error('invalid task status');
    const result = task.LastTaskResult;
    const lastTaskResult = result !== null && result !== undefined && String(result).trim() !== '' && Number.isFinite(Number(result)) ? Number(result) : null;
    return { status: 'AVAILABLE', state: String(task.State || 'UNKNOWN'), lastRunTime: task.LastRunTime || null, lastTaskResult, nextRunTime: task.NextRunTime || null };
  } catch { return { status: 'UNAVAILABLE', state: null, lastRunTime: null, lastTaskResult: null, nextRunTime: null }; }
}

function readScheduledTaskStatus() {
  if (process.platform !== 'win32') return normalizeScheduledTask(null);
  const command = "$task=Get-ScheduledTask -TaskName 'JAGAT Autonomous Revenue Agent V1' -ErrorAction Stop; $info=$task | Get-ScheduledTaskInfo; $next=$null; if($info.NextRunTime){$next=$info.NextRunTime.ToString('o')}; [ordered]@{State=[string]$task.State;LastRunTime=$(if($info.LastRunTime){$info.LastRunTime.ToString('o')}else{$null});LastTaskResult=[int]$info.LastTaskResult;NextRunTime=$next} | ConvertTo-Json -Compress";
  try { return normalizeScheduledTask(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: 4000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch { return normalizeScheduledTask(null); }
}

export function parseJsonl(raw) {
  raw = raw.replace(/^\uFEFF/, '');
  if (!raw.trim()) return { events: [], status: 'EMPTY' };
  if (!raw.includes('\n') && !raw.includes('\r')) {
    try { const value = JSON.parse(raw); return { events: Array.isArray(value) ? value : [value], status: 'OK' }; }
    catch { return { events: [], status: 'UNKNOWN' }; }
  }
  const events = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try { events.push(JSON.parse(line)); }
    catch { return { events: [], status: 'UNKNOWN' }; }
  }
  return { events, status: 'OK' };
}

function lastEvent(events, eventType) {
  const matching = events.filter(event => event.event_type === eventType && Number.isFinite(Date.parse(event.sent_at)));
  // Append order resolves equal timestamps (ATTEMPTED and outcome can share a millisecond).
  matching.reverse().sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at));
  return matching[0] ? { status: matching[0].status || 'UNKNOWN', sentAt: matching[0].sent_at } : { status: 'UNKNOWN', sentAt: null };
}

function artifactStatus(timestamp, now) {
  if (!Number.isFinite(timestamp)) return { status: 'MISSING', ageMinutes: null };
  const ageMs = now - timestamp;
  if (ageMs < 0) return { status: 'UNKNOWN', ageMinutes: null };
  return { status: ageMs <= FRESHNESS_LIMIT_MS ? 'FRESH' : 'STALE', ageMinutes: Math.floor(ageMs / 60000) };
}

export function buildRevenueStatusSnapshot({ artifactTimes = {}, telegramRaw = '', sendRaw = '', scheduledTask = normalizeScheduledTask(null), now = Date.now() }) {
  const artifacts = Object.fromEntries(['latest-prospect-discovery.md', 'latest-revenue-brief.md', 'OUTREACH_DRAFTS.json', 'OUTREACH_APPROVAL_INBOX.md'].map(name => [name, artifactStatus(artifactTimes[name], now)]));
  const telegram = parseJsonl(telegramRaw);
  const send = parseJsonl(sendRaw);
  const counts = { attempted: 0, sent: 0, failed: 0, unknown: 0 };
  const otherStatuses = {};
  let newestSendAt = null;
  for (const event of send.events) {
    if (Object.hasOwn(counts, event.status)) counts[event.status]++;
    else if (typeof event.status === 'string' && event.status) otherStatuses[event.status] = (otherStatuses[event.status] || 0) + 1;
    if (Number.isFinite(Date.parse(event.ts)) && (!newestSendAt || Date.parse(event.ts) > Date.parse(newestSendAt))) newestSendAt = event.ts;
  }
  const notifications = telegram.status === 'OK' ? { brief: lastEvent(telegram.events, 'REVENUE_BRIEF'), draftBatch: lastEvent(telegram.events, 'EMAIL_DRAFT_BATCH') } : { brief: { status: 'UNKNOWN', sentAt: null }, draftBatch: { status: 'UNKNOWN', sentAt: null } };
  const artifactDegraded = Object.values(artifacts).some(item => item.status !== 'FRESH');
  const lastRunAt = Date.parse(scheduledTask.lastRunTime);
  const nextRunAt = Date.parse(scheduledTask.nextRunTime);
  const schedulerLate = !Number.isFinite(nextRunAt) || now > nextRunAt + SCHEDULE_GRACE_MS || !Number.isFinite(lastRunAt) || now - lastRunAt > SCHEDULE_INTERVAL_MS + SCHEDULE_GRACE_MS;
  const schedulerDegraded = scheduledTask.status !== 'AVAILABLE' || !['Ready', 'Running'].includes(scheduledTask.state) || scheduledTask.lastTaskResult !== 0 || schedulerLate;
  const overall = artifactDegraded || telegram.status !== 'OK' || notifications.brief.status !== 'DELIVERED' || notifications.draftBatch.status !== 'DELIVERED' || schedulerDegraded ? 'DEGRADED' : 'HEALTHY';
  return {
    overall,
    artifacts,
    notifications,
    notificationLedger: telegram.status,
    scheduledCycle: scheduledTask,
    outreach: { ledger: send.status === 'UNKNOWN' ? 'UNKNOWN' : send.status, health: send.status === 'UNKNOWN' ? 'UNKNOWN' : counts.failed > 0 || counts.unknown > 0 ? 'ATTENTION' : 'OK', counts: send.status === 'UNKNOWN' ? null : counts, otherStatuses: send.status === 'UNKNOWN' ? null : otherStatuses, newestEventAt: send.status === 'UNKNOWN' ? null : newestSendAt },
  };
}

async function readArtifactTime(name) {
  try { return (await fs.stat(path.join(revenue, name))).mtimeMs; }
  catch { return undefined; }
}

export async function readRevenueStatusSnapshot(now = Date.now()) {
  const [discovery, brief, drafts, inbox, telegramRaw, sendRaw] = await Promise.all([
    readArtifactTime('latest-prospect-discovery.md'), readArtifactTime('latest-revenue-brief.md'),
    readArtifactTime('OUTREACH_DRAFTS.json'), readArtifactTime('OUTREACH_APPROVAL_INBOX.md'),
    fs.readFile(path.join(revenue, 'telegram-events.jsonl'), 'utf8').catch(() => ''),
    fs.readFile(path.join(revenue, 'outreach-send-ledger.jsonl'), 'utf8').catch(() => ''),
  ]);
  return buildRevenueStatusSnapshot({ artifactTimes: { 'latest-prospect-discovery.md': discovery, 'latest-revenue-brief.md': brief, 'OUTREACH_DRAFTS.json': drafts, 'OUTREACH_APPROVAL_INBOX.md': inbox }, telegramRaw, sendRaw, scheduledTask: readScheduledTaskStatus(), now });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = await readRevenueStatusSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
}
