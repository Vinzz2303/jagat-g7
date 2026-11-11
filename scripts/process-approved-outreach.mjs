#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revenue = path.join(root, 'ops/revenue');
const approvalsDir = path.join(revenue, 'approvals');
const sender = path.join(root, 'scripts/revenue-outreach-email.mjs');
const drafts = JSON.parse((await fs.readFile(path.join(revenue, 'OUTREACH_DRAFTS.json'), 'utf8')).replace(/^\uFEFF/, ''));
const policy = JSON.parse((await fs.readFile(path.join(revenue, 'AUTO_SEND_POLICY.json'), 'utf8').catch(() => '{"enabled":false}')).replace(/^\uFEFF/, ''));
if (policy.enabled === true) {
  let skipped = 0;
  for (const draft of drafts) {
    const to = String(draft.to || '').trim().toLowerCase();
    if (!to) { skipped++; continue; }
    const run = spawnSync(process.execPath, [sender, to, '--campaign-auto', '--confirm-send'], { cwd: root, stdio: 'inherit', windowsHide: true });
    if (run.status === 0) { console.log(`AUTO_OUTREACH attempted=1 skipped=${skipped}`); process.exit(0); }
    if (run.status === 2) { skipped++; continue; }
    console.error(`AUTO_OUTREACH failed for ${to}; stopping to avoid repeated attempts.`);
    process.exit(run.status || 1);
  }
  console.log(`AUTO_OUTREACH attempted=0 skipped=${skipped} reason=no_eligible_draft`);
  process.exit(0);
}
const names = await fs.readdir(approvalsDir).catch(() => []);
let attempted = 0, skipped = 0, failed = 0;
const MAX_EMAILS_PER_CYCLE = 1;
const MAX_EMAILS_PER_DAY = 5;

for (const name of names.filter(item => item.endsWith('.json')).sort()) {
  if (attempted >= MAX_EMAILS_PER_CYCLE) { skipped++; continue; }
  const approvalPath = path.join(approvalsDir, name);
  let approval;
  try { approval = JSON.parse((await fs.readFile(approvalPath, 'utf8')).replace(/^\uFEFF/, '')); }
  catch { skipped++; continue; }
  const to = String(approval.to || '').trim().toLowerCase();
  const draft = drafts.find(item => String(item.to || '').trim().toLowerCase() === to && item.draftHash === approval.draftHash);
  const expiresAt = Date.parse(approval.expiresAt);
  if (!draft || approval.approvedBy !== 'Faturachman Al Kahfi' || !approval.approvalId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) { skipped++; continue; }
  const ledger = (await fs.readFile(path.join(revenue, 'outreach-send-ledger.jsonl'), 'utf8').catch(() => '')).replace(/^\uFEFF/, '');
  const today = new Date().toISOString().slice(0, 10);
  const attemptsToday = ledger.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(event => event.ts?.startsWith(today) && ['attempted', 'sent', 'unknown'].includes(event.status)).length;
  if (attemptsToday >= MAX_EMAILS_PER_DAY) { skipped++; console.log('APPROVED_OUTREACH daily limit reached; remaining approvals stay pending.'); break; }
  if (ledger.split(/\r?\n/).filter(Boolean).some(line => { try { const event = JSON.parse(line); return event.draftHash === draft.draftHash && ['attempted', 'sent', 'unknown'].includes(event.status); } catch { return false; } })) { skipped++; continue; }
  const run = spawnSync(process.execPath, [sender, draft.to, '--confirm-send', `--approval=${approvalPath}`], { cwd: root, stdio: 'inherit', windowsHide: true });
  attempted++;
  if (run.status !== 0) failed++;
}
console.log(`APPROVED_OUTREACH attempted=${attempted} skipped=${skipped} failed=${failed}`);
if (failed) process.exitCode = 1;
