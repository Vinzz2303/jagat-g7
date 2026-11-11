// ============================================================================
// JAGAT Colony — Telegram Adapter
// Modul gateway untuk mengirim pesan Teks dan Voice Note ke Telegram
// ============================================================================

import fs from 'fs/promises';
import path from 'path';

/**
 * Retrieves the Telegram Bot Token and Chat ID from .env or .openclaw config
 */
async function getTelegramConfig(): Promise<{ botToken: string; chatId: string }> {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID;

  if (botToken && chatId) {
    return { botToken, chatId };
  }

  // Fallback to openclaw config
  const openclawConfigPath = path.join(
    process.env.USERPROFILE ?? "C:\\Users\\Administrator",
    ".openclaw",
    "openclaw.json"
  );

  try {
    const raw = await fs.readFile(openclawConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    botToken = botToken || parsed?.channels?.telegram?.botToken;
    chatId = chatId || parsed?.channels?.telegram?.allowFrom?.[0];
  } catch (err) {
    console.log("[TelegramAdapter] OpenClaw config not found or invalid.");
  }

  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_FOUNDER_CHAT_ID is missing.");
  }

  return { botToken, chatId };
}

/**
 * Sends a Text Message to the Founder's Telegram
 */
export async function sendTelegramText(text: string): Promise<void> {
  const { botToken, chatId } = await getTelegramConfig();

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Telegram sendText failed (${response.status}): ${errText}`);
  }
  
  console.log(`[TelegramAdapter] Text message sent successfully.`);
}

/**
 * Sends an MP3 file as a Voice Note (Audio Message) to the Founder's Telegram
 */
export async function sendTelegramVoiceNote(audioPath: string): Promise<void> {
  const { botToken, chatId } = await getTelegramConfig();

  const fileBuffer = await fs.readFile(audioPath);
  const blob = new Blob([fileBuffer], { type: 'audio/mp3' });
  
  // Create FormData for multipart upload
  const formData = new FormData();
  formData.append('chat_id', chatId);
  // Telegram API allows 'voice' or 'audio'. 'voice' makes it an official PTT Voice Note (.ogg usually, but mp3 works).
  // 'audio' makes it a music player message. We use 'voice' to make it look like the AI is speaking.
  formData.append('voice', blob, 'voice-note.mp3');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(60000), // Uploads might take longer
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Telegram sendVoice failed (${response.status}): ${errText}`);
  }
  
  console.log(`[TelegramAdapter] Voice Note sent successfully to Chat ID: ${chatId}`);
}
