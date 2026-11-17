#!/usr/bin/env node
import { buildRevenueStatusSnapshot, FRESHNESS_LIMIT_MS, normalizeScheduledTask } from './revenue-status-snapshot.mjs';

let failures = 0;
function check(name, value) {
  if (value) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}`); }
}
const now = Date.parse('2026-11-05T22:00:00.000Z');
const readyTask = normalizeScheduledTask({ State: 'Ready', LastRunTime: '2026-11-05T13:41:40-08:00', LastTaskResult: 0, NextRunTime: '2026-11-05T16:41:39-08:00' });
const snapshot = buildRevenueStatusSnapshot({ now,
  scheduledTask: readyTask,
  artifactTimes: { 'latest-prospect-discovery.md': now - 60000, 'latest-revenue-brief.md': now - 120000, 'OUTREACH_DRAFTS.json': now - 30000, 'OUTREACH_APPROVAL_INBOX.md': now - 20000 },
  telegramRaw: [
    JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00.000Z' }),
    JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'DELIVERED', sent_at: '2026-11-05T21:10:00.000Z' }),
  ].join('\n'),
  sendRaw: [
    JSON.stringify({ status: 'sent', ts: '2026-11-05T20:01:00.000Z', to: 'private@example.test' }),
  ].join('\n'),
});
check('healthy required pipeline labeled healthy', snapshot.overall === 'HEALTHY');
const stalePipeline = buildRevenueStatusSnapshot({ now, artifactTimes: { 'latest-revenue-brief.md': now - FRESHNESS_LIMIT_MS - 1 }, telegramRaw: JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00.000Z' }) });
check('stale artifact degrades pipeline', stalePipeline.overall === 'DEGRADED');
check('fresh artifact classified', snapshot.artifacts['latest-prospect-discovery.md'].status === 'FRESH');
check('stale artifact classified', stalePipeline.artifacts['latest-revenue-brief.md'].status === 'STALE');
const artifactEdges = buildRevenueStatusSnapshot({ now, artifactTimes: { 'OUTREACH_DRAFTS.json': now + 1000 } });
check('missing artifact classified', artifactEdges.artifacts['OUTREACH_APPROVAL_INBOX.md'].status === 'MISSING');
check('future timestamp unknown', artifactEdges.artifacts['OUTREACH_DRAFTS.json'].status === 'UNKNOWN');
check('telegram delivery kept distinct', snapshot.notifications.brief.status === 'DELIVERED');
check('telegram delivery kept distinct for draft batch', snapshot.notifications.draftBatch.status === 'DELIVERED');
const outcomeSnapshot = buildRevenueStatusSnapshot({ now, scheduledTask: readyTask, artifactTimes: { 'latest-prospect-discovery.md': now - 1000, 'latest-revenue-brief.md': now - 1000, 'OUTREACH_DRAFTS.json': now - 1000, 'OUTREACH_APPROVAL_INBOX.md': now - 1000 }, telegramRaw: [
  JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00.000Z' }),
  JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00.000Z' }),
].join('\n'), sendRaw: [
  JSON.stringify({ status: 'attempted', ts: '2026-11-05T20:00:00.000Z', to: 'private@example.test' }),
  JSON.stringify({ status: 'sent', ts: '2026-11-05T20:01:00.000Z', to: 'private@example.test' }),
  JSON.stringify({ status: 'failed', ts: '2026-11-05T20:02:00.000Z', to: 'private@example.test', response: 'Not interested' }),
  JSON.stringify({ status: 'unknown', ts: '2026-11-05T20:03:00.000Z', to: 'private@example.test' }),
  JSON.stringify({ status: 'blocked', ts: '2026-11-05T20:04:00.000Z', to: 'private@example.test' }),
].join('\n') });
check('telegram failure visible', buildRevenueStatusSnapshot({ now, telegramRaw: JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'FAILED', sent_at: '2026-11-05T21:10:00.000Z' }) }).notifications.draftBatch.status === 'FAILED');
check('sender outcome counts', outcomeSnapshot.outreach.counts.attempted === 1 && outcomeSnapshot.outreach.counts.sent === 1 && outcomeSnapshot.outreach.counts.failed === 1 && outcomeSnapshot.outreach.counts.unknown === 1);
check('additional sender statuses preserved', outcomeSnapshot.outreach.otherStatuses.blocked === 1);
check('sender failure remains separate outreach attention', outcomeSnapshot.overall === 'HEALTHY' && outcomeSnapshot.outreach.health === 'ATTENTION');
check('recipient and raw response omitted', !JSON.stringify(outcomeSnapshot).includes('private@example.test') && !JSON.stringify(outcomeSnapshot).includes('Not interested'));
const malformed = buildRevenueStatusSnapshot({ now, telegramRaw: '{broken', sendRaw: '{broken' });
check('malformed ledgers remain unknown and degrade status', malformed.notificationLedger === 'UNKNOWN' && malformed.notifications.brief.status === 'UNKNOWN' && malformed.outreach.counts === null && malformed.outreach.otherStatuses === null && malformed.overall === 'DEGRADED');
const empty = buildRevenueStatusSnapshot({ now, telegramRaw: '', sendRaw: '' });
check('empty ledgers do not infer success', empty.notifications.brief.status === 'UNKNOWN' && empty.outreach.counts.attempted === 0 && empty.overall === 'DEGRADED');
const legacy = buildRevenueStatusSnapshot({ now, sendRaw: '\uFEFF' + JSON.stringify({ status: 'sent', ts: '2026-11-05T20:00:00.000Z' }) });
check('BOM legacy single-object ledger is parsed', legacy.outreach.ledger === 'OK' && legacy.outreach.counts.sent === 1);
const scheduled = normalizeScheduledTask({ State: 'Ready', LastRunTime: '2026-11-05T13:41:40-08:00', LastTaskResult: 0, NextRunTime: '2026-11-05T16:41:39-08:00' });
check('scheduled task status normalized', scheduled.status === 'AVAILABLE' && scheduled.state === 'Ready' && scheduled.lastTaskResult === 0 && scheduled.nextRunTime?.includes('16:41:39'));
check('unavailable scheduler is explicit', normalizeScheduledTask(null).status === 'UNAVAILABLE');
check('missing task result is not false success', normalizeScheduledTask({ State: 'Ready', LastTaskResult: null }).lastTaskResult === null);
check('invalid task result stays unknown', normalizeScheduledTask({ State: 'Ready', LastTaskResult: 'n/a' }).lastTaskResult === null);
check('disabled scheduler degrades otherwise healthy pipeline', buildRevenueStatusSnapshot({ now, scheduledTask: normalizeScheduledTask({ State: 'Disabled', LastTaskResult: 0 }), artifactTimes: { 'latest-prospect-discovery.md': now, 'latest-revenue-brief.md': now, 'OUTREACH_DRAFTS.json': now, 'OUTREACH_APPROVAL_INBOX.md': now }, telegramRaw: [JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' }), JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' })].join('\n') }).overall === 'DEGRADED');
check('failed scheduler run degrades pipeline', buildRevenueStatusSnapshot({ now, scheduledTask: normalizeScheduledTask({ State: 'Ready', LastTaskResult: 1 }), artifactTimes: { 'latest-prospect-discovery.md': now, 'latest-revenue-brief.md': now, 'OUTREACH_DRAFTS.json': now, 'OUTREACH_APPROVAL_INBOX.md': now }, telegramRaw: [JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' }), JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' })].join('\n') }).overall === 'DEGRADED');
const lateTask = normalizeScheduledTask({ State: 'Ready', LastRunTime: '2026-11-05T13:41:40-08:00', LastTaskResult: 0, NextRunTime: '2026-11-05T13:50:00-08:00' });
check('missed scheduled run degrades otherwise fresh pipeline', buildRevenueStatusSnapshot({ now, scheduledTask: lateTask, artifactTimes: { 'latest-prospect-discovery.md': now, 'latest-revenue-brief.md': now, 'OUTREACH_DRAFTS.json': now, 'OUTREACH_APPROVAL_INBOX.md': now }, telegramRaw: [JSON.stringify({ event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' }), JSON.stringify({ event_type: 'EMAIL_DRAFT_BATCH', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00Z' })].join('\n') }).overall === 'DEGRADED');
const tiedEvents = buildRevenueStatusSnapshot({ now, telegramRaw: [
  { event_type: 'REVENUE_BRIEF', status: 'ATTEMPTED', sent_at: '2026-11-05T21:00:00.000Z' },
  { event_type: 'REVENUE_BRIEF', status: 'DELIVERED', sent_at: '2026-11-05T21:00:00.000Z' },
  { event_type: 'EMAIL_DRAFT_BATCH', status: 'ATTEMPTED', sent_at: '2026-11-05T21:00:00.000Z' },
  { event_type: 'EMAIL_DRAFT_BATCH', status: 'UNKNOWN', sent_at: '2026-11-05T21:00:00.000Z' },
].map(JSON.stringify).join('\n') });
check('same-millisecond delivery uses latest appended state', tiedEvents.notifications.brief.status === 'DELIVERED');
check('same-millisecond unknown is not hidden by attempted state', tiedEvents.notifications.draftBatch.status === 'UNKNOWN');
console.log(`Revenue status snapshot: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failures)`);
if (failures) process.exitCode = 1;
