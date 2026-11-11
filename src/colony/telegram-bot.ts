// @ts-nocheck
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { HybridRouter } from '../services/hybrid-router.js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

dotenv.config();

const execAsync = util.promisify(exec);
const jagatToken = process.env.TELEGRAM_BOT_TOKEN;
const tingsToken = process.env.TELEGRAM_BOT_TOKEN_TINGS;
const ownerId = process.env.TELEGRAM_FOUNDER_CHAT_ID;
const ROOT = process.cwd();

if (!jagatToken || !tingsToken || !ownerId) {
  console.error("Missing TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_TOKEN_TINGS, or TELEGRAM_FOUNDER_CHAT_ID");
  process.exit(1);
}

const botJagat = new Telegraf(jagatToken);
const botTings = new Telegraf(tingsToken);

// Catch unhandled errors from Telegraf polling loops to prevent process exit
botJagat.catch((err) => {
  console.error("❌ JAGAT Bot (God Mode) Polling Error:", err);
});
botTings.catch((err) => {
  console.error("❌ TINGS AI Bot (Analyst Mode) Polling Error:", err);
});

console.log("🤖 Starting Dual Telegram Bot Engine...");

// ── Helper: Sliding window conversation memory ─────────────────────────────
const conversationHistory: string[] = [];
function updateHistory(msg: string) {
  conversationHistory.push(msg);
  if (conversationHistory.length > 20) {
    conversationHistory.shift();
  }
}

