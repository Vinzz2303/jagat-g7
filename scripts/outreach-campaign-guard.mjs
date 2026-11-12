// Shared D-052 eligibility. This never authorizes a send by itself: the sender
// still checks suppression, history, limits, locks, draft hash and opt-out text.
import { isPlausibleOutreachEmail } from './email-quality-guard.mjs';

export function isValidCampaignPolicy(policy) {
  return policy?.enabled === true && policy.policyVersion === '2026-11-07-v1' &&
    policy.authorizedBy === 'Faturachman Al Kahfi' && policy.maxPerCycle === 1 &&
    policy.maxPerDay === 1 && policy.followups === false &&
    Array.isArray(policy.allowedRoleLocalParts) && policy.allowedRoleLocalParts.length > 0 &&
    policy.allowedRoleLocalParts.every(value => typeof value === 'string' && /^[a-z0-9._+-]+$/.test(value));
}

export function hasOutreachRefusal(lead) {
  const status = String(lead.status || '').trim().toLowerCase();
  return ['emailed', 'sent', 'suppressed', 'unsubscribed', 'rejected', 'declined', 'do_not_contact', 'opted_out', 'closed_lost', 'not_interested'].includes(status) ||
    /\b(?:STOP|not interested|do not contact|unsubscribe|remove me|stop emailing|tidak tertarik|jangan hubungi|berhenti berlangganan|hapus alamat email)\b/i.test(String(lead.response || ''));
}

export function websiteHost(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

export function normalizedCompany(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function campaignLeadEligibility(lead, policy) {
  if (!isValidCampaignPolicy(policy)) return { ok: false, reason: 'campaign policy is disabled or invalid' };
  if (!lead || hasOutreachRefusal(lead) || !['new', 'email_found', 'demo_ready'].includes(String(lead.status || '').trim().toLowerCase())) {
    return { ok: false, reason: 'lead status/refusal does not allow automated contact' };
  }
  const email = String(lead.public_contact || '').trim().toLowerCase();
  const [local, domain] = email.split('@');
  const freeDomains = new Set(['gmail.com', 'yahoo.com', 'yahoo.co.id', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com']);
  const host = websiteHost(lead.website);
  const source = String(lead.source || '');
  const sourceHost = source.startsWith('official_site:') ? websiteHost(source.slice('official_site:'.length)) : '';
  if (!isPlausibleOutreachEmail(email) || !policy.allowedRoleLocalParts.includes(local) || freeDomains.has(domain) || !host || domain !== host || sourceHost !== host) {
    return { ok: false, reason: 'recipient must be a role mailbox on the official website domain' };
  }
  return { ok: true };
}
