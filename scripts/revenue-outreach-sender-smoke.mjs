#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { isPlausibleOutreachEmail } = await import('./email-quality-guard.mjs');
if (isPlausibleOutreachEmail('nama@perusahaan.com') || !isPlausibleOutreachEmail('contact@company.co.id')) throw new Error('Email quality guard fixture failed.');
const source = path.join(root, 'scripts/revenue-outreach-email.mjs');
const processorSource = path.join(root, 'scripts/process-approved-outreach.mjs');
const approveSource = path.join(root, 'scripts/approve-outreach-draft.mjs');
const emailGuardSource = path.join(root, 'scripts/email-quality-guard.mjs');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jagat-sender-smoke-'));
const dirs = ['scripts', 'dist/colony', 'ops/outreach', 'ops/revenue', 'ops/revenue/approvals'];
for (const dir of dirs) await fs.mkdir(path.join(temp, dir), { recursive: true });
await fs.symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'junction');
await fs.copyFile(source, path.join(temp, 'scripts/revenue-outreach-email.mjs'));
await fs.copyFile(processorSource, path.join(temp, 'scripts/process-approved-outreach.mjs'));
await fs.copyFile(approveSource, path.join(temp, 'scripts/approve-outreach-draft.mjs'));
await fs.copyFile(emailGuardSource, path.join(temp, 'scripts/email-quality-guard.mjs'));
for (const name of ['EMAIL_ENTERPRISE_ID.html', 'EMAIL_ENTERPRISE_EN.html']) {
  await fs.copyFile(path.join(root, 'ops/outreach', name), path.join(temp, 'ops/outreach', name));
}
const to = `smoke-${randomUUID()}@example.invalid`;
const payload = { to, subject: 'JAGAT fake SMTP smoke', text: 'Local-only test', html: '<p>Local-only test</p>' };
const draftHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const suppressedTo = 'cs@abmlogistics.co.id';
const suppressedPayload = { to: suppressedTo, subject: 'Suppressed smoke', text: 'Do not send', html: '<p>Do not send</p>' };
const suppressedHash = createHash('sha256').update(JSON.stringify(suppressedPayload)).digest('hex');
const secondPayload = { to: `second-${randomUUID()}@example.invalid`, subject: 'Second cycle smoke', text: 'One per cycle', html: '<p>One per cycle</p>' };
const secondHash = createHash('sha256').update(JSON.stringify(secondPayload)).digest('hex');
const limitPayload = { to: `limit-${randomUUID()}@example.invalid`, subject: 'Daily cap smoke', text: 'Must remain unsent', html: '<p>Must remain unsent</p>' };
const limitHash = createHash('sha256').update(JSON.stringify(limitPayload)).digest('hex');
const refusedPayload = { to: `refused-${randomUUID()}@example.invalid`, subject: 'Refusal guard smoke', text: 'Must not send', html: '<p>Must not send</p>' };
const refusedHash = createHash('sha256').update(JSON.stringify(refusedPayload)).digest('hex');
const approval = { ...payload, draftHash, approvedBy: 'Faturachman Al Kahfi', approvalId: randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() };
const approvalPath = path.join(temp, 'ops/revenue/approvals', `${draftHash}.${approval.approvalId}.json`);
await fs.writeFile(path.join(temp, 'ops/revenue/OUTREACH_DRAFTS.json'), JSON.stringify([{ ...payload, draftHash }, { ...suppressedPayload, draftHash: suppressedHash }, { ...secondPayload, draftHash: secondHash }, { ...limitPayload, draftHash: limitHash }, { ...refusedPayload, draftHash: refusedHash }]));
await fs.writeFile(path.join(temp, 'ops/revenue/SUPPRESSION_LIST.json'), JSON.stringify([{ email: 'cs@abmlogistics.co.id', reason: 'existing opt-out' }]));
const trackerHeaders = ['status', 'public_contact', 'response'];
const trackerRows = [
  { status: 'email_found', public_contact: to, response: '' },
  { status: 'email_found', public_contact: secondPayload.to, response: '' },
  { status: 'email_found', public_contact: refusedPayload.to, response: 'Not interested' },
];
await fs.writeFile(path.join(temp, 'ops/revenue/PROSPECT_TRACKER.csv'), [trackerHeaders.join(','), ...trackerRows.map(row => trackerHeaders.map(key => JSON.stringify(row[key])).join(','))].join('\n') + '\n');
const refusedApprovalPath = path.join(temp, 'ops/revenue/refused-approval.json');
await fs.writeFile(refusedApprovalPath, JSON.stringify({ to: refusedPayload.to, draftHash: refusedHash, approvedBy: 'Faturachman Al Kahfi', approvalId: randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() }));
await fs.writeFile(path.join(temp, 'ops/revenue/approved.txt'), `${to}\n`);
await fs.writeFile(approvalPath, JSON.stringify(approval));
const secondApprovalPath = path.join(temp, 'ops/revenue/approvals', 'zz-second.json');
const limitApprovalPath = path.join(temp, 'ops/revenue/approvals', 'zz-daily-cap.json');
await fs.writeFile(secondApprovalPath, JSON.stringify({ ...secondPayload, draftHash: secondHash, approvedBy: 'Faturachman Al Kahfi', approvalId: randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() }));
const adapter = `import fs from 'node:fs/promises';
const log = ${JSON.stringify(path.join(temp, 'smtp-capture.json'))};
export async function initEmailAdapter() { return true; }
export async function sendEmail(message) { await fs.writeFile(log, JSON.stringify(message)); return { success: true, messageId: 'fake-local-id' }; }
`;
await fs.writeFile(path.join(temp, 'dist/colony/email-adapter.js'), adapter);
const telegram = `import fs from 'node:fs/promises';
const log = ${JSON.stringify(path.join(temp, 'telegram-capture.json'))};
export async function sendTelegramText(message) { await fs.writeFile(log, message); }
`;
await fs.writeFile(path.join(temp, 'dist/colony/telegram-adapter.js'), telegram);
const args = [path.join(temp, 'scripts/revenue-outreach-email.mjs'), to, '--confirm-send', `--approved-list=${path.join(temp, 'ops/revenue/approved.txt')}`, `--approval=${approvalPath}`];
const runSender = (senderArgs) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, senderArgs, { cwd: temp, env: { ...process.env, EMAIL_ENABLED: '', EMAIL_HOST: '', EMAIL_USER: '', EMAIL_PASS: '' }, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  child.once('error', reject);
  child.once('close', code => resolve({ code, stdout, stderr }));
});
const badApproval = { ...approval, draftHash: '0'.repeat(64) };
const badApprovalPath = path.join(temp, 'bad-approval.json');
await fs.writeFile(badApprovalPath, JSON.stringify(badApproval));
const invalid = await runSender([...args.slice(0, -1), `--approval=${badApprovalPath}`]);
if (invalid.code === 0 || !`${invalid.stdout}\n${invalid.stderr}`.includes('Approval expired or does not match')) throw new Error(`Mismatched approval was not rejected; artifacts: ${temp}`);
const suppressed = await runSender([...args.slice(0, 1), 'cs@abmlogistics.co.id', ...args.slice(2)]);
if (suppressed.code === 0 || !`${suppressed.stdout}\n${suppressed.stderr}`.includes('durable suppression list')) throw new Error(`Suppressed recipient was not blocked; artifacts: ${temp}`);
const refused = await runSender([args[0], refusedPayload.to, '--confirm-send', `--approval=${refusedApprovalPath}`]);
if (refused.code === 0 || !`${refused.stdout}\n${refused.stderr}`.includes('Current prospect tracker blocks')) throw new Error(`Current tracker refusal was not enforced; artifacts: ${temp}`);
const blockedTelegram = await fs.readFile(path.join(temp, 'telegram-capture.json'), 'utf8').catch(() => '');
if (!blockedTelegram.includes('Outreach BLOCKED') || !blockedTelegram.includes(refusedPayload.to) || blockedTelegram.includes('Not interested')) throw new Error(`Blocked outreach Telegram status missing or exposed tracker response; artifacts: ${temp}`);
const processorArgs = [path.join(temp, 'scripts/process-approved-outreach.mjs')];
const result = await runSender(processorArgs);
const ledgerText = await fs.readFile(path.join(temp, 'ops/revenue/outreach-send-ledger.jsonl'), 'utf8').catch(() => '');
const ledger = ledgerText.trim() ? ledgerText.trim().split(/\r?\n/).map(line => JSON.parse(line)) : [];
const capturePath = path.join(temp, 'smtp-capture.json');
const captured = await fs.readFile(capturePath, 'utf8').then(JSON.parse).catch(() => null);
const telegramPath = path.join(temp, 'telegram-capture.json');
const telegramMessage = await fs.readFile(telegramPath, 'utf8').catch(() => '');
if (result.code !== 0 || ledger.map(event => event.status).join(',') !== 'attempted,sent' || captured?.to !== to || captured?.subject !== payload.subject || invalid.stdout.includes('SMTP connection') || !telegramMessage.includes('Outreach SENT') || !telegramMessage.includes(to) || !result.stdout.includes('attempted=1 skipped=1')) {
  throw new Error(`Fake SMTP sender smoke failed; temp artifacts: ${temp}\n${result.stdout}\n${result.stderr}`);
}
const replay = await runSender(processorArgs);
if (replay.code !== 0 || !replay.stdout.includes('attempted=1 skipped=1')) throw new Error(`One-per-cycle approval processing failed; artifacts: ${temp}`);
const finalReplay = await runSender(processorArgs);
if (finalReplay.code !== 0 || !finalReplay.stdout.includes('attempted=0 skipped=2')) throw new Error(`Duplicate approvals were not skipped by processor; artifacts: ${temp}`);
const currentLedger = (await fs.readFile(path.join(temp, 'ops/revenue/outreach-send-ledger.jsonl'), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
const attemptsToday = currentLedger.filter(event => event.ts?.startsWith(new Date().toISOString().slice(0, 10)) && ['attempted', 'sent', 'unknown'].includes(event.status)).length;
await fs.writeFile(limitApprovalPath, JSON.stringify({ ...limitPayload, draftHash: limitHash, approvedBy: 'Faturachman Al Kahfi', approvalId: randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() }));
const fillerCount = Math.max(0, 5 - attemptsToday);
const filler = Array.from({ length: fillerCount }, (_, index) => JSON.stringify({ status: 'attempted', to: `prior-${index}@example.invalid`, draftHash: `prior-${index}`, ts: new Date().toISOString() })).join('\n') + (fillerCount ? '\n' : '');
if (filler) await fs.appendFile(path.join(temp, 'ops/revenue/outreach-send-ledger.jsonl'), filler);
const limited = await runSender([args[0], limitPayload.to, '--confirm-send', `--approval=${limitApprovalPath}`]);
if (limited.code === 0 || !`${limited.stdout}\n${limited.stderr}`.includes('Daily founder-reviewed outreach limit reached')) throw new Error(`Daily attempt cap was not enforced; artifacts: ${temp}`);
const optoutArgs = [args[0], to, '--suppress-email'];
const optout = await runSender(optoutArgs);
const optoutReplay = await runSender(optoutArgs);
const suppressionRows = JSON.parse(await fs.readFile(path.join(temp, 'ops/revenue/SUPPRESSION_LIST.json'), 'utf8'));
if (optout.code !== 0 || optoutReplay.code !== 0 || suppressionRows.filter(row => row.email === to).length !== 1) throw new Error(`Opt-out registration was not idempotent; artifacts: ${temp}`);
const approvalAttempt = await runSender([path.join(temp, 'scripts/approve-outreach-draft.mjs'), `--to=${suppressedTo}`, `--hash=${suppressedHash}`, '--approved-by=Faturachman Al Kahfi']);
if (approvalAttempt.code === 0 || !`${approvalAttempt.stdout}\n${approvalAttempt.stderr}`.includes('Recipient is suppressed')) throw new Error(`Suppressed draft received founder approval; artifacts: ${temp}`);
const autoTo = 'sales@acme.co.id';
const autoDraft = { to: autoTo, subject: 'Policy smoke', text: 'Local-only test. Balas STOP jika tidak ingin menerima pesan lagi.', html: '<p>Local-only test. Balas STOP jika tidak ingin menerima pesan lagi.</p>' };
autoDraft.draftHash = createHash('sha256').update(JSON.stringify(autoDraft)).digest('hex');
await fs.writeFile(path.join(temp, 'ops/revenue/AUTO_SEND_POLICY.json'), JSON.stringify({ enabled: true, policyVersion: '2026-11-07-v1', authorizedBy: 'Faturachman Al Kahfi', maxPerCycle: 1, maxPerDay: 1, followups: false, allowedRoleLocalParts: ['sales'] }));
await fs.writeFile(path.join(temp, 'ops/revenue/OUTREACH_DRAFTS.json'), JSON.stringify([autoDraft]));
await fs.writeFile(path.join(temp, 'ops/revenue/PROSPECT_TRACKER.csv'), 'status,public_contact,response,company_or_person,website,source\nemail_found,sales@acme.co.id,,Acme,https://acme.co.id,official_site:https://acme.co.id\n');
await fs.writeFile(path.join(temp, 'ops/revenue/outreach-send-ledger.jsonl'), '');
const autoResult = await runSender(processorArgs);
const autoLedger = (await fs.readFile(path.join(temp, 'ops/revenue/outreach-send-ledger.jsonl'), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
if (autoResult.code !== 0 || autoLedger.map(event => event.status).join(',') !== 'attempted,sent' || autoLedger.some(event => event.approvalMode !== 'founder_campaign_policy' || event.campaignPolicyVersion !== '2026-11-07-v1')) throw new Error(`Automatic policy sender smoke failed; artifacts: ${temp}\n${autoResult.stdout}\n${autoResult.stderr}`);
console.log(JSON.stringify({ status: 'PASS', target: to, statuses: ledger.map(event => event.status), mismatch: 'rejected', suppression: 'blocked at approval and send; idempotent opt-out', dailyCap: '5 attempts enforced', automaticPolicy: 'one eligible role inbox sent via fake SMTP', telegram: 'captured locally', duplicate: 'blocked', smtp: 'fake adapter only', artifacts: temp }));



