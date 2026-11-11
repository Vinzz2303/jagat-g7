import fs from 'node:fs/promises'; import path from 'node:path'; import { randomUUID } from 'node:crypto';
import { isPlausibleOutreachEmail } from './email-quality-guard.mjs';
const ROOT = process.cwd(), DIR = path.join(ROOT, 'ops/revenue/approvals');
const DRAFTS = path.join(ROOT, 'ops/revenue/OUTREACH_DRAFTS.json');
const SUPPRESSION = path.join(ROOT, 'ops/revenue/SUPPRESSION_LIST.json');
const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const to = arg('to')?.trim(), draftHash = arg('hash'), approvedBy = arg('approved-by'), hours = Number(arg('expires-hours') || 24);
  if (!isPlausibleOutreachEmail(to) || !/^[a-f0-9]{64}$/i.test(draftHash || '') || approvedBy !== 'Faturachman Al Kahfi' || !Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('Require --to, valid --hash, founder identity, and expiry from 0 to 24 hours.');
  const drafts = JSON.parse((await fs.readFile(DRAFTS, 'utf8')).replace(/^\uFEFF/, ''));
  const draft = drafts.find((item) => item.to?.trim().toLowerCase() === to.toLowerCase());
  if (!draft || draft.draftHash !== draftHash) throw new Error('No current draft matches this recipient and hash.');
  const suppressed = JSON.parse((await fs.readFile(SUPPRESSION, 'utf8')).replace(/^\uFEFF/, ''));
  if (!Array.isArray(suppressed) || suppressed.some((item) => item.email?.trim().toLowerCase() === to.toLowerCase())) throw new Error('Recipient is suppressed or suppression list is invalid.');
  const now = Date.now(), approval = { approvalId: randomUUID(), to: draft.to, draftHash, approvedBy, approvedAt: new Date(now).toISOString(), expiresAt: new Date(now + hours * 3600000).toISOString() };
  await fs.mkdir(DIR, { recursive: true });
  const file = path.join(DIR, `${draftHash}.${approval.approvalId}.json`);
  await fs.writeFile(file, `${JSON.stringify(approval, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ status: 'approved', to: draft.to, draftHash, expiresAt: approval.expiresAt, file }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
