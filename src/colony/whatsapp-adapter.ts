// ============================================================================
// JAGAT Colony — WhatsApp Adapter
// Baileys-based WhatsApp Web client.
// Mode 1 (default): Send-only — push notifikasi ke grup, JANGAN chat nomor bot.
// Mode 2 (opt-in):  Conversational — bot bisa jawab pesan (mention di grup / DM).
// ============================================================================

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { ollamaService } from "../services/ollama.js";
import { env } from "../config/index.js";
import { composeSovereignSystemPrompt } from "../prompts/identity.js";

// ── Config ───────────────────────────────────────────────────────────────────

const AUTH_DIR = path.resolve(process.cwd(), "wa-auth-state");
const DEFAULT_RECONNECT_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_CONVERSATION_ENTRIES = 500; // auto-evict stale entries when Map exceeds this
const SEND_TIMEOUT_MS = 15_000; // 15s timeout for sendMessage to prevent zombie socket blocking
const INFERENCE_TIMEOUT_MS = 30_000; // 30s timeout for Ollama inference in WhatsApp context (vs 120s default)

export type ChatMode = "off" | "mention" | "dm" | "all";

const WA_CHAT_SYSTEM_PROMPT = [
  "Anda adalah JAGAT G7 — sovereign cognitive intelligence, bukan chatbot biasa.",
  "Jawab profesional, tajam, dan adaptif: singkat untuk pertanyaan sederhana, mendalam untuk analisis.",
  "Tidak perlu menjelaskan arsitektur teknis internal JAGAT G7.",
  "Jika pertanyaan di luar scope pengetahuan Anda, katakan dengan jujur.",
  "Untuk hitungan, tampilkan data dasar, asumsi, rumus, hasil per periode, risiko, dan rekomendasi.",
  "Verifikasi konsistensi angka sebelum menjawab; pisahkan fakta pengguna dari asumsi Anda.",
  "Jika diminta simulasi atau sample, berikan tepat sejumlah contoh yang diminta sebagai skenario yang dapat dibandingkan.",
  "Gunakan struktur dan tabel teks seperlunya agar jawaban WhatsApp tetap mudah dibaca.",
].join(" ");

const INFERENCE_MODEL = env.INFERENCE_MODEL; // from .env → ollamaService tries remote Qwen first, local fallback
const MAX_CONTEXT_MESSAGES = 10; // rolling window per sender
const CONTEXT_TTL_SECONDS = 600; // 10 menit

// ── State ────────────────────────────────────────────────────────────────────

let sock: WASocket | null = null;
let connectionState: "disconnected" | "connecting" | "connected" = "disconnected";
let reconnectAttempts = 0;
let lastQr: string | null = null;
let lastConnectedAt: string | null = null;
let lastDisconnectedAt: string | null = null;
let lastDisconnectReason: string | null = null;
let chatMode: ChatMode = (process.env.WA_CHAT_MODE as ChatMode) || "off";
let botJid: string | null = null; // JID of the bot itself

// Conversation history: key = sender JID, value = { messages[], lastActive }
const conversationHistory = new Map<
  string,
  { messages: Array<{ role: "user" | "assistant"; content: string }>; lastActive: number }
>();

// ── Public API ───────────────────────────────────────────────────────────────

export interface WhatsAppStatus {
  connected: boolean;
  state: string;
  lastQr: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastDisconnectReason: string | null;
  reconnectAttempts: number;
  chatMode: ChatMode;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return {
    connected: connectionState === "connected",
    state: connectionState,
    lastQr,
    lastConnectedAt,
    lastDisconnectedAt,
    lastDisconnectReason,
    reconnectAttempts,
    chatMode,
  };
}

export function getLastQr(): string | null {
  return lastQr;
}

export function setChatMode(mode: ChatMode): void {
  chatMode = mode;
  console.log(`[WA] Chat mode changed to: ${mode}`);
}

export function getChatMode(): ChatMode {
  return chatMode;
}

/**
 * Send a text message to a WhatsApp group.
 * @param groupJid - Group JID (e.g., "120363XXX@g.us")
 * @param text - Message text (supports WhatsApp markdown: *bold*, _italic_, ~strike~, ```code```)
 */
