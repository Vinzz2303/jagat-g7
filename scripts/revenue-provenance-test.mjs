import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectCompany } from './prospect-discovery-agent-v1.mjs';
import { topLeads } from './email-outreach-draft-agent-v1.mjs';
import { campaignLeadEligibility } from './outreach-campaign-guard.mjs';

globalThis.fetch = async () => { throw new Error('Network disabled for synthetic regression'); };
const policy = { enabled: true, policyVersion: '2026-11-07-v1', authorizedBy: 'Faturachman Al Kahfi', maxPerCycle: 1, maxPerDay: 1, followups: false, allowedRoleLocalParts: ['sales', 'contact', 'info'] };
const category = { niche: 'synthetic', offer: 'AI Admin Bot' };
const directory = 'https://www.indonesiayp.com/company/999999/synthetic';
const website = 'https://synthetic.invalid/';
const role = 'sales@synthetic.invalid';
let assertions = 0;
function check(actual, expected) { assert.deepEqual(actual, expected); assertions++; }
async function discover({ directoryEmail = 'info@directory.invalid', siteEmail = role, redirect = website, linkedWebsite = true, mx = true } = {}) {
  return inspectCompany(directory, category, {
    campaignPolicy: policy,
    validateMx: async () => mx,
    fetchPage: async url => url === directory
      ? { html: `<title>Synthetic Business - Listing</title><a href="${website}">${linkedWebsite ? 'Website' : 'Advertisement'}</a>${directoryEmail}`, url }
      : { html: siteEmail, url: redirect === website ? url : redirect },
  });
}
const official = await discover();
check(official.public_contact, role);
check(official.source, `official_site:${website}`);
check(campaignLeadEligibility(official, policy).ok, true);
check(official.notes.includes(directory), true);
const directoryOnly = await discover({ siteEmail: '' });
check(directoryOnly.source, `puppeteer_discovery:${directory}`);
check(campaignLeadEligibility(directoryOnly, policy).ok, false);
const redirected = await discover({ redirect: 'https://other.invalid/contact' });
check(redirected.source, `puppeteer_discovery:${directory}`);
check(redirected.public_contact, 'info@directory.invalid');
const mismatched = await discover({ directoryEmail: '', siteEmail: 'sales@other.invalid' });
check(mismatched.source, `puppeteer_discovery:${directory}`);
const genericLink = await discover({ linkedWebsite: false });
check(genericLink.source, `puppeteer_discovery:${directory}`);
check(await discover({ mx: false }), null);
// Official evidence is preferred even when the directory repeats a contact.
check((await discover({ directoryEmail: role })).source, `official_site:${website}`);
check((await discover({ siteEmail: 'admin@synthetic.invalid', directoryEmail: '' })).public_contact, 'admin@synthetic.invalid');
// A personal mailbox on the first page must not hide a role inbox on /contact.
const contactPageLead = await inspectCompany(directory, category, {
  campaignPolicy: policy, validateMx: async () => true,
  fetchPage: async url => url === directory
    ? { html: `<a href="${website}">Website</a>`, url }
    : { html: url.endsWith('/contact') ? role : 'person@synthetic.invalid', url },
});
check(contactPageLead.public_contact, role);
check(contactPageLead.source, 'official_site:https://synthetic.invalid/contact');

// Directory redirect URLs alone may point at advertisers, not the business.
for (const label of ['Sponsored Advertisement', 'Website']) {
  const redirectedLead = await inspectCompany(directory, category, {
    campaignPolicy: policy, validateMx: async () => true,
    fetchPage: async url => url === directory
      ? { html: `<title>Synthetic Business</title><a href="/redir/7?u=https%3A%2F%2Fsynthetic.invalid">${label}</a>info@directory.invalid`, url }
      : { html: role, url },
  });
  check(redirectedLead.source.startsWith('official_site:'), label === 'Website');
}

// Same field structure as the RDP report's real IndonesiaYP HTML. Domains and
// IDs are synthetic; no real company is contacted during this regression.
const websiteAddressFixture = `<div class="info"><div class="label">Website address</div><div class="text weblinks"><a href="/redir/999999?u=www.synthetic.invalid" target="_blank" rel="noopener nofollow">www.synthetic.invalid</a></div></div>`;
const adFixture = `<a href="/redir/8?u=advertiser.invalid">Sponsored Advertisement</a>`;
for (const [html, expectedOfficial] of [
  [websiteAddressFixture, true],
  [adFixture + websiteAddressFixture, true],
  [websiteAddressFixture.replace('Website address', 'Website'), true],
  [websiteAddressFixture.replace('Website address', 'Sponsored Website address'), false],
  [adFixture, false],
]) {
  const lead = await inspectCompany(directory, category, {
    campaignPolicy: policy, validateMx: async () => true,
    fetchPage: async url => url === directory
      ? { html: `<title>Synthetic Business</title>${html}info@directory.invalid`, url }
      : { html: role, url },
  });
  check(lead.source.startsWith('official_site:'), expectedOfficial);
  check(campaignLeadEligibility(lead, policy).ok, expectedOfficial);
  if (expectedOfficial) {
    check(lead.website, 'https://www.synthetic.invalid/');
    check(lead.public_contact, role);
    check(lead.source, 'official_site:https://www.synthetic.invalid/');
  }
}

