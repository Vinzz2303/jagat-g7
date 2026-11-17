#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isPlausibleOutreachEmail } from "./email-quality-guard.mjs";
import {
  computeDraftHash,
  buildEventKey,
} from "./telegram-event-guard.mjs";
import { sendRevenueTelegram, runRevenueNotification } from "./revenue-notification.mjs";

const ROOT = process.cwd();
const REVENUE_DIR = path.join(ROOT, "ops", "revenue");
const DAILY_DIR = path.join(REVENUE_DIR, "daily");
const TRACKER_PATH = path.join(REVENUE_DIR, "PROSPECT_TRACKER.csv");
const SEND_LEDGER_PATH = path.join(REVENUE_DIR, "outreach-send-ledger.jsonl");
const SUPPRESSION_PATH = path.join(REVENUE_DIR, "SUPPRESSION_LIST.json");
const POLICY_PATH = path.join(REVENUE_DIR, "REVENUE_OPERATING_POLICY.md");
const OFFERS_PATH = path.join(REVENUE_DIR, "OFFER_PACKAGES.md");
const LATEST_PATH = path.join(REVENUE_DIR, "latest-revenue-brief.md");
const DISCOVERY_REPORT_PATH = path.join(REVENUE_DIR, "latest-prospect-discovery.md");
const OPENCLAW_CONFIG = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\Administrator",
  ".openclaw",
  "openclaw.json",
);

async function loadSentEmails() {
  const sent = new Set();
  try {
    const raw = (await fs.readFile(SEND_LEDGER_PATH, "utf8")).replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      try {
        const item = JSON.parse(line);
        if (item.status === "sent" && item.to) {
          sent.add(item.to.toLowerCase().trim());
        }
      } catch {}
    }
  } catch {}
  return sent;
}

async function loadSuppressedEmails() {
  const rows = JSON.parse((await fs.readFile(SUPPRESSION_PATH, "utf8")).replace(/^\uFEFF/, ""));
  if (!Array.isArray(rows)) throw new Error("Suppression list must be a JSON array.");
  return new Set(rows.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean));
}

