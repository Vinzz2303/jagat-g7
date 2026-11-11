import fs from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { isPlausibleOutreachEmail } from './email-quality-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables before importing colony modules
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize the email adapter
import { initEmailAdapter, sendEmail } from '../dist/colony/email-adapter.js';

const PROMO_FILE = path.join(__dirname, '../ops/outreach/PROMO_JAGAT_SHARE_READY_2026-06-25.md');
const TRACKER_PATH = path.join(__dirname, '../ops/revenue/PROSPECT_TRACKER.csv');
const LEDGER_PATH = path.join(__dirname, '../ops/revenue/outreach-send-ledger.jsonl');
const MACHINE_DRAFTS_PATH = path.join(__dirname, '../ops/revenue/OUTREACH_DRAFTS.json');
const SUPPRESSION_PATH = path.join(__dirname, '../ops/revenue/SUPPRESSION_LIST.json');
const AUTO_SEND_POLICY_PATH = path.join(__dirname, '../ops/revenue/AUTO_SEND_POLICY.json');

const args = new Set(process.argv.slice(2));
const targetEmail = process.argv[2];
const approvedListArg = process.argv.find(arg => arg.startsWith("--approved-list="));
const approvedListPath = approvedListArg?.slice("--approved-list=".length);
const approvalArg = process.argv.find(arg => arg.startsWith('--approval='))?.slice('--approval='.length);
const isPreview = args.has('--preview');
const isBlastMode = args.has('--blast-all');
const isCampaignAuto = args.has('--campaign-auto');
const suppressEmail = args.has('--suppress-email');
const MAX_EMAILS_PER_DAY = 5; // Founder-reviewed early outreach policy

// -- Helpers --

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ""]));
  });
  return { headers, rows };
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function subjectFor(lead) {
  const name = lead.company_or_person || "Bisnis Anda";
  const isGlobal = String(lead.source).includes('global');
  if (isGlobal) {
    return `Strategic AI & Web Integration for ${name}`;
  }
  return `Optimalisasi Operasional ${name} dengan Integrasi AI & Web System`;
}

async function writeLedger(event) {
  event.ts = new Date().toISOString();
  await fs.appendFile(LEDGER_PATH, JSON.stringify(event) + '\n', 'utf8');
}

async function getOutreachAttemptsToday() {
  let data;
  try { data = (await fs.readFile(LEDGER_PATH, 'utf8')).replace(/^\uFEFF/, ''); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  const today = new Date().toISOString().split('T')[0];
  return data.split('\n').filter(Boolean).reduce((count, line) => {
    const event = JSON.parse(line);
    return count + (event.ts?.startsWith(today) && ['attempted', 'sent', 'unknown'].includes(event.status) ? 1 : 0);
  }, 0);
}

async function loadSuppressedEmails() {
  const rows = JSON.parse((await fs.readFile(SUPPRESSION_PATH, 'utf8')).replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows)) throw new Error('Suppression list must be a JSON array.');
  return new Set(rows.map(row => String(row.email || '').trim().toLowerCase()).filter(Boolean));
}

function hasOutreachRefusal(lead) {
  const status = String(lead.status || '').trim().toLowerCase();
  const refusedStatuses = ['emailed', 'sent', 'suppressed', 'unsubscribed', 'rejected', 'declined', 'do_not_contact', 'opted_out', 'closed_lost', 'not_interested'];
  const response = String(lead.response || '');
  return refusedStatuses.includes(status) || /\b(?:not interested|do not contact|unsubscribe|remove me|stop emailing|tidak tertarik|jangan hubungi|berhenti berlangganan|hapus alamat email)\b/i.test(response);
}

async function assertRecipientStillEligible(email) {
  const { rows } = parseCsv(await fs.readFile(TRACKER_PATH, 'utf8'));
  const lead = rows.find((row) => String(row.public_contact || '').trim().toLowerCase() === email.trim().toLowerCase());
  if (!lead || hasOutreachRefusal(lead)) throw new Error('Current prospect tracker blocks this recipient; send refused.');
}