export async function sendToGroup(groupJid: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (!sock || connectionState !== "connected") {
    return { success: false, error: "WhatsApp not connected" };
  }

  try {
    await Promise.race([
      sock.sendMessage(groupJid, { text }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`sendMessage timeout after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
      ),
    ]);
    console.log(`[WA] Message sent to group ${groupJid} (${text.length} chars)`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WA] Failed to send to group ${groupJid}:`, err?.message ?? err);
    return { success: false, error: err?.message ?? "Unknown send error" };
  }
}

/**
 * Send a text message to a WhatsApp contact (individual).
 * @param jid - Contact JID (e.g., "6281234567890@s.whatsapp.net")
 * @param text - Message text
 */
export async function sendToContact(jid: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (!sock || connectionState !== "connected") {
    return { success: false, error: "WhatsApp not connected" };
  }

  try {
    await Promise.race([
      sock.sendMessage(jid, { text }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`sendMessage timeout after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
      ),
    ]);
    console.log(`[WA] Message sent to ${jid} (${text.length} chars)`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WA] Failed to send to ${jid}:`, err?.message ?? err);
    return { success: false, error: err?.message ?? "Unknown send error" };
  }
}

/**
 * Send a Voice Note (PTT) to a WhatsApp contact or group.
 * @param jid - Contact or Group JID
 * @param audioPath - Absolute path to the MP3 file
 */
export async function sendVoiceNote(jid: string, audioPath: string): Promise<{ success: boolean; error?: string }> {
  if (!sock || connectionState !== "connected") {
    return { success: false, error: "WhatsApp not connected" };
  }

  try {
    await Promise.race([
      sock.sendMessage(jid, { 
        audio: { url: audioPath }, 
        ptt: true, // Send as Voice Note (Push-to-Talk) rather than audio file
        mimetype: 'audio/mp4' // Baileys prefers this mime for voice notes even if mp3
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`sendMessage timeout after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
      ),
    ]);
    console.log(`[WA] Voice Note sent to ${jid}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WA] Failed to send voice note to ${jid}:`, err?.message ?? err);
    return { success: false, error: err?.message ?? "Unknown send error" };
  }
}

/**
 * List all groups the bot is currently in.
 */
export async function listGroups(): Promise<Array<{ jid: string; name: string }>> {
  if (!sock || connectionState !== "connected") {
    return [];
  }

  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map((g) => ({
      jid: g.id,
      name: g.subject ?? "Unknown Group",
    }));
  } catch (err: any) {
    console.error("[WA] Failed to list groups:", err?.message ?? err);
    return [];
  }
}

// ── Conversational AI (Ollama) ──────────────────────────────────────────────

/**
 * Generate AI reply using Ollama with rolling conversation context.
 */
async function generateReply(senderJid: string, incomingMessage: string): Promise<string> {
  try {
    // Get or create conversation context for this sender
    let ctx = conversationHistory.get(senderJid);
    if (!ctx) {
      ctx = { messages: [], lastActive: 0 };
      conversationHistory.set(senderJid, ctx);
    }

    // Purge stale contexts
    const now = Date.now();
    if (now - ctx.lastActive > CONTEXT_TTL_SECONDS * 1000) {
      ctx.messages = [];
    }
    ctx.lastActive = now;

    // Auto-evict stale entries when Map grows too large (prevents unbounded memory growth)
    if (conversationHistory.size > MAX_CONVERSATION_ENTRIES) {
      const evictionThreshold = now - CONTEXT_TTL_SECONDS * 2000; // 2x TTL
      for (const [jid, entry] of conversationHistory) {
        if (entry.lastActive < evictionThreshold) {
          conversationHistory.delete(jid);
        }
      }
    }

    // Add user message
    ctx.messages.push({ role: "user", content: incomingMessage });

    // Trim to rolling window
    while (ctx.messages.length > MAX_CONTEXT_MESSAGES) {
      ctx.messages.shift();
    }

    // Build prompt with conversation history
    const promptParts: string[] = [];
    for (const msg of ctx.messages) {
      if (msg.role === "user") {
        promptParts.push(`User: ${msg.content}`);
      } else {
        promptParts.push(`JAGAT: ${msg.content}`);
      }
    }
    promptParts.push("JAGAT:");
    const prompt = promptParts.join("\n");

    console.log(`[WA:AI] Generating reply for ${senderJid} (${ctx.messages.length} context messages)...`);
    const startTime = Date.now();

    const response = await Promise.race([
      ollamaService.generateCompletion(
        prompt,
        composeSovereignSystemPrompt(WA_CHAT_SYSTEM_PROMPT),
        INFERENCE_MODEL,
        { temperature: 0.3, top_p: 0.85, repeat_penalty: 1.15, num_predict: 1200 },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Ollama inference timeout after ${INFERENCE_TIMEOUT_MS}ms`)), INFERENCE_TIMEOUT_MS)
      ),
    ]);

    const elapsed = Date.now() - startTime;
    let reply = (response.response ?? "").trim();

    if (!reply) {
      reply = "Maaf, saya tidak bisa menghasilkan jawaban saat ini. Coba lagi nanti.";
    }

    // Add assistant reply to context
    ctx.messages.push({ role: "assistant", content: reply });
    while (ctx.messages.length > MAX_CONTEXT_MESSAGES) {
      ctx.messages.shift();
    }

    console.log(`[WA:AI] Reply generated in ${elapsed}ms (${reply.length} chars)`);
    return reply;
  } catch (err: any) {
    console.error(`[WA:AI] Error generating reply:`, err?.message ?? err);
    return "Maaf, terjadi kesalahan internal saat memproses pesan Anda.";
  }
}

// ── Message Handler ──────────────────────────────────────────────────────────

/**
 * Handle incoming messages based on chat mode.
 * - off:     No processing (send-only)
 * - mention: Reply only when bot is mentioned in group
 * - dm:      Reply only to direct messages
 * - all:     Reply to all (group mentions + DMs)
 */
async function handleIncomingMessage(msg: WAMessage): Promise<void> {
  // Skip if chat mode is off
  if (chatMode === "off") return;

  // Skip status broadcasts and bot's own messages
  if (msg.key.remoteJid === "status@broadcast") return;
  if (msg.key.fromMe) return;

  // Skip non-text messages (images, stickers, etc) for now
  const messageContent =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.ephemeralMessage?.message?.conversation ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text;

  if (!messageContent) return;

  const senderJid = msg.key.remoteJid ?? "";
  const isGroup = senderJid.endsWith("@g.us");
  const actualSender = isGroup ? (msg.key.participant ?? senderJid) : senderJid;

  // Group: get display name from pushName or participant
  const senderName = msg.pushName ?? actualSender.split("@")[0];

  // ── Mode filtering ──
  if (isGroup) {
    if (chatMode === "dm") return; // DM-only, skip group messages

    // Check if bot is mentioned
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const isBotMentioned = botJid ? mentionedJids.includes(botJid) : false;

    if (chatMode === "mention" && !isBotMentioned) return; // Only respond when mentioned

    // Clean message: remove @mention tags
    let cleanMessage = messageContent;
    if (isBotMentioned && botJid) {
      // Remove @mention from text
      const botNumber = botJid.split("@")[0];
      cleanMessage = cleanMessage.replace(new RegExp(`@${botNumber}`, "gi"), "").trim();
    }

    if (!cleanMessage) {
      // User only sent @mention without text
      cleanMessage = "Halo";
    }

    console.log(`[WA:MSG] Group ${senderJid} | ${senderName}: ${cleanMessage.substring(0, 100)}`);
    const reply = await generateReply(actualSender, `[Grup ${senderName}]: ${cleanMessage}`);

    // Reply in group (quoted) — with timeout to prevent zombie socket blocking
    if (sock) {
      try {
        await Promise.race([
          sock.sendMessage(senderJid, { text: reply }, { quoted: msg }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`reply timeout after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
          ),
        ]);
      } catch (err: any) {
        console.error(`[WA] Failed to reply in group ${senderJid}:`, err?.message ?? err);
      }
    }
  } else {
    // DM mode
    if (chatMode === "mention") return; // Mention-only, skip DMs

    console.log(`[WA:MSG] DM from ${senderName} (${actualSender}): ${messageContent.substring(0, 100)}`);
    const reply = await generateReply(actualSender, messageContent);

    // Reply in DM — with timeout to prevent zombie socket blocking
    if (sock) {
      try {
        await Promise.race([
          sock.sendMessage(senderJid, { text: reply }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`reply timeout after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)
          ),
        ]);
      } catch (err: any) {
        console.error(`[WA] Failed to reply DM to ${senderJid}:`, err?.message ?? err);
      }
    }
  }
}

