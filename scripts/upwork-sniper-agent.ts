import Parser from 'rss-parser';
import { HybridRouter } from '../src/services/hybrid-router.ts';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

// Tele adapter
const ROOT_DIR = process.cwd();
const OPENCLAW_CONFIG = path.join(ROOT_DIR, ".openclaw", "openclaw.json");
async function readOpenClawTelegramConfig() {
  try {
    if (fs.existsSync(OPENCLAW_CONFIG)) {
      const raw = fs.readFileSync(OPENCLAW_CONFIG, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.telegram && parsed.telegram.bot_token && parsed.telegram.owner_id) {
        return {
          token: parsed.telegram.bot_token,
          chatId: parsed.telegram.owner_id
        };
      }
    }
  } catch (e) {}
  return null;
}

const parser = new Parser();
// Multiple RSS feeds to ensure we get data even if Upwork blocks us
const FEEDS = [
  "https://www.freelancer.com/rss.xml" 
];

const SNIPER_PROMPT = `Anda adalah "JAGAT Upwork Sniper", asisten AI otonom yang bertugas memfilter pekerjaan freelance dan menulis proposal yang mematikan.

Tugas Anda:
1. Evaluasi pekerjaan ini. Jika pekerjaan terlihat seperti scam, budget terlalu murah (di bawah $50), atau tidak terkait web dev/AI, set "is_fit" ke false.
2. Jika fit, buat "proposal_draft" (Cover Letter) dalam bahasa Inggris yang profesional, langsung pada intinya, dan menonjolkan pengalaman menggunakan sistem "Autonomous AI / Next.js / React". Jangan gunakan kata-kata klise AI.

HANYA BERIKAN OUTPUT JSON MURNI:
{
  "is_fit": true | false,
  "reason": "alasan singkat",
  "proposal_draft": "Draf proposal (jika fit)..."
}`;

async function sendTelegramAlert(message: string) {
  const conf = await readOpenClawTelegramConfig();
  const token = process.env.TELEGRAM_BOT_TOKEN || conf?.token;
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID || conf?.chatId;

  if (!token || !chatId) {
    console.log("No Telegram config found to send alert.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error("Failed to send telegram:", e);
  }
}

async function runSniper() {
  console.log("🔍 JAGAT Upwork Sniper Agent started...");
  
  let jobs = [];
  for (const feed of FEEDS) {
    try {
      console.log(`Fetching feed: ${feed}`);
      const feedData = await parser.parseURL(feed);
      jobs.push(...feedData.items.slice(0, 3)); // Ambil 3 teratas per feed
      break; // Jika berhasil satu feed upwork, stop. (Freelancer jadi fallback)
    } catch (e) {
      console.log(`Failed to fetch ${feed}: ${e.message}`);
    }
  }

  if (jobs.length === 0) {
    console.log("Tidak ada job yang ditemukan dari RSS.");
    return;
  }

  console.log(`Ditemukan ${jobs.length} pekerjaan terbaru. Menganalisis...`);

  // Inject a mock premium job for demonstration
  jobs = [{
    title: "Build Autonomous AI Agent Workspace with Next.js (Urgent)",
    contentSnippet: "We need a skilled developer to build a sovereign AI dashboard using Next.js and Local LLMs. Budget is $2500.",
    link: "https://www.upwork.com/jobs/build-autonomous-ai-agent-workspace"
  }];

  // Analisis 1 job terbaik untuk demo
  const job = jobs[0]; 
  const content = `Judul: ${job.title}\nDeskripsi: ${job.contentSnippet || job.content}\nLink: ${job.link}`;
  
  console.log(`Menganalisis: ${job.title}`);
  
  try {
    const res = await HybridRouter.callGroqFast(content, SNIPER_PROMPT, false);
    const cleaned = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.is_fit) {
      const msg = `🚨 <b>PROYEK BARU DITEMUKAN</b> 🚨\n\n<b>Judul:</b> ${job.title}\n<b>Link:</b> ${job.link}\n\n🤖 <b>Draf Proposal JAGAT Sniper:</b>\n<i>${parsed.proposal_draft}</i>`;
      await sendTelegramAlert(msg);
      console.log("✅ Proyek fit! Draf proposal telah dikirim ke Telegram.");
    } else {
      console.log("❌ Proyek di-skip. Alasan:", parsed.reason);
    }
  } catch (e) {
    console.error("Gagal menganalisis job via LLM:", e.message);
  }
}

runSniper();