async function validateAutomaticCampaign(email) {
  const policy = JSON.parse(await fs.readFile(AUTO_SEND_POLICY_PATH, 'utf8'));
  if (!policy.enabled || policy.policyVersion !== '2026-11-07-v1' || policy.authorizedBy !== 'Faturachman Al Kahfi' || policy.maxPerCycle !== 1 || policy.maxPerDay !== 1 || policy.followups !== false) return { ok: false, reason: 'campaign policy is disabled or invalid' };
  const { rows } = parseCsv(await fs.readFile(TRACKER_PATH, 'utf8'));
  const lead = rows.find(row => String(row.public_contact || '').trim().toLowerCase() === email.trim().toLowerCase());
  if (!lead || hasOutreachRefusal(lead) || !['new', 'email_found', 'demo_ready'].includes(String(lead.status || '').toLowerCase())) return { ok: false, reason: 'lead status/refusal does not allow automated contact' };
  const [local, domain] = email.trim().toLowerCase().split('@');
  const freeDomains = new Set(['gmail.com', 'yahoo.com', 'yahoo.co.id', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com']);
  let websiteHost = '';
  try { websiteHost = new URL(lead.website).hostname.replace(/^www\./, '').toLowerCase(); } catch {}
  if (!policy.allowedRoleLocalParts.includes(local) || freeDomains.has(domain) || !websiteHost || domain !== websiteHost || !String(lead.source || '').startsWith('official_site:')) return { ok: false, reason: 'recipient must be a role mailbox on the official website domain' };
  if (await getOutreachAttemptsInWindow(24 * 60 * 60 * 1000) >= 1) return { ok: false, reason: 'one-email-per-24-hours campaign limit reached' };
  const ledger = (await fs.readFile(LEDGER_PATH, 'utf8').catch(() => '')).replace(/^\uFEFF/, '');
  const company = String(lead.company_or_person || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const prior = ledger.split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  if (prior.some(event => ['attempted', 'sent', 'unknown'].includes(event.status) && (String(event.to || '').trim().toLowerCase() === email.trim().toLowerCase() || (company && String(event.company || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === company)))) return { ok: false, reason: 'recipient or company was already contacted' };
  return { ok: true, policy, lead };
}

async function getOutreachAttemptsInWindow(windowMs) {
  const raw = (await fs.readFile(LEDGER_PATH, 'utf8').catch(() => '')).replace(/^\uFEFF/, '');
  return raw.split(/\r?\n/).filter(Boolean).reduce((count, line) => {
    try { const event = JSON.parse(line); const age = Date.now() - Date.parse(event.ts); return count + (['attempted', 'sent', 'unknown'].includes(event.status) && age >= 0 && age < windowMs ? 1 : 0); }
    catch { return count; }
  }, 0);
}

async function notifyFounderOutcome(outcome) {
  const { sendTelegramText } = await import('../dist/colony/telegram-adapter.js');
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  await sendTelegramText(`ðŸ“¨ <b>JAGAT Outreach ${escape(outcome.status.toUpperCase())}</b>\nTo: ${escape(outcome.to)}\nDraft: ${escape(outcome.draftHash.slice(0, 12))}\n${escape(outcome.detail)}`);
}

// -- Main --

async function main() {
  console.log('Ã°Å¸Å¡â‚¬ Starting JAGAT AI Email Outreach Agent...');
  if (suppressEmail) {
    const email = targetEmail?.trim().toLowerCase();
    if (!isPlausibleOutreachEmail(email)) throw new Error('--suppress-email requires one valid email address.');
    const rows = JSON.parse((await fs.readFile(SUPPRESSION_PATH, 'utf8')).replace(/^\uFEFF/, ''));
    if (!Array.isArray(rows)) throw new Error('Suppression list must be a JSON array.');
    if (!rows.some(row => String(row.email || '').trim().toLowerCase() === email)) {
      rows.push({ email, reason: 'Founder/manual opt-out', recordedAt: new Date().toISOString(), source: 'manual-cli' });
      await fs.writeFile(SUPPRESSION_PATH, JSON.stringify(rows, null, 2) + '\n', 'utf8');
    }
    console.log('OUTREACH_SUPPRESSED=' + email);
    return;
  }
  
  if (!targetEmail && !isBlastMode) {
    console.error('Ã¢ÂÅ’ Error: No target email specified and --blast-all not used.');
    console.log('Usage: npm run revenue:email:send -- <target_email@example.com>');
    console.log('       npm run revenue:email:send -- --blast-all');
    process.exit(1);
  }

  // Explicit human approval required for any sending. No unattended blast by default.
  if (!isPreview && !args.has('--confirm-send') && !isCampaignAuto) {
    console.error('Ã¢â€ºâ€ Dry-run safety gate: --confirm-send required to send mail.');
    process.exit(2);
  }
  if (isBlastMode) {
    console.error('Bulk auto-send disabled by D-043.');
    process.exit(2);
  }
  let suppressedEmails;
  try { suppressedEmails = await loadSuppressedEmails(); }
  catch { throw new Error('Suppression list is unavailable or invalid; refusing outreach.'); }
  if (targetEmail && suppressedEmails.has(targetEmail.trim().toLowerCase())) {
    console.error('Recipient is on the durable suppression list; send blocked.');
    process.exit(2);
  }
  if (targetEmail && !isPreview && !isPlausibleOutreachEmail(targetEmail)) {
    console.error('Placeholder recipient address; send blocked.');
    process.exit(2);
  }
  if (isBlastMode && !approvedListPath) {
    console.error('Ã¢â€ºâ€ Bulk outreach requires --approved-list=/absolute/path/to/approved-emails.txt');
    process.exit(2);
  }
  const approvedEmails = new Set();
  if (approvedListPath) {
    const approvalText = await fs.readFile(approvedListPath, 'utf8');
    for (const line of approvalText.split(/\r?\n/)) {
      const email = line.trim().toLowerCase();
      if (email && !email.startsWith('#')) approvedEmails.add(email);
    }
  }
  if (isBlastMode && approvedEmails.size === 0) {
    console.error('Ã¢â€ºâ€ Approved recipient list is empty.');
    process.exit(2);
  }
  if (!isBlastMode && (!targetEmail || (!isCampaignAuto && !isPreview && approvedListPath && !approvedEmails.has(targetEmail.toLowerCase())))) {
    console.error('Ã¢â€ºâ€ Individual email needs a valid per-draft approval and --confirm-send.');
    process.exit(2);
  }

  const TEMPLATE_ID = path.join(__dirname, '../ops/outreach/EMAIL_ENTERPRISE_ID.html');
  const TEMPLATE_EN = path.join(__dirname, '../ops/outreach/EMAIL_ENTERPRISE_EN.html');
  
  let rawTemplateID = '';
  let rawTemplateEN = '';
  try {
    rawTemplateID = await fs.readFile(TEMPLATE_ID, 'utf-8');
    rawTemplateEN = await fs.readFile(TEMPLATE_EN, 'utf-8');
  } catch (error) {
    console.error(`Ã¢ÂÅ’ Error: Could not read enterprise template files.`);
    process.exit(1);
  }

  if (isBlastMode) {
    console.log(`\nÃ°Å¸Å’ÂªÃ¯Â¸Â  BLAST MODE ACTIVATED`);
    const sentToday = await getOutreachAttemptsToday();
    console.log(`Ã°Å¸â€œÅ  Emails sent today: ${sentToday}/${MAX_EMAILS_PER_DAY}`);
    
    if (sentToday >= MAX_EMAILS_PER_DAY) {
      console.log('Ã¢â€ºâ€ Daily limit reached. Skipping blast.');
      process.exit(0);
    }

    const remaining = MAX_EMAILS_PER_DAY - sentToday;
    let trackerRaw = '';
    try {
      trackerRaw = await fs.readFile(TRACKER_PATH, 'utf8');
    } catch (e) {
      console.error(`Ã¢ÂÅ’ Could not read tracker file at ${TRACKER_PATH}`);
      process.exit(1);
    }

    const { headers, rows } = parseCsv(trackerRaw);
    
    const eligible = rows.filter(r =>
      (r.status === 'email_found' || r.status === 'new') &&
      r.public_contact &&
      r.public_contact.includes('@') &&
      approvedEmails.has(r.public_contact.trim().toLowerCase())
    );
    const eligibleLeads = eligible;

    if (eligibleLeads.length === 0) {
      console.log('Ã¢â€žÂ¹Ã¯Â¸Â No new email-ready leads found in tracker. Run discovery first.');
      process.exit(0);
    }

    // Prior attempts are not automatically retried; sender must inspect ambiguous outcomes.
    const earlier = await fs.readFile(LEDGER_PATH, 'utf8').catch(() => '');
    const attempted = new Set(earlier.split('\n').filter(Boolean).flatMap(line => {
      try { const e = JSON.parse(line); return ['attempted', 'sent', 'unknown'].includes(e.status) ? [String(e.to).toLowerCase()] : []; }
      catch { return []; }
    }));
    const newLeads = eligibleLeads.filter(lead => !attempted.has(String(lead.public_contact).trim().toLowerCase()))
      .slice(0, Math.min(remaining, MAX_PER_CYCLE));
    console.log(`Ã°Å¸Å½Â¯ Found ${newLeads.length} newly approved leads to contact.`);
    let successCount = 0;

    for (const lead of newLeads) {
      const email = lead.public_contact;
      
      let htmlContent = "";
      let subject = subjectFor(lead);
      let isGlobal = String(lead.source).includes('global');
      
      // If we have an LLM Draft, use it! Otherwise fallback to template
      if (lead.llm_draft) {
        htmlContent = lead.llm_draft.replace(/\n/g, '<br/>'); // Simple text to html
      } else {
        const rawTemplate = isGlobal ? rawTemplateEN : rawTemplateID;
        htmlContent = rawTemplate
          .replace(/\{\{company_or_person\}\}/g, lead.company_or_person || 'Company')
          .replace(/\{\{problem_hypothesis\}\}/g, String(lead.problem_hypothesis || "operational bottlenecks").replace(/\.+$/g, ""))
          .replace(/\{\{quoted_price\}\}/g, lead.quoted_price || (isGlobal ? '$1,000' : 'Rp2.500.000'));
      }

      await writeLedger({ status: 'attempted', to: email, company: lead.company_or_person });
      console.log(`\nÃ¢Å“â€°Ã¯Â¸Â Sending to: ${lead.company_or_person} (${email})`);
      const result = await sendEmail({
        to: email,
        subject: subject,
        text: `Halo Kak, Saya Faturachman dari JAGAT AI... (Mohon gunakan klien email berbasis HTML)`,
        html: htmlContent
      });

      if (result.success) {
        console.log(`Ã¢Å“â€¦ Success! MessageID: ${result.messageId}`);
        successCount++;
        // Update lead status
        lead.status = 'emailed';
        lead.next_action = 'Follow-up jika ada balasan';
        await writeLedger({ status: 'sent', to: email, company: lead.company_or_person, subject: subjectFor(lead) });
      } else {
        console.error(`Ã¢ÂÅ’ Failed: ${result.error}`);
        await writeLedger({ status: 'failed', to: email, company: lead.company_or_person, error: result.error });
      }

      // Safe delay between emails (5-10 seconds)
      const delay = Math.floor(Math.random() * 5000) + 5000;
      await wait(delay);
    }

    // Write back to CSV
    console.log(`\nÃ°Å¸â€™Â¾ Updating PROSPECT_TRACKER.csv...`);
    const newCsvLines = rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(","));
    const newCsvContent = headers.map(h => csvEscape(h)).join(",") + '\n' + newCsvLines.join('\n') + '\n';
    await fs.writeFile(TRACKER_PATH, newCsvContent, 'utf8');

    console.log(`Ã°Å¸Å½â€° Blast complete! Successfully sent ${successCount} emails.`);

  } else {
    const drafts = JSON.parse((await fs.readFile(MACHINE_DRAFTS_PATH, 'utf8')).replace(/^\uFEFF/, ''));
    const draft = drafts.find(item => item.to?.trim().toLowerCase() === targetEmail.trim().toLowerCase());
    if (!draft) throw new Error('No current machine-readable draft exists for this recipient.');
    const { subject, text, html, draftHash } = draft;
    const actualHash = createHash('sha256').update(JSON.stringify({ to: targetEmail.trim().toLowerCase(), subject, text, html })).digest('hex');
    if (actualHash !== draftHash) throw new Error('Draft payload hash is invalid. Regenerate drafts before approval.');
    console.log('OUTREACH_TARGET=' + targetEmail + ' DRAFT_HASH=' + draftHash);
    const campaign = isCampaignAuto ? await validateAutomaticCampaign(targetEmail) : null;
    if (isCampaignAuto && !campaign.ok) { console.log(`AUTO_OUTREACH_SKIPPED=${campaign.reason}`); process.exitCode = 2; return; }
    if (isCampaignAuto && !/balas\s+STOP/i.test(text)) { console.log('AUTO_OUTREACH_SKIPPED=draft is missing the STOP opt-out instruction'); process.exitCode = 2; return; }
    if (isPreview) { console.log(JSON.stringify({ to: targetEmail, subject, draftHash, autoEligible: campaign?.ok ?? undefined })); return; }
    let approval = null;
    if (!isCampaignAuto) {
      if (!approvalArg) throw new Error('Per-draft approval file is required.');
      approval = JSON.parse((await fs.readFile(approvalArg, 'utf8')).replace(/^\uFEFF/, ''));
      if (approval.to?.trim().toLowerCase() !== targetEmail.trim().toLowerCase() || approval.draftHash !== draftHash || approval.approvedBy !== 'Faturachman Al Kahfi' || !approval.approvalId || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now()) throw new Error('Approval expired or does not match recipient and draft.');
    }
    const dailyLockPath = LEDGER_PATH + '.daily.lock';
    const dailyLock = await fs.open(dailyLockPath, 'wx');
    const lockPath = LEDGER_PATH + '.' + draftHash + '.lock';
    let lock;
    try {
      await dailyLock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      lock = await fs.open(lockPath, 'wx');
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), draftHash }));
      if (isCampaignAuto && await getOutreachAttemptsInWindow(24 * 60 * 60 * 1000) >= 1) throw new Error('AUTO_OUTREACH_SKIPPED=one-email-per-24-hours campaign limit reached');
      if (!isCampaignAuto && await getOutreachAttemptsToday() >= MAX_EMAILS_PER_DAY) throw new Error('Daily founder-reviewed outreach limit reached; approval remains pending.');
      const prior = (await fs.readFile(LEDGER_PATH, 'utf8').catch(() => '')).replace(/^\uFEFF/, '');
      if (prior.split('\n').filter(Boolean).some(line => { try { const event = JSON.parse(line); return event.draftHash === draftHash && ['attempted', 'sent', 'unknown'].includes(event.status); } catch { return false; } })) throw new Error('Draft already attempted; reconcile manually.');
      try {
        await assertRecipientStillEligible(targetEmail);
      } catch (error) {
        try { await notifyFounderOutcome({ status: 'blocked', to: targetEmail, draftHash, detail: 'Current prospect tracker blocks this recipient; send refused.' }); }
        catch (notifyError) { console.error('Blocked-outreach Telegram notification failed:', notifyError); }
        throw error;
      }
      if (!await initEmailAdapter()) {
        await writeLedger({ status: 'failed', to: targetEmail, company: campaign?.lead.company_or_person, draftHash, approvalId: approval?.approvalId, approvalMode: isCampaignAuto ? 'founder_campaign_policy' : 'per_draft', campaignPolicyVersion: campaign?.policy.policyVersion, error: 'SMTP adapter initialization failed before send.' });
        await notifyFounderOutcome({ status: 'failed', to: targetEmail, draftHash, detail: 'SMTP initialization failed before send.' });
        process.exitCode = 1;
        return;
      }
      await writeLedger({ status: 'attempted', to: targetEmail, company: campaign?.lead.company_or_person, subject, draftHash, approvalId: approval?.approvalId, approvalMode: isCampaignAuto ? 'founder_campaign_policy' : 'per_draft', campaignPolicyVersion: campaign?.policy.policyVersion });
      let result;
      try { result = await sendEmail({ to: targetEmail, subject, text, html }); }
      catch (error) {
        await writeLedger({ status: 'unknown', to: targetEmail, company: campaign?.lead.company_or_person, draftHash, approvalId: approval?.approvalId, approvalMode: isCampaignAuto ? 'founder_campaign_policy' : 'per_draft', campaignPolicyVersion: campaign?.policy.policyVersion });
        await notifyFounderOutcome({ status: 'unknown', to: targetEmail, draftHash, detail: 'SMTP result needs manual reconciliation.' });
        throw error;
      }
      if (result.success) {
        await writeLedger({ status: 'sent', to: targetEmail, company: campaign?.lead.company_or_person, messageId: result.messageId, draftHash, approvalId: approval?.approvalId, approvalMode: isCampaignAuto ? 'founder_campaign_policy' : 'per_draft', campaignPolicyVersion: campaign?.policy.policyVersion });
        await notifyFounderOutcome({ status: 'sent', to: targetEmail, draftHash, detail: `Message ID: ${result.messageId || 'n/a'}` });
      } else {
        await writeLedger({ status: 'unknown', to: targetEmail, company: campaign?.lead.company_or_person, error: result.error, draftHash, approvalId: approval?.approvalId, approvalMode: isCampaignAuto ? 'founder_campaign_policy' : 'per_draft', campaignPolicyVersion: campaign?.policy.policyVersion });
        await notifyFounderOutcome({ status: 'unknown', to: targetEmail, draftHash, detail: 'SMTP result needs manual reconciliation.' });
        process.exitCode = 1;
      }
    } finally {
      await lock?.close().catch(() => {});
      if (lock) await fs.unlink(lockPath).catch(() => {});
      await dailyLock.close().catch(() => {});
      await fs.unlink(dailyLockPath).catch(() => {});
    }
  }

}

main().catch((error) => { console.error(error); process.exitCode = 1; });
