import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_TELEGRAM_LEDGER, getTelegramEventStatus, recordTelegramEvent } from './telegram-event-guard.mjs';

// Only optional brief/draft reporting uses this helper. SMTP outcomes are separate.
export async function sendRevenueTelegram({ botToken, chatId, text, event, ledgerPath = DEFAULT_TELEGRAM_LEDGER, fetchImpl = fetch }) {
  if (!botToken || !chatId) throw new Error('Telegram configuration unavailable.');
  if (!event?.event_key || !event?.event_type) throw new Error('Telegram event identity unavailable.');
  const eventKey = event.event_key;
  const lockPath = `${ledgerPath}.${createHash('sha256').update(eventKey).digest('hex')}.lock`;
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  let lock;
  try { lock = await fs.open(lockPath, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') return { status: 'UNKNOWN', sent: false, skipped: true, eventKey };
    throw error;
  }
  try {
    const previous = await getTelegramEventStatus(eventKey, ledgerPath);
    if (previous === 'DELIVERED') return { status: 'SKIPPED', sent: false, skipped: true, eventKey };
    if (previous === 'ATTEMPTED' || previous === 'UNKNOWN') {
      return { status: 'UNKNOWN', sent: false, skipped: true, eventKey };
    }
    // Durable intent precedes the request: a crash cannot cause blind replay.
    await recordTelegramEvent({ ...event, status: 'ATTEMPTED' }, ledgerPath);
    let status = 'UNKNOWN';
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true && Number.isInteger(data?.result?.message_id) && data.result.message_id > 0) status = 'DELIVERED';
      else if (data?.ok === false || (response.status >= 400 && response.status < 500)) status = 'FAILED';
    } catch {
      // Network/timeout failures may occur after Telegram accepted the message.
      // Never log error text: it can contain the bot token or request URL.
    }
    try {
      await recordTelegramEvent({ ...event, status, summary: status === 'DELIVERED' ? event.summary : `Telegram ${status.toLowerCase()}; ${status === 'UNKNOWN' ? 'manual reconciliation required; no automatic replay' : 'request rejected'}.` }, ledgerPath);
    } catch {
      console.error('TELEGRAM_LEDGER_STATUS=FAILED');
      // ATTEMPTED remains durable: do not claim a recorded delivery or replay.
      status = 'UNKNOWN';
    }
    return { status, sent: status === 'DELIVERED', skipped: false, eventKey };
  } finally {
    await lock.close().catch(() => {});
    await fs.unlink(lockPath).catch(() => { console.error('TELEGRAM_LOCK_STATUS=REQUIRES_REVIEW'); });
  }
}

export async function runRevenueNotification({ enabled, eventType, send, ledgerPath = DEFAULT_TELEGRAM_LEDGER }) {
  let outcome = { status: 'NOT_REQUESTED', sent: false };
  if (enabled) {
    try { outcome = await send(); }
    catch {
      // The artifact is already durable. Notification/config/audit failures do not
      // change its success, and are explicitly visible to monitoring/operators.
      outcome = { status: 'FAILED', sent: false };
      try {
        await recordTelegramEvent({ event_type: eventType, status: 'FAILED', summary: 'Optional Telegram notification failed; inspect configuration or local ledger. No automatic retry in this run.' }, ledgerPath);
      } catch { console.error('TELEGRAM_LEDGER_STATUS=FAILED'); }
    }
  }
  console.log(`TELEGRAM_STATUS=${outcome.status}`);
  console.log(`TELEGRAM_SENT=${outcome.sent === true}`);
  return outcome;
}