const args = new Set(process.argv.slice(2));
const shouldSendTelegram = args.has("--send-telegram");
const dryRun = args.has("--dry-run");
const offline = args.has("--offline");

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    fileStamp: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`,
  };
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
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ""]));
  });
}

function leadScore(lead) {
  let score = 0;
  const joined = Object.values(lead).join(" ").toLowerCase();
  const today = nowStamp().date;

  if (lead.public_contact?.trim()) score += 25;
  if (lead.public_contact?.includes("@")) score += 35;
  if (lead.status === "email_found") score += 28;
  if (lead.status === "demo_ready") score += 20;
  if (lead.status === "new") score += 12;
  if (lead.date === today) score += 18;
  if (String(lead.source || "").includes("discovery")) score += 8;
  if (!lead.website || lead.website === "-") score += 16;
  if (joined.includes("no website") || joined.includes("belum punya website")) score += 10;
  if (joined.includes("whatsapp") || joined.includes("bot") || joined.includes("faq")) score += 8;
  if (lead.quoted_price?.trim()) score += 5;
  if (lead.response?.trim()) score += 10;
  if (lead.follow_up_due?.trim()) score += 4;

  return score;
}

function selectLeads(leads, limit = 18, suppressedSet = new Set()) {
  return leads
    .filter((lead) => {
      const contact = String(lead.public_contact || '').trim();
      return (!contact.includes('@') || isPlausibleOutreachEmail(contact)) && !suppressedSet.has(contact.toLowerCase());
    })
    .map((lead) => ({ ...lead, _score: leadScore(lead) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

function leadSummary(lead) {
  return [
    `- ${lead.company_or_person || "Unknown"} (${lead.niche || "unknown"})`,
    `  status: ${lead.status || "-"}`,
    `  contact: ${lead.public_contact || "-"}`,
    `  website: ${lead.website || "-"}`,
    `  offer: ${lead.offer || "-"}`,
    `  problem: ${lead.problem_hypothesis || "-"}`,
    `  next: ${lead.next_action || "-"}`,
    `  price: ${lead.quoted_price || "-"}`,
    `  notes: ${lead.notes || "-"}`,
  ].join("\n");
}

async function readText(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function buildPrompt({ policy, offers, leads, date, time }) {
  const leadBlock = leads.map(leadSummary).join("\n\n");

  return [
    "Anda adalah JAGAT Autonomous Revenue Agent v1.",
    "Tugas: membuat brief harian untuk Founder agar JAGAT bisa mencari pemasukan secara legal dan cepat.",
    "Jangan mengirim atau menyetujui pesan. Buat hanya draft untuk review founder.",
    "Pengiriman hanya boleh setelah approval exact satu penerima + hash oleh Founder; maksimum 1 pesan/siklus dan 5 percobaan/hari. Bulk dilarang.",
    "Jangan klaim omzet/profit pasti. Jangan menyarankan spam atau blast massal.",
    "Prioritaskan prospek yang punya email publik. Jika prospek belum punya email, jadikan tugasnya mencari email dulu, bukan menghubungi nomor telepon.",
    "",
    `Tanggal: ${date}`,
    `Jam server: ${time}`,
    "",
    "POLICY:",
    policy.slice(0, 4000),
    "",
    "OFFER PACKAGES:",
    offers.slice(0, 4000),
    "",
    "PROSPECT CANDIDATES:",
    leadBlock.slice(0, 9000),
    "",
    "Buat output Markdown SINGKAT dengan format persis:",
    "# JAGAT Autonomous Revenue Brief",
    "## Status Hari Ini",
    "## Top 5 Prospek Prioritas",
    "Untuk setiap prospek cukup 1 baris: nama - alasan cocok - offer - next action.",
    "## 5 Draft Pesan Siap Review",
    "Buat 5 pesan personal, masing-masing maksimal 2 kalimat.",
    "## Konten Promosi Hari Ini",
    "Buat 3 ide posting singkat, masing-masing 1 kalimat.",
    "## Founder Action",
    "Berikan 3 tindakan konkret, masing-masing 1 kalimat.",
    "## Safety",
    "Tulis bahwa tidak ada pesan terkirim tanpa approval founder per penerima dan versi draft.",
    "Total output maksimal 1200 kata.",
  ].join("\n");
}

async function readOpenClawGeminiKey() {
  const raw = await readText(OPENCLAW_CONFIG, "");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return parsed?.models?.providers?.["gemini-api"]?.apiKey ?? "";
  } catch {
    return "";
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || await readOpenClawGeminiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 5000,
    },
  };

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

function fallbackBrief(leads, date, time, reason) {
  const top = leads.slice(0, 5);
  return [
    "# JAGAT Autonomous Revenue Brief",
    "",
    "## Status Hari Ini",
    `Tanggal ${date} ${time}. Brief menggunakan fallback lokal.`,
    `Reason: ${reason}`,
    "",
    "## Top 5 Prospek Prioritas",
    ...top.map((lead, index) => `${index + 1}. ${lead.company_or_person} - ${lead.offer}. Next: review draft dan persetujuan satu pesan jika setuju.`),
    "",
    "## 5 Draft Pesan Siap Review",
    ...top.map((lead) => `- ${lead.company_or_person}: ${lead.offer.toLowerCase().includes("command center") ? "Jika pencatatan tugas perlu dirapikan, demo task board/status/laporan mungkin relevan" : "Jika pertanyaan layanan sering berulang, demo AI Admin untuk FAQ/intake mungkin relevan"}; review body/hash persis di OUTREACH_APPROVAL_INBOX.md.`),
    "",
    "## Konten Promosi Hari Ini",
    "- AI bukan hanya chatbot; AI bisa membantu bisnis menjawab pertanyaan pelanggan dan merapikan pekerjaan admin.",
    "- Mulai AI tidak harus mahal: mulai dari website rapi, FAQ bisnis, dan laporan sederhana.",
    "- Bisnis yang lebih awal menata data dan workflow akan lebih siap masuk era AI.",
    "",
    "## Founder Action",
    "- Review To, sumber, offer, dan hash di OUTREACH_APPROVAL_INBOX.md.",
    "- Setujui hanya pesan yang persis cocok; jadwal memproses max 1/siklus dan max 5 percobaan/hari.",
    "- Catat respon/opt-out di tracker dan suppression list.",
    "- Minta JAGAT buat demo spesifik jika ada yang membalas.",
    "",
    "## Safety",
    "Tidak ada pesan terkirim tanpa approval Founder yang mengikat penerima dan hash draft; bulk send dilarang.",
  ].join("\n");
}

function missingSection(markdown, title) {
  return !markdown.includes(title);
}

function ensureBriefComplete(markdown, leads, date, time) {
  const top = leads.slice(0, 5);
  const chunks = [markdown.trim()];

  if (missingSection(markdown, "## Status Hari Ini")) {
    chunks.push([
      "## Status Hari Ini",
      `Tanggal ${date} ${time}. Ada ${leads.length} prospek di tracker; prioritas hari ini adalah founder-reviewed manual outreach.`,
    ].join("\n"));
  }

  if (missingSection(markdown, "## Top 5 Prospek Prioritas")) {
    chunks.push([
      "## Top 5 Prospek Prioritas",
      ...top.map((lead, index) => `${index + 1}. ${lead.company_or_person} - ${lead.problem_hypothesis || "butuh digitalisasi ringan"} - ${lead.offer} - ${lead.next_action || "kirim pesan manual."}`),
    ].join("\n"));
  }

  if (missingSection(markdown, "## 5 Draft Pesan Siap Review")) {
    chunks.push([
      "## 5 Draft Pesan Siap Review",
      ...top.map((lead) => `- Halo Kak, saya Faturachman dari JAGAT AI. Saya lihat ${lead.company_or_person} cocok untuk ${lead.offer}; saya bisa kirim demo ringan dulu, boleh saya kirim contoh?`),
    ].join("\n"));
  }

  if (missingSection(markdown, "## Konten Promosi Hari Ini")) {
    chunks.push([
      "## Konten Promosi Hari Ini",
      "- AI bisa membantu bisnis menjawab pertanyaan pelanggan, merapikan data, dan mengurangi pekerjaan admin berulang.",
      "- Mulai AI tidak harus mahal: website rapi, FAQ bisnis, dan laporan sederhana sudah cukup untuk langkah pertama.",
      "- Bisnis yang menata sistem lebih awal akan lebih siap menangkap peluang di era AI.",
    ].join("\n"));
  }

  if (missingSection(markdown, "## Founder Action")) {
    chunks.push([
      "## Founder Action",
      "- Review penerima, sumber, draft, dan hash di OUTREACH_APPROVAL_INBOX.md.",
      "- Jika setuju dengan pesan persis, buat approval satu penerima; sender akan memproses maksimal 1/siklus dan 5/hari.",
      "- Catat respons dan opt-out pada tracker/suppression list.",
      "- Jika ada yang membalas, minta JAGAT buat demo spesifik untuk bisnis tersebut.",
    ].join("\n"));
  }

  if (missingSection(markdown, "## Safety")) {
    chunks.push([
      "## Safety",
      "Tidak ada pesan terkirim tanpa approval Founder yang mengikat penerima dan hash draft; bulk send dilarang.",
    ].join("\n"));
  }

  return chunks.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

function shortProblem(text) {
  return String(text || "butuh digitalisasi ringan")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .slice(0, 110);
}

function shortOffer(text) {
  return String(text || "AI Admin Bot")
    .replace(/\s+/g, " ")
    .slice(0, 55);
}

function parseLatestDiscovered(report) {
  return report
    .split(/\r?\n/)
    .filter((line) => /^\d+\.\s+/.test(line) && isPlausibleOutreachEmail(line.split('|')[2]?.trim()))
    .slice(0, 5)
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());
}

function compactForTelegram(leads, date, time, discoveryReport = "", sentSet = new Set(), suppressedSet = new Set()) {
  const uncontactedEmailLeads = leads.filter((lead) => {
    const contact = String(lead.public_contact || "").trim().toLowerCase();
    if (!isPlausibleOutreachEmail(contact)) return false;
    if (suppressedSet.has(contact)) return false;
    const status = String(lead.status || "").trim().toLowerCase();
    if (status === "emailed" || status === "sent" || status === "suppressed" || status === "unsubscribed") return false;
    if (sentSet && sentSet.has(contact)) return false;
    return true;
  });

  const top = uncontactedEmailLeads.slice(0, 3);
  const draftLeads = uncontactedEmailLeads.slice(0, 3);
  const emailedCount = leads.filter((l) => l.status === "emailed" || sentSet.has(String(l.public_contact || "").trim().toLowerCase())).length;
  const discovered = parseLatestDiscovered(discoveryReport);

  const lines = [
    `JAGAT Revenue Brief - ${date} ${time}`,
    "",
    `Status: ${leads.length} prospek eligible, ${emailedCount} sudah dihubungi, ${uncontactedEmailLeads.length} draft antre review. Approval exact wajib; maks 1/siklus, 5 percobaan/hari; bulk dilarang.`,
    "",
    "Baru ditemukan:",
    ...(discovered.length ? discovered.slice(0, 3).map((lead, index) => `${index + 1}. ${lead}`) : ["- Belum ada prospek email baru di siklus ini. Phone-only dilewati."]),
    "",
    "Prioritas hari ini:",
    ...(top.length
      ? top.map((lead, index) => `${index + 1}. ${lead.company_or_person} - ${shortOffer(lead.offer)}. ${shortProblem(lead.problem_hypothesis)}.`)
      : ["- Seluruh 57 prospek email lama sudah dihubungi. Menunggu Discovery Agent menemukan email baru."]),
    "",
    "Draft untuk review founder:",
    ...(draftLeads.length
      ? draftLeads.map((lead, index) => `${index + 1}. Halo Kak, saya Faturachman dari JAGAT AI. Saya lihat ${lead.company_or_person} cocok untuk ${shortOffer(lead.offer)}; boleh saya kirim demo ringan via email ini?`)
      : ["- Belum ada draft baru karena semua email yang ada sudah pernah dihubungi."]),
    "",
    "Aksi approval founder (Telegram hanya laporan):",
    ...(top.length ? [
      "1. Review draft dan hash di OUTREACH_APPROVAL_INBOX.md.",
      "2. Buat approval per penerima/hash hanya jika setuju dengan isi persis.",
      "3. Siklus terjadwal memproses maks 1 pesan; hasilnya dikirim ke Telegram.",
      "4. Catat balasan/opt-out pada tracker dan suppression list."
    ] : [
      "1. Cek balasan di Gmail dan catat opt-out bila ada.",
      "2. Discovery Agent otomatis mencari direktori bisnis baru di background.",
      "3. Bot akan memberi notifikasi saat ada email baru yang valid."
    ]),
    "",
    "Discovery report: ops/revenue/latest-prospect-discovery.md",
    "Report lengkap: ops/revenue/latest-revenue-brief.md",
  ];

  return lines.join("\n");
}

async function readOpenClawTelegramConfig() {
  const raw = await readText(OPENCLAW_CONFIG, "");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return {
      botToken: parsed?.channels?.telegram?.botToken,
      chatId: parsed?.channels?.telegram?.allowFrom?.[0],
    };
  } catch {
    return {};
  }
}

async function sendTelegram(markdown) {
  const fallback = await readOpenClawTelegramConfig();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || fallback.botToken;
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID || fallback.chatId;

  if (!botToken || !chatId) {
    throw new Error("Telegram token/chat id not available.");
  }

  const tracker = await readText(TRACKER_PATH);
  const sentSet = await loadSentEmails();
  const suppressedSet = await loadSuppressedEmails();
  const discoveryReport = await readText(DISCOVERY_REPORT_PATH, "");
  const allLeads = parseCsv(tracker);
  const { date, time } = nowStamp();
  const message = compactForTelegram(allLeads, date, time, discoveryReport, sentSet, suppressedSet);

  // === TELEGRAM EVENT DEDUPLICATION (WP-A) ===
  // Key incorporates: lead_id, campaign_id, draft_version (content hash), event_type
  const draftVersion = computeDraftHash(message.split("\n").slice(1).join("\n"));
  const topLeadIds = allLeads.slice(0, 3).map((l) => l.company_or_person).join('_');
  const eventKey = buildEventKey({
    lead_id: topLeadIds,
    campaign_id: 'camp-id-b2b-q4',
    draft_version: draftVersion,
    event_type: 'REVENUE_BRIEF',
  });

  return sendRevenueTelegram({
    botToken, chatId, text: message,
    event: {
      event_key: eventKey,
      lead_id: topLeadIds,
      campaign_id: 'camp-id-b2b-q4',
      draft_version: draftVersion,
      event_type: 'REVENUE_BRIEF',
      summary: `Daily Revenue Brief for ${allLeads.length} leads`,
    },
  });
}

async function main() {
  const { date, time, fileStamp } = nowStamp();
  const [policy, offers, tracker, suppressedSet] = await Promise.all([
    readText(POLICY_PATH),
    readText(OFFERS_PATH),
    readText(TRACKER_PATH),
    loadSuppressedEmails(),
  ]);

  const leads = selectLeads(parseCsv(tracker), 18, suppressedSet);
  if (!leads.length) throw new Error("No prospects found in PROSPECT_TRACKER.csv.");

  const prompt = buildPrompt({ policy, offers, leads, date, time });
  let brief;

  if (offline) {
    brief = fallbackBrief(leads, date, time, "Mode offline: panggilan provider dilewati.");
  } else {
    try {
      brief = await callGemini(prompt);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      brief = fallbackBrief(leads, date, time, reason);
    }
  }

  const completeBrief = ensureBriefComplete(brief, leads, date, time);
  const finalBrief = [
    completeBrief.trim(),
    "",
    "---",
    `Generated by: JAGAT Autonomous Revenue Agent v1`,
    `Generated at: ${date} ${time}`,
    `Source tracker: ops/revenue/PROSPECT_TRACKER.csv`,
    `Outbound status: founder approval per exact recipient/hash; max 1/cycle, 5 attempts/day; bulk disabled`,
  ].join("\n");

  if (!dryRun) {
    await fs.mkdir(DAILY_DIR, { recursive: true });
    const outputPath = path.join(DAILY_DIR, `REVENUE_BRIEF_${fileStamp}.md`);
    await fs.writeFile(outputPath, finalBrief, "utf8");
    await fs.writeFile(LATEST_PATH, finalBrief, "utf8");

    await runRevenueNotification({
      enabled: shouldSendTelegram, eventType: 'REVENUE_BRIEF',
      send: () => sendTelegram(finalBrief),
    });

    console.log(`REVENUE_AGENT=PASS`);
    console.log(`REPORT=${outputPath}`);
    console.log(`LATEST=${LATEST_PATH}`);
    return;
  }

  console.log(finalBrief);
}

main().catch((err) => {
  console.error(`REVENUE_AGENT=FAIL`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