// ── Helper: Extract JSON safely from potentially truncated/malformed AI output
function safeExtractJson(text: string): any | null {
  // 1. Direct parse
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // 2. Try to find JSON block via regex
  try {
    const match = text.match(/\{[\s\S]*?"action"\s*:\s*"(run_command|reply)"[\s\S]*?\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch { /* continue */ }

  // 3. Regex extraction of action + command/replyText
  try {
    const actionMatch = text.match(/"action"\s*:\s*"(run_command|reply)"/);
    const replyMatch = text.match(/"replyText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const cmdMatch = text.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (actionMatch) {
      return {
        action: actionMatch[1],
        replyText: replyMatch ? replyMatch[1] : null,
        command: cmdMatch ? cmdMatch[1] : null,
      };
    }
  } catch { /* continue */ }

  return null;
}

// ── Helper: Exponential backoff launch ────────────────────────────────────
async function launchWithRetry(
  bot: Telegraf,
  name: string,
  maxAttempts = 5,
  baseDelayMs = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // dropPendingUpdates clears stale getUpdates sessions on Telegram API
      bot.launch({ dropPendingUpdates: true }).catch(err => {
        const isConflict = err?.message?.includes('409') || err?.message?.includes('Conflict');
        const isNetwork = err?.message?.includes('ECONNRESET') || err?.message?.includes('fetch failed') || err?.message?.includes('ETIMEDOUT');
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        
        if (isConflict) {
          console.warn(`⚠️ ${name} Attempt ${attempt}/${maxAttempts}: 409 Conflict (other instance). Waiting ${delay}ms...`);
        } else if (isNetwork) {
          console.warn(`⚠️ ${name} Attempt ${attempt}/${maxAttempts}: Network error. Waiting ${delay}ms...`);
        } else {
          console.error(`❌ ${name} Attempt ${attempt}/${maxAttempts}: ${err.message}`);
        }
        
        if (attempt === maxAttempts) {
          console.error(`❌ ${name} failed to start after ${maxAttempts} attempts. Will retry in background.`);
          setTimeout(() => launchWithRetry(bot, name, maxAttempts, baseDelayMs), 120_000);
          return;
        }
        
        setTimeout(() => launchWithRetry(bot, name, maxAttempts, delay), delay);
      });
      console.log(`✅ ${name} is ONLINE and listening...`);
      return;
    } catch (err: any) {
      const isConflict = err?.message?.includes('409') || err?.message?.includes('Conflict');
      const isNetwork = err?.message?.includes('ECONNRESET') || err?.message?.includes('fetch failed') || err?.message?.includes('ETIMEDOUT');
      const delay = baseDelayMs * Math.pow(2, attempt - 1);

      if (isConflict) {
        console.warn(`⚠️ ${name} Attempt ${attempt}/${maxAttempts}: 409 Conflict (other instance). Waiting ${delay}ms...`);
      } else if (isNetwork) {
        console.warn(`⚠️ ${name} Attempt ${attempt}/${maxAttempts}: Network error. Waiting ${delay}ms...`);
      } else {
        console.error(`❌ ${name} Attempt ${attempt}/${maxAttempts}: ${err.message}`);
      }

      if (attempt === maxAttempts) {
        console.error(`❌ ${name} failed to start after ${maxAttempts} attempts. Will retry in background.`);
        // Schedule background retry every 2 minutes
        setTimeout(() => launchWithRetry(bot, name, maxAttempts, baseDelayMs), 120_000);
        return;
      }

      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// ============================================================================
// 1. JAGAT BOT (God Mode / Executive Assistant) - Gemini API
// ============================================================================

botJagat.use(async (ctx, next) => {
  if (ctx.message && 'text' in ctx.message) {
    console.log(`[DEBUG JAGAT] Message Text: ${ctx.message.text}`);
  }
  return next();
});

botJagat.start((ctx) => {
  ctx.reply("Halo Bos Fatur! Otak Telegram JAGAT (God Mode) online. Siap menerima perintah eksekutif VPS.");
});

// ── JAGAT Intent Router ──────────────────────────────────────────────────
const JAGAT_ROUTER_PROMPT = `Anda adalah "JAGAT Cognitive Router" untuk JAGAT Bot.
Tugas Anda: Membaca pesan user dan mengklasifikasikan intent (niat) utama ke dalam salah satu kategori berikut:
- "CASUAL_CHAT": Obrolan santai, pertanyaan umum, perkenalan diri (siapa anda/saya), diskusi, atau pernyataan untuk istirahat/jeda. WAJIB pilih ini jika user hanya bertanya.
- "FIND_PROSPECT": Perintah EKSPLISIT untuk mencarikan kontak/prospek WhatsApp saat ini (misal: "cari prospek", "cari nomor baru"). JANGAN pilih ini jika user hanya bertanya.
- "START_SWARM": Perintah EKSPLISIT untuk menjalankan/menembakkan swarm revenue (email masal, massal, dll).
- "IT_COMMAND": Perintah teknis IT (cek RAM, hapus file, baca log, jalankan script selain swarm).
- "FIND_VENTURE": Perintah EKSPLISIT untuk mencari, meriset, atau menghubungi Venture Capital saat ini.
- "JARVIS_MODE": Perintah untuk bekerja mandiri (autonomous), nge-code, cari bounty github, install sesuatu, atau menyelesaikan task rumit multi-step. Biasanya diawali "JAGAT tolong kerjakan", "JAGAT buatkan folder", atau "JAGAT cari bug".

PENTING:
- Jika pesan berupa pertanyaan perkenalan seperti "siapa anda" atau "siapa fatur", MUTLAK pilih "CASUAL_CHAT".
- Jika pesan berisi rencana masa depan seperti "sebelum kita nyari venture", maka itu BUKAN FIND_VENTURE atau FIND_PROSPECT saat ini, melainkan CASUAL_CHAT.

HANYA BERIKAN OUTPUT JSON murni:
{
  "intent": "CASUAL_CHAT" | "FIND_PROSPECT" | "START_SWARM" | "IT_COMMAND" | "FIND_VENTURE" | "JARVIS_MODE",
  "reasoning": "alasan singkat"
}`;

async function evaluateJagatIntent(text: string, history: string[]): Promise<string> {
  const t = text.toLowerCase();
  if (t.includes("siapa") || t.includes("halo") || t.includes("hai") || t.includes("kamu ini")) {
    return "CASUAL_CHAT";
  }
  if (/\b(cari|carikan|temukan|find)\b/.test(t) && /\b(prospek|prospect|lead)\b/.test(t)) {
    return "FIND_PROSPECT";
  }

  const prompt = `Konteks obrolan sebelumnya:\n${history.slice(-3).join('\n')}\n\nPesan User saat ini:\n"${text}"\n\nTentukan intent dari pesan di atas!`;
  try {
    const res = await HybridRouter.callGroqFast(prompt, JAGAT_ROUTER_PROMPT, false);
    const cleaned = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const payload = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (parseError) {
      const recoveredIntent = cleaned.match(/"intent"\s*:\s*"(CASUAL_CHAT|FIND_PROSPECT|START_SWARM|IT_COMMAND|FIND_VENTURE|JARVIS_MODE)"/);
      if (!recoveredIntent) throw parseError;
      console.warn("[JAGAT ROUTER] Recovered intent from malformed JSON.");
      parsed = { intent: recoveredIntent[1] };
    }
    const allowed = ["CASUAL_CHAT", "FIND_PROSPECT", "START_SWARM", "IT_COMMAND", "FIND_VENTURE", "JARVIS_MODE"];
    return allowed.includes(parsed?.intent) ? parsed.intent : "CASUAL_CHAT";
  } catch (err) {
    console.error("JAGAT Router Error:", err);
    return "CASUAL_CHAT";
  }
}

botJagat.on('text', async (ctx) => {
  const text = ctx.message.text;
  const isOwner = ctx.from?.id.toString() === ownerId;
  
  if (!isOwner) {
    return ctx.reply("Akses ditolak. Bot ini khusus untuk CEO.");
  }
  
  console.log(`[JAGAT] Received God Mode command: ${text}`);
  ctx.sendChatAction('typing');

  // Fast-path: Langsung tampilkan daftar prospek jika user meminta prospek
  const lowerText = text.toLowerCase();
  if (lowerText.includes('status revenue') || lowerText.includes('status prospek') || lowerText.includes('status outreach')) {
    try {
      const dir = path.join(ROOT, 'ops/revenue');
      const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, '');
      const trackerCount = Math.max(0, read('PROSPECT_TRACKER.csv').split(/\r?\n/).filter(Boolean).length - 1);
      const drafts = JSON.parse(read('OUTREACH_DRAFTS.json'));
      const approvalsDir = path.join(dir, 'approvals');
      const approvals = fs.existsSync(approvalsDir) ? fs.readdirSync(approvalsDir).filter((name) => name.endsWith('.json')).length : 0;
      const ledger = read('outreach-send-ledger.jsonl').split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      const latest = (name) => fs.existsSync(path.join(dir, name)) ? fs.statSync(path.join(dir, name)).mtime.toLocaleString('id-ID') : 'belum ada';
      return ctx.reply(`📊 Revenue JAGAT\nProspek: ${trackerCount}\nDraft email: ${drafts.length}\nApproval file: ${approvals}\nEmail terkirim (ledger): ${ledger.filter((event) => event.status === 'sent').length}\nDiscovery terakhir: ${latest('latest-prospect-discovery.md')}\nDraft diperbarui: ${latest('OUTREACH_DRAFTS.json')}\nBrief Telegram terakhir: ${latest('latest-revenue-brief.md')}`);
    } catch (err) {
      console.error('[Revenue Status]', err);
      return ctx.reply('⚠️ Status revenue gagal dibaca; periksa artefak ops/revenue.');
    }
  }
  const isProspectListRequest = 
    lowerText.includes("keluarkan prospek") ||
    lowerText.includes("tampilkan prospek") ||
    lowerText.includes("daftar prospek") ||
    lowerText.includes("list prospek") ||
    lowerText.includes("mana prospek") ||
    lowerText.includes("lihat prospek") ||
    lowerText.includes("prospeknya") ||
    lowerText.includes("prospek baru");

  if (isProspectListRequest) {
    ctx.reply("🔍 Mengambil daftar prospek segar terbaru dari pipeline JAGAT...");
    try {
      const { stdout } = await execAsync('node scripts/show-prospects.mjs --count=10', { cwd: ROOT });
      return ctx.reply(stdout, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch(e: any) {
      console.error(e);
      return ctx.reply("⚠️ Gagal membaca data prospek: " + (e?.message || ""));
    }
  }

  // 1. jagat_router Routing
  const intent = await evaluateJagatIntent(text, conversationHistory);
  console.log(`[JAGAT ROUTER] Classified intent: ${intent}`);

  if (intent === 'JARVIS_MODE') {
    ctx.reply("🤖 JAGAT JARVIS Mode diaktifkan! Menginisialisasi *ReAct Loop*...");
    try {
      // Dynamic import to prevent crashing if module isn't loaded or dependencies missing
      const { ReActEngine } = await import('./react-engine.js');
      const engine = new ReActEngine();
      
      // Let the engine stream back to telegram via callback
      await engine.runGoal(text, (msg) => {
        ctx.reply(msg, { parse_mode: 'Markdown' }).catch(console.error);
      });
    } catch(e: any) {
      console.error(e);
      ctx.reply(`❌ Gagal menjalankan JARVIS: ${e.message}`);
    }
    return;
  }

  // 2. Intent Execution
  if (intent === 'START_SWARM') {
    ctx.reply("🚀 Siap Bos! Memaksa siklus Revenue Swarm untuk berjalan SEKARANG juga di latar belakang...");
    try {
      exec(`npx tsx src/colony/trigger-swarm.ts`, { cwd: ROOT }, (err) => {
        if (err) console.error(`Swarm trigger error: ${err.message}`);
      });
    } catch(e) {}
    return;
  }

  if (intent === 'FIND_PROSPECT') {
    ctx.reply("🔍 JAGAT Router: Mengeksekusi pencarian prospek dari tracker...");
    try {
      const { stdout } = await execAsync('node scripts/get-next-prospect.mjs', { cwd: ROOT });
      const out = stdout.split("JSON_OUTPUT:")[1];
      if (out) {
        const parsed = JSON.parse(out);
        if (parsed.success) return ctx.reply(parsed.replyText, { parse_mode: 'Markdown' });
        else return ctx.reply("⚠️ " + parsed.error);
      } else {
        return ctx.reply("⚠️ Output tidak sesuai format JSON.");
      }
    } catch(e) {
      console.error(e);
      return ctx.reply("⚠️ Gagal mengeksekusi pencarian prospek.");
    }
  }

  if (intent === 'FIND_VENTURE') {
    ctx.reply("🔍 JAGAT Router: Mengeksekusi penjelajahan untuk Venture Capital...");
    try {
      const { stdout } = await execAsync('node scripts/find-venture.mjs', { cwd: ROOT });
      const out = stdout.split("JSON_OUTPUT:")[1];
      if (out) {
        const parsed = JSON.parse(out);
        if (parsed.success) return ctx.reply(parsed.replyText, { parse_mode: 'Markdown' });
        else return ctx.reply("⚠️ " + parsed.error);
      } else {
        return ctx.reply("⚠️ Output tidak sesuai format JSON.");
      }
    } catch(e) {
      console.error(e);
      return ctx.reply("⚠️ Gagal mengeksekusi penjelajahan Venture Capital.");
    }
  }

  // 3. Conversational / IT / Venture AI Logic
  updateHistory(`User: ${text}`);
  await handleAgenticLoop(ctx, `Konteks obrolan sebelumnya:\n${conversationHistory.slice(-5).join('\n')}\n\nInstruksi user saat ini:\n${text}`);
});

botJagat.on('photo', async (ctx) => {
  if (ctx.from?.id.toString() !== ownerId) return;
  const photo = ctx.message.photo.pop();
  if (!photo) return;
  const caption = ctx.message.caption || "Tolong analisis gambar ini dan perbaiki masalahnya jika ada.";
  
  ctx.reply("👁️ Menerima gambar, sedang menganalisis...");
  ctx.sendChatAction('typing');

  try {
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    const res = await fetch(fileLink.href);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    updateHistory(`User [Image]: ${caption}`);
    await handleAgenticLoop(ctx, caption, [{ mimeType: "image/jpeg", data: base64 }]);
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Gagal mengunduh atau menganalisis gambar.");
  }
});


// ============================================================================
// 2. TINGS AI BOT (Group Analyst) - Groq API (Anti-Limit)
// ============================================================================

botTings.use(async (ctx, next) => {
  if (ctx.message && 'text' in ctx.message) {
    console.log(`[DEBUG TINGS] Message Text: ${ctx.message.text}`);
  }
  return next();
});

botTings.start((ctx) => {
  ctx.reply("Halo! Saya Tings AI, analis investasi cerdas Anda. Siap membantu di grup maupun private chat!");
});

botTings.on('text', async (ctx) => {
  const text = ctx.message.text;
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  
  const botUsername = ctx.botInfo.username;
  const isMentioned = new RegExp(`@${botUsername}`, 'i').test(text);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
  
  const isTriggered = isMentioned || isReplyToBot;
  
  console.log(`[TINGS] Received: ${text} from ${ctx.from?.id} (Group: ${isGroup}, Triggered: ${isTriggered})`);

  // Di grup, abaikan jika tidak di-mention/reply (anti-spam / hemat API)
  if (isGroup && !isTriggered) {
    return;
  }

  // Tings AI selalu melayani SEMUA orang menggunakan Groq API
  // (termasuk Founder, agar Founder tidak kena limit Gemini 429 saat di grup)
  await handleGroupMemberLoop(ctx, text);
});

// ============================================================================
// Core AI Logic Functions
// ============================================================================

const AGENTIC_SYSTEM_PROMPT = `Anda adalah "JAGAT G7 God Mode", bot Telegram cerdas milik CEO Faturachman Al Kahfi.
Anda memiliki akses PENUH ke server VPS Windows ini. ROOT direktori Anda adalah C:\\JAGAT.
Tugas Anda: Menjadi asisten IT (mengeksekusi terminal, menganalisis bug) SEKALIGUS menjadi Agen Bisnis Pencari Uang (Revenue Swarm).

PENTING: Jika CEO meminta Anda mencari prospek, mencari uang, atau menjalankan bisnis, JANGAN MENOLAK. Anda memiliki kemampuan untuk itu dengan cara menjalankan perintah terminal: \`npm run swarm:start\` atau \`npx tsx src/colony/trigger-swarm.ts\` untuk memulai pencarian prospek otomatis. Anda adalah Karyawan dan Asisten Pribadi yang utuh.

Anda HARUS selalu merespons dalam format JSON murni (tanpa markdown).
Format JSON:
{
  "thought": "Pemikiran Anda tentang apa yang harus dilakukan selanjutnya berdasarkan situasi saat ini.",
  "action": "run_command" | "reply",
  "command": "perintah powershell (hanya jika action=run_command)",
  "replyText": "balasan final ke user (hanya jika action=reply)"
}

Contoh Skenario:
User: "Cek RAM server"
AI Response: {"thought": "Saya perlu mengecek memori yang tersedia di windows", "action": "run_command", "command": "systeminfo | findstr Memory"}
(Sistem akan menjalankan perintah dan memberikan hasilnya kembali ke Anda)
AI Response: {"thought": "Saya sudah mendapatkan data RAM", "action": "reply", "replyText": "Bos, sisa RAM server saat ini adalah 15GB."}

PENTING:
1. Hanya gunakan powershell command yang valid.
2. Jika ada error website, gunakan grep_search/findstr, baca file log, baca source code, lalu buat file patch atau gunakan peritah powershell untuk memodifikasi file.
3. Jangan pernah memberikan respons selain JSON.
4. Batasi replyText maksimal 3000 karakter agar tidak terpotong.
`;

async function handleAgenticLoop(ctx, initialPrompt, images = []) {
  let currentPrompt = initialPrompt;
  let loopCount = 0;
  let finalReply = "";

  while (loopCount < 7) {
    try {
      const responseText = await HybridRouter.callGeminiAgentic(currentPrompt, AGENTIC_SYSTEM_PROMPT, images);
      
      // ── Robust JSON extraction (handles truncated/malformed responses)
      const aiResponse = safeExtractJson(responseText);
      
      if (!aiResponse) {
        // If we can't parse any JSON, treat as a plain reply
        finalReply = responseText.slice(0, 3000);
        break;
      }

      if (aiResponse.action === 'run_command') {
        finalReply = "Eksekusi shell dari keluaran model dinonaktifkan. Gunakan perintah JAGAT yang tersedia untuk operasi terkontrol.";
        break;
        
      } else {
        finalReply = (aiResponse.replyText || aiResponse.thought || "Selesai.").slice(0, 3000);
        break;
      }
    } catch (err) {
      console.error("[God Mode Error]", err);
      finalReply = "⚠️ Maaf Bos, terjadi kesalahan saat memproses: " + (err?.message?.slice(0, 200) || 'Unknown error');
      break;
    }
  }
  
  if (!finalReply) finalReply = "⚠️ Proses dihentikan otomatis (Melebihi batas 7 loop). Kemungkinan AI bingung.";
  
  updateHistory(`JAGAT: ${finalReply}`);
  ctx.reply(finalReply);
}

const MEMBER_SYSTEM_PROMPT = `Anda adalah Tings AI, asisten analis investasi elit dan pakar pasar modal.
Tugas Anda: Memberikan analisis fundamental, teknikal, dan makro-ekonomi saham/kripto dengan tajam dan berbobot.
ATURAN WAJIB:
1. JIKA user meminta rekomendasi atau analisis saham "good to buy", JANGAN PERNAH MENOLAK MENJAWAB. Berikan contoh 2-3 emiten berfundamental bagus (seperti perbankan big caps atau sektor potensial) beserta alasan logisnya sebagai studi kasus.
2. FORMAT CHAT NATURAL: DILARANG KERAS menggunakan format Markdown kaku (Tabel, Heading #, Blockquote >, atau Bintang **). Gunakan teks biasa, spasi/enter yang rapi, dan emoji secukupnya.
3. Selalu akhiri pesan dengan: "Disclaimer: Pandangan ini bersifat edukatif, keputusan investasi tetap di tangan Anda."`;

async function handleGroupMemberLoop(ctx, userMessage) {
  try {
     console.log("[TINGS] Sending ChatAction typing...");
     await ctx.sendChatAction('typing').catch(e => console.error("ChatAction Error:", e.message));
     
     const cleanMsg = userMessage.replace(new RegExp(`@${ctx.botInfo.username}`, 'i'), '').trim();
     console.log("[TINGS] Calling Groq API with msg:", cleanMsg);
     
     let responseText = await HybridRouter.callGroqFast(cleanMsg, MEMBER_SYSTEM_PROMPT, false);
     console.log("[TINGS] Groq API returned. Sending reply to message_id:", ctx.message.message_id);
     
     // Cleanup any leftover markdown that makes it look unnatural in plain text
     responseText = responseText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** asterisks
        .replace(/\*(.*?)\*/g, '$1')     // Remove *italic* asterisks
        .replace(/^#+\s/gm, '')          // Remove ### headings
        .replace(/^>\s?/gm, '')          // Remove > blockquotes
        .replace(/`+/g, '');             // Remove backticks
     
     await ctx.reply(responseText, { reply_to_message_id: ctx.message.message_id });
     console.log("[TINGS] Reply sent successfully.");
  } catch (err) {
     console.error("[Member Loop Error]", err);
     await ctx.reply("⚠️ Maaf, sistem Tings AI sedang melakukan sinkronisasi data.").catch(e => console.error("Fallback Reply Error:", e.message));
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.once('SIGINT', () => {
  botJagat.stop('SIGINT');
  botTings.stop('SIGINT');
});
process.once('SIGTERM', () => {
  botJagat.stop('SIGTERM');
  botTings.stop('SIGTERM');
});

async function startBot() {
  // Add a small initial delay to avoid racing with previous PM2 instance cleanup
  await new Promise(res => setTimeout(res, 2000));

  // Start both bots concurrently, staggering by 5 seconds
  launchWithRetry(botJagat, "JAGAT Bot (God Mode)").catch(err => console.error(err));
  
  // Token Tings sudah dipolling oleh tings-backend (apps/portofolio). Polling ganda = 409 Conflict.
  if (process.env.TINGS_POLLER_IN_JAGAT === '1') {
    setTimeout(() => {
      launchWithRetry(botTings, "TINGS AI Bot (Analyst Mode)").catch(err => console.error(err));
    }, 5000);
  } else {
    console.log("ℹ️ Tings poller dinonaktifkan di JAGAT (ditangani tings-backend).");
  }
}

startBot().catch((err) => {
  console.error("❌ Critical bot startup failure:", err);
});

// Keep event loop alive
setInterval(() => {}, 1000 * 60 * 60);