const select = (leads, sent = new Set(), suppressed = new Set(), history = []) => topLeads(leads, sent, 5, suppressed, policy, history);
for (const patch of [
  { source: `puppeteer_discovery:${directory}` },
  { source: 'official_site:https://unrelated.invalid/' },
  { public_contact: 'person@synthetic.invalid' },
  { public_contact: 'sales@gmail.com', website: 'https://gmail.com', source: 'official_site:https://gmail.com' },
  { public_contact: 'sales@other.invalid' },
  { status: 'sent' }, { status: 'rejected' }, { status: 'follow_up' },
  { response: 'STOP' }, { response: 'Tidak tertarik' },
]) check(select([{ ...official, ...patch }]).length, 0);
check(select([official], new Set([role])).length, 0);
check(select([official], new Set(), new Set([role])).length, 0);
check(select([official, { ...official, public_contact: ` ${role.toUpperCase()} `, status: 'demo_ready' }]).length, 1);
check(select([official, { ...official, public_contact: 'contact@synthetic.invalid' }]).length, 1);
check(select([official], new Set(), new Set(), [{ status: 'unknown', company: 'SYNTHETIC BUSINESS', to: 'old@synthetic.invalid' }]).length, 0);
check(topLeads([directoryOnly], new Set(), 5, new Set(), null).length, 1); // Manual approval mode preserved.
check(campaignLeadEligibility(official, { ...policy, allowedRoleLocalParts: 'sales' }).ok, false);

// Run actual draft CLI only on synthetic files; every fetch is denied by preload.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jagat provenance #-'));
const revenue = path.join(temp, 'ops/revenue');
await fs.mkdir(revenue, { recursive: true });
await fs.mkdir(path.join(temp, 'scripts'));
for (const name of ['email-outreach-draft-agent-v1.mjs', 'email-quality-guard.mjs', 'outreach-campaign-guard.mjs', 'telegram-event-guard.mjs', 'revenue-notification.mjs', 'revenue-status-snapshot.mjs']) {
  await fs.copyFile(path.join(root, 'scripts', name), path.join(temp, 'scripts', name));
}
const preload = path.join(temp, 'no-network.mjs');
await fs.writeFile(preload, 'globalThis.fetch = async () => { throw new Error("Synthetic network block"); };');
const run = () => spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/email-outreach-draft-agent-v1.mjs', '--send-telegram'], { cwd: temp, encoding: 'utf8', env: { ...process.env, USERPROFILE: temp, TELEGRAM_BOT_TOKEN: 'synthetic-token', TELEGRAM_FOUNDER_CHAT_ID: 'synthetic' } });
const headers = Object.keys(official);
const csv = rows => [headers.join(','), ...rows.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','))].join('\n') + '\n';
await fs.writeFile(path.join(revenue, 'PROSPECT_TRACKER.csv'), csv([directoryOnly, official]));
await fs.writeFile(path.join(revenue, 'AUTO_SEND_POLICY.json'), JSON.stringify(policy));
await fs.writeFile(path.join(revenue, 'SUPPRESSION_LIST.json'), '[]');
const result = run();
check(result.status, 0);
check(result.stdout.includes('TELEGRAM_SENT=false'), true);
check(result.stdout.includes('EMAIL_DRAFT_AGENT=PASS'), true);
const drafts = JSON.parse(await fs.readFile(path.join(revenue, 'OUTREACH_DRAFTS.json'), 'utf8'));
check(drafts.length, 1);
check(drafts[0].to, role);
check(drafts[0].source, `official_site:${website}`);
check(/balas STOP/.test(drafts[0].text), true);
await fs.writeFile(path.join(revenue, 'outreach-send-ledger.jsonl'), JSON.stringify({ status: 'unknown', to: role }) + '\n');
const emptyResult = run();
check(emptyResult.status, 0);
check(emptyResult.stdout.includes('DRAFTS=0'), true);
check(JSON.parse(await fs.readFile(path.join(revenue, 'OUTREACH_DRAFTS.json'), 'utf8')), []);
await fs.writeFile(path.join(revenue, 'outreach-send-ledger.jsonl'), 'invalid\n');
check(run().status, 1);
await fs.writeFile(path.join(revenue, 'outreach-send-ledger.jsonl'), '');
await fs.writeFile(path.join(revenue, 'AUTO_SEND_POLICY.json'), '{"enabled":true}');
check(run().status, 1);
await fs.writeFile(path.join(revenue, 'AUTO_SEND_POLICY.json'), '{"enabled":false}');
check(run().status, 0);
check(JSON.parse(await fs.readFile(path.join(revenue, 'OUTREACH_DRAFTS.json'), 'utf8')).length, 2);
console.log(JSON.stringify({ status: 'PASS', assertions, network: 'disabled; browser and MX mocked', artifacts: temp }));
