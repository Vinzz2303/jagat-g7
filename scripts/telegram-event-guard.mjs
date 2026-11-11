import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TELEGRAM_LEDGER = path.join(__dirname, '../ops/revenue/telegram-events.jsonl');

/**
 * Computes a deterministic SHA-256 hash for draft versioning
 */
export function computeDraftHash(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Builds deterministic event identity key incorporating:
 * lead_id, campaign_id, draft_version, and event_type
 */
export function buildEventKey({ lead_id, campaign_id, draft_version, event_type }) {
  const leadClean = String(lead_id || 'all_leads').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const campClean = String(campaign_id || 'camp_default').trim().toLowerCase();
  const typeClean = String(event_type || 'NOTIF').trim().toUpperCase();
  const verClean = String(draft_version || 'v1').trim();

  return `${leadClean}:${campClean}:${typeClean}:${verClean}`;
}

/**
 * Checks if this exact event identity was already sent and delivered
 */
export async function isEventAlreadySent(eventKey, ledgerPath = DEFAULT_TELEGRAM_LEDGER) {
  try {
    const raw = await fs.readFile(ledgerPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.event_key === eventKey && record.status === 'DELIVERED') {
          return true;
        }
      } catch {
        // Skip corrupted line gracefully
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[TelegramGuard] Warning reading ledger ${ledgerPath}:`, err.message);
    }
  }
  return false;
}

/**
 * Atomically records the sent notification to prevent future duplicate broadcasts
 */
export async function recordTelegramEvent(params, ledgerPath = DEFAULT_TELEGRAM_LEDGER) {
  const eventId = `notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const record = {
    event_id: eventId,
    event_key: params.event_key,
    lead_id: params.lead_id || 'all_leads',
    campaign_id: params.campaign_id || 'camp-id-b2b-q4',
    draft_version: params.draft_version,
    event_type: params.event_type,
    summary: params.summary || '',
    sent_at: now,
    status: 'DELIVERED',
  };

  const dir = path.dirname(ledgerPath);
  await fs.mkdir(dir, { recursive: true });

  const line = JSON.stringify(record) + '\n';
  await fs.appendFile(ledgerPath, line, 'utf8');

  return record;
}