// ── Connection Lifecycle ─────────────────────────────────────────────────────

/**
 * Initialize WhatsApp connection. Will emit QR code for first-time pairing.
 * Subsequent runs reuse saved auth state from wa-auth-state/.
 */
export async function connectWhatsApp(): Promise<void> {
  if (connectionState === "connecting") {
    console.log("[WA] Already connecting, skipping...");
    return;
  }

  try {
    // Ensure auth dir exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    connectionState = "connecting";

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      // Reduce noise
      logger: {
        level: "silent",
      child: () => ({ level: "silent" } as any),
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    } as any,
  });

  // Save credentials on update — wrap in try-catch
  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
    } catch (err: any) {
      console.error("[WA] Error saving creds:", err?.message ?? err);
    }
  });

  // Capture bot's own JID
  if (state.creds?.me?.id) {
    botJid = state.creds.me.id;
  }

  // Handle connection updates — wrap in try-catch to prevent uncaughtException crash
  sock.ev.on("connection.update", (update) => {
    try {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQr = qr;
      console.log("[WA] QR Code received. Scan with WhatsApp to pair.");
      console.log("[WA] QR (for manual scan):", qr);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      connectionState = "disconnected";
      lastDisconnectedAt = new Date().toISOString();
      lastDisconnectReason = `statusCode=${statusCode}`;
      sock = null;

      console.log(`[WA] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[WA] Reconnecting in ${DEFAULT_RECONNECT_MS}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => connectWhatsApp(), DEFAULT_RECONNECT_MS);
      } else if (!shouldReconnect) {
        console.log("[WA] Logged out. Auth state cleared. Need new QR scan.");
        reconnectAttempts = 0;
      } else {
        console.log(`[WA] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Manual reconnect required.`);
      }
    }

    if (connection === "open") {
      connectionState = "connected";
      reconnectAttempts = 0;
      lastQr = null;
      lastConnectedAt = new Date().toISOString();
      // Capture bot JID on connect
      if (sock?.user?.id) {
        botJid = sock.user.id;
      }
      console.log(`[WA] ✅ Connected to WhatsApp! Bot JID: ${botJid}`);
      console.log(`[WA] Chat mode: ${chatMode}`);
    }
    } catch (err: any) {
      console.error("[WA] Error in connection.update handler:", err?.message ?? err);
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async (upsert) => {
    if (upsert.type !== "notify") return;

    for (const msg of upsert.messages) {
      try {
        await handleIncomingMessage(msg);
      } catch (err: any) {
        console.error(`[WA] Error handling message:`, err?.message ?? err);
      }
    }
  });

  } catch (err: any) {
    console.error("[WA] connectWhatsApp failed:", err?.message ?? err);
    connectionState = "disconnected";
    lastDisconnectedAt = new Date().toISOString();
    lastDisconnectReason = `init_error: ${err?.message ?? "unknown"}`;
  }
}

/**
 * Gracefully disconnect WhatsApp.
 */
export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    try {
      sock.end(undefined);
    } catch {
      // Ignore errors on disconnect
    }
    sock = null;
  }
  connectionState = "disconnected";
  lastDisconnectedAt = new Date().toISOString();
  console.log("[WA] Disconnected.");
}

/**
 * Force reconnect (clear state and reconnect).
 */
export async function reconnectWhatsApp(): Promise<void> {
  await disconnectWhatsApp();
  reconnectAttempts = 0;
  await connectWhatsApp();
}
