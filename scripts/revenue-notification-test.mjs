import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sendRevenueTelegram, runRevenueNotification } from './revenue-notification.mjs';
import { getTelegramEventStatus, recordTelegramEvent } from './telegram-event-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jagat-notifications-'));
const ledgerPath = path.join(temp, 'events.jsonl');
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const event = key => ({ event_key: key, event_type: 'REVENUE_BRIEF', summary: 'Synthetic report only' });
let calls = 0;
const send = (key, fetchImpl) => sendRevenueTelegram({ botToken: 'fake-secret-token', chatId: 'synthetic', text: 'Synthetic test', event: event(key), ledgerPath, fetchImpl: async (...args) => { calls++; return fetchImpl(...args); } });
const ack = async () => new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), { status: 200 });
check((await send('success', ack)).status, 'DELIVERED');
check(await getTelegramEventStatus('success', ledgerPath), 'DELIVERED');
const beforeReplay = calls;
check((await send('success', ack)).status, 'SKIPPED');
check(calls, beforeReplay);
check((await send('api-reject', async () => new Response('{"ok":false}', { status: 200 }))).status, 'FAILED');
check((await send('http-reject', async () => new Response('Unauthorized', { status: 401 }))).status, 'FAILED');
check((await send('missing-ack', async () => new Response('{"ok":true}', { status: 200 }))).status, 'UNKNOWN');
check((await send('invalid-json', async () => new Response('invalid', { status: 200 }))).status, 'UNKNOWN');
check((await send('server-error', async () => new Response('bad gateway', { status: 502 }))).status, 'UNKNOWN');
check((await send('network', async () => { throw new Error('https://api.telegram.org/botfake-secret-token/sendMessage'); })).status, 'UNKNOWN');
const beforeUnknownReplay = calls;
check((await send('network', ack)).status, 'UNKNOWN');
check(calls, beforeUnknownReplay);
await recordTelegramEvent({ ...event('interrupted'), status: 'ATTEMPTED' }, ledgerPath);
check((await send('interrupted', ack)).status, 'UNKNOWN');
check(calls, beforeUnknownReplay);
const disabled = await runRevenueNotification({ enabled: false, eventType: 'REVENUE_BRIEF', ledgerPath, send: () => { throw new Error('must not run'); } });
check(disabled.status, 'NOT_REQUESTED');
const fail = await runRevenueNotification({ enabled: true, eventType: 'EMAIL_DRAFT_BATCH', ledgerPath, send: () => { throw new Error('fake-secret-token'); } });
check(fail.status, 'FAILED');
check((await fs.readFile(ledgerPath, 'utf8')).includes('fake-secret-token'), false);
await assert.rejects(() => sendRevenueTelegram({ botToken: '', chatId: '', event: event('missing'), ledgerPath, fetchImpl: ack })); assertions++;
// A corrupt history is not silently ignored and cannot cause a network send.
await fs.appendFile(ledgerPath, 'corrupt\n');
const beforeCorrupt = calls;
await assert.rejects(() => send('corrupt-history', ack)); assertions++;
check(calls, beforeCorrupt);

// Execute the actual brief command against synthetic local files, with a preload
// denying every request. This proves network failures do not erase artifact success.
const fixture = path.join(temp, 'fixture');
await fs.mkdir(path.join(fixture, 'scripts'), { recursive: true });
await fs.mkdir(path.join(fixture, 'ops/revenue'), { recursive: true });
for (const name of ['autonomous-revenue-agent-v1.mjs', 'email-quality-guard.mjs', 'telegram-event-guard.mjs', 'revenue-notification.mjs']) {
  await fs.copyFile(path.join(root, 'scripts', name), path.join(fixture, 'scripts', name));
}
const revenue = path.join(fixture, 'ops/revenue');
await fs.writeFile(path.join(revenue, 'SUPPRESSION_LIST.json'), '[]');
await fs.writeFile(path.join(revenue, 'PROSPECT_TRACKER.csv'), 'company_or_person,public_contact,offer,status\nSynthetic,sales@synthetic.invalid,AI Admin Bot,email_found\n');
const preload = path.join(fixture, 'no-network.mjs');
await fs.writeFile(preload, 'globalThis.fetch = async () => { throw new Error("blocked https://api.telegram.org/botfake-secret-token/sendMessage"); };');
const run = () => spawnSync(process.execPath, ['--import', preload, 'scripts/autonomous-revenue-agent-v1.mjs', '--offline', '--send-telegram'], { cwd: fixture, encoding: 'utf8', env: { ...process.env, USERPROFILE: fixture, TELEGRAM_BOT_TOKEN: 'fake-secret-token', TELEGRAM_FOUNDER_CHAT_ID: 'synthetic' } });
const result = run();
check(result.status, 0);
check(result.stdout.includes('REVENUE_AGENT=PASS'), true);
check(result.stdout.includes('TELEGRAM_STATUS=UNKNOWN'), true);
check(result.stdout.includes('TELEGRAM_SENT=false'), true);
check((result.stdout + result.stderr).includes('fake-secret-token'), false);
check((await fs.readFile(path.join(revenue, 'latest-revenue-brief.md'), 'utf8')).includes('Mode offline'), true);
const events = (await fs.readFile(path.join(revenue, 'telegram-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
check(events.map(e => e.status), ['ATTEMPTED', 'UNKNOWN']);
check(run().status, 0);
check((await fs.readFile(path.join(revenue, 'telegram-events.jsonl'), 'utf8')).trim().split('\n').length, 2);
// Primary preparation failure remains fatal, so the cycle can still gate dispatch.
await fs.writeFile(path.join(revenue, 'SUPPRESSION_LIST.json'), 'invalid');
const primaryFailure = run();
check(primaryFailure.status, 1);
check(primaryFailure.stderr.includes('REVENUE_AGENT=FAIL'), true);
console.log(JSON.stringify({ status: 'PASS', assertions, network: 'stubbed only', artifacts: temp }));
