#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isPlausibleOutreachEmail } from "./email-quality-guard.mjs";
import { readRevenueStatusSnapshot } from "./revenue-status-snapshot.mjs";
import {
  computeDraftHash,
  buildEventKey,
  isEventAlreadySent,
  recordTelegramEvent,
} from "./telegram-event-guard.mjs";

const ROOT = process.cwd();
const REVENUE_DIR = path.join(ROOT, "ops", "revenue");
const TRACKER_PATH = path.join(REVENUE_DIR, "PROSPECT_TRACKER.csv");
const SEND_LEDGER_PATH = path.join(REVENUE_DIR, "outreach-send-ledger.jsonl");
const OUTPUT_PATH = path.join(REVENUE_DIR, "EMAIL_DRAFTS_TODAY.md");
const MACHINE_DRAFTS_PATH = path.join(REVENUE_DIR, "OUTREACH_DRAFTS.json");
const SUPPRESSION_PATH = path.join(REVENUE_DIR, "SUPPRESSION_LIST.json");
const APPROVAL_PATH = path.join(REVENUE_DIR, "OUTREACH_APPROVAL_INBOX.md");
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

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function readText(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
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
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ""]));
  });
}

function scoreLead(lead) {
  let score = 0;
  const text = Object.values(lead).join(" ").toLowerCase();
  if (lead.status === "demo_ready") score += 30;
  if (lead.public_contact?.includes("@")) score += 30;
  if (lead.website && lead.website !== "-") score += 12;
  if (lead.public_contact?.trim()) score += 10;
  if (text.includes("no website") || text.includes("belum punya website")) score += 10;
  if (lead.quoted_price?.trim()) score += 6;
  return score;
}

function isEligibleForNewDraft(lead, sentSet, suppressedSet = new Set()) {
  const contact = String(lead.public_contact || "").trim().toLowerCase();
  if (suppressedSet.has(contact)) return false;
  if (!isPlausibleOutreachEmail(contact)) return false;
  const status = String(lead.status || "").trim().toLowerCase();
  if (["emailed", "sent", "suppressed", "unsubscribed", "rejected", "declined", "do_not_contact", "opted_out", "closed_lost", "not_interested"].includes(status)) return false;
  const response = String(lead.response || "");
  if (/\b(?:not interested|do not contact|unsubscribe|remove me|stop emailing|tidak tertarik|jangan hubungi|berhenti berlangganan|hapus alamat email)\b/i.test(response)) return false;
  if (sentSet && sentSet.has(contact)) {
    return false;
  }
  return true;
}

function topLeads(leads, sentSet = new Set(), limit = 5, suppressedSet = new Set()) {
  const seenRecipients = new Set();
  return leads
    .filter((lead) => isEligibleForNewDraft(lead, sentSet, suppressedSet))
    .map((lead) => ({ ...lead, _score: scoreLead(lead) }))
    .sort((a, b) => b._score - a._score)
    .filter((lead) => {
      const recipient = String(lead.public_contact || "").trim().toLowerCase();
      if (seenRecipients.has(recipient)) return false;
      seenRecipients.add(recipient);
      return true;
    })
    .slice(0, limit);
}

function emailTarget(lead) {
  if (lead.public_contact?.includes("@")) return lead.public_contact;
  if (lead.website && lead.website !== "-") return `[cari email/contact form di ${lead.website}]`;
  return "[email belum ada - cari dari Google/website/listing]";
}

function subjectFor(lead) {
  const name = lead.company_or_person || "Bisnis Anda";
  if ((lead.offer || "").toLowerCase().includes("command center")) return `Ide task board dan laporan kerja untuk ${name}`;
  if ((lead.offer || "").toLowerCase().includes("website")) {
    return `Ide website + AI admin ringan untuk ${name}`;
  }
  return `Ide AI admin ringan untuk ${name}`;
}

function bodyFor(lead) {
  const name = lead.company_or_person || "bisnis Bapak/Ibu";
  const problem = String(lead.problem_hypothesis || "").replace(/\.+$/g, "").replace(/;?\s*kebutuhan perlu dikonfirmasi$/i, "");
  const offer = lead.offer || "AI Admin Bot";
  const hasSpecificProblem = Boolean(problem) && !/kontak email publik|cocok untuk outreach/i.test(problem);
  const demo = offer.toLowerCase().includes("command center")
    ? "Jika tim Anda membutuhkan pencatatan tugas dan tindak lanjut lebih rapi, kami bisa menunjukkan demo task board sederhana dengan status dan laporan ringkas."
    : "Jika tim Anda sering menerima pertanyaan berulang, kami bisa menunjukkan demo AI admin untuk FAQ dan intake inquiry.";

  return [
    "Halo Kak,",
    "",
    `Saya Faturachman dari JAGAT AI. Saya melihat ${name} punya peluang untuk dibantu dengan ${offer}.`,
    "",
    hasSpecificProblem ? `Jika kebutuhan ini relevan: ${problem}.` : "Saya belum mengetahui alur internal tim Anda, jadi saya tidak ingin mengasumsikan kebutuhannya.",
    "",
    demo,
    "",
    ...(lead.quoted_price ? ["", `Untuk tahap awal, kisaran harga ${lead.quoted_price}; scope final disepakati bersama.`] : []),
    "",
    "Boleh saya kirim contoh demo singkat agar Kakak bisa lihat gambaran manfaatnya?",
    "",
    "Jika tidak ingin menerima pesan lagi, balas STOP. Kami tidak akan mengirim follow-up.",
    "",
    "Salam,",
    "Faturachman Al Kahfi",
    "JAGAT AI",
  ].join("\n");
}

function buildEmailPayload(lead) {
  const to = String(lead.public_contact || "").trim();
  const subject = subjectFor(lead);
  const text = bodyFor(lead);
  const html = text.split("\n").map((line) => line.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch])).join("<br/>");
  const draftHash = createHash("sha256").update(JSON.stringify({ to: to.toLowerCase(), subject, text, html })).digest("hex");
  return { to, subject, text, html, draftHash, company: lead.company_or_person, source: lead.source, approvalStatus: "pending" };
}

function buildDrafts(leads) {
  const now = stamp();
  return [
    "# Email Outreach Drafts Today",
    "",
    `Generated: ${now}`,
    "Mode: kampanye otomatis terbatas untuk kontak role mailbox domain resmi; draft lain tetap memerlukan review founder",
    "Safety: maksimal 1 percobaan per 24 jam; tanpa follow-up; kontak STOP masuk suppression sebelum siklus selanjutnya",
    "",
    "## Cara Pakai",
    "1. Review penerima, sumber, subject, dan body draft ini.",
    "2. Untuk menyetujui satu pesan, jalankan `node scripts/approve-outreach-draft.mjs --to=<email> --hash=<draft-hash> --approved-by=\"Faturachman Al Kahfi\" --expires-hours=24`.",
    "3. Siklus terjadwal mengirim maksimal satu approval per siklus; jalankan `node scripts/process-approved-outreach.mjs` untuk memproses sekarang.",
    "4. Laporan sent/failed/unknown dikirim ke Telegram founder.",
    "5. Catat balasan dan opt-out di tracker/suppression list.",
    "",
    ...leads.map((lead, index) => [
      `## Email ${index + 1} - ${lead.company_or_person}`,
      "",
      `To: ${emailTarget(lead)}`,
      `Subject: ${subjectFor(lead)}`,
      `Draft hash: ${buildEmailPayload(lead).draftHash}`,
      "",
      "Body:",
      "```text",
      bodyFor(lead),
      "```",
      "",
      `Offer: ${lead.offer || "-"}`,
      `Next action: ${lead.next_action || "kirim manual jika kontak email sudah ada"}`,
      `Source: ${lead.source || "-"}`,
      "",
    ].join("\n")),
    "## Batas Kirim Hari Ini",
    "- Maksimal 1 email otomatis per 24 jam; tidak ada follow-up otomatis.",
    "- Hanya alamat role mailbox dari domain situs resmi; alamat pribadi dan direktori dikecualikan.",
    "- Kalau calon klien menolak, jangan hubungi lagi.",
  ].join("\n");
}

function buildApprovalInbox(leads) {
  return [
    "# JAGAT Outreach Approval Inbox",
    "",
    `Generated: ${stamp()}`,
    "Mode: review founder; satu approval exact per pesan; sender memproses maksimal satu pesan per siklus",
    "",
    "## Prinsip",
    "- JAGAT boleh mencari prospek, menilai prioritas, dan membuat draft.",
    "- JAGAT tidak mengirim email tanpa approval founder yang mengikat alamat dan hash isi pesan.",
    "- Tanpa approval, jadwal hanya mencari prospek, membuat draft, dan mengirim laporan Telegram.",
    "- Maksimal 5 percobaan per hari; bulk outreach tetap dilarang.",
    "",
    "## Siap Review Hari Ini",
    ...(leads.length
      ? leads.map((lead, index) => [
        `### ${index + 1}. ${lead.company_or_person}`,
        `- Email: ${lead.public_contact}`,
        `- Niche: ${lead.niche || "-"}`,
        `- Offer: ${lead.offer || "-"}`,
        `- Problem hypothesis: ${lead.problem_hypothesis || "-"}`,
        `- Source: ${lead.source || "-"}`,
        `- Draft hash: ${buildEmailPayload(lead).draftHash}`,
        `- Approval action: APPROVE_ONE_SEND / SKIP / NEEDS_RESEARCH`,
      ].join("\n"))
      : ["Belum ada prospek email-ready untuk direview."]),
    "",
    "## Setelah Approval / Balasan",
    "- Update `response` jika ada balasan.",
    "- Update `follow_up_due` untuk follow-up 24/48 jam.",
    "- Jangan follow-up jika prospek menolak.",
  ].join("\n");
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

async function sendTelegram(leads) {
  const fallback = await readOpenClawTelegramConfig();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || fallback.botToken;
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID || fallback.chatId;
  if (!botToken || !chatId) throw new Error("Telegram token/chat id not available.");

  const status = await readRevenueStatusSnapshot();
  const runtimeStatus = await readLocalRuntimeStatus();
  // === TELEGRAM EVENT DEDUPLICATION (WP-A) ===
  // Runtime health changes must create a fresh event even when draft content is unchanged.
  const draftContent = `${leads.map((lead) => `${lead.company_or_person}:${buildEmailPayload(lead).draftHash}`).join('|')}|runtime:${status.overall}:${status.scheduledCycle.state}:${status.scheduledCycle.lastTaskResult}:${runtimeStatus}`;
  const draftVersion = computeDraftHash(draftContent);
  const leadIds = leads.map((l) => l.company_or_person).join('_');
  const eventKey = buildEventKey({
    lead_id: leadIds,
    campaign_id: 'camp-id-b2b-q4',
    draft_version: draftVersion,
    event_type: 'EMAIL_DRAFT_BATCH',
  });

  const alreadySent = await isEventAlreadySent(eventKey);
  if (alreadySent) {
    console.log(`[TelegramGuard] EMAIL_DRAFT_BATCH already delivered for key "${eventKey}". Skipping redundant broadcast.`);
    return { skipped: true, eventKey };
  }

  const lines = [
    `Email Draft Agent v1 - ${stamp()}`,
    "",
    `Draft dibuat: ${leads.length}`,
    "Mode: founder review + approval exact penerima/hash; maksimal 1 pesan per siklus dan 5 percobaan/hari.",
    "",
    "Prioritas:",
    ...leads.map((lead, index) => `${index + 1}. ${lead.company_or_person} - ${subjectFor(lead)}`),
    "",
    "File: ops/revenue/EMAIL_DRAFTS_TODAY.md",
  ];
  const counts = status.outreach.counts;
  lines.push("", "Workflow monitoring (read-only):", `Pipeline: ${status.overall}; scheduler: ${status.scheduledCycle.status}/${status.scheduledCycle.state}; last result: ${status.scheduledCycle.lastTaskResult ?? "unknown"}; next: ${status.scheduledCycle.nextRunTime ?? "unavailable"}.`, `Runtime: ${runtimeStatus}.`, `Artifacts: discovery ${status.artifacts["latest-prospect-discovery.md"].status}, drafts ${status.artifacts["OUTREACH_DRAFTS.json"].status}. Telegram brief/drafts: ${status.notifications.brief.status}/${status.notifications.draftBatch.status}.`, `Email ledger: sent ${counts?.sent ?? "unknown"}, failed ${counts?.failed ?? "unknown"}, blocked ${status.outreach.otherStatuses?.blocked ?? "unknown"}; latest event: ${status.outreach.newestEventAt ?? "unavailable"}.`);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Telegram send failed (${response.status}): ${text}`);
  }

  await recordTelegramEvent({
    event_key: eventKey,
    lead_id: leadIds,
    campaign_id: 'camp-id-b2b-q4',
    draft_version: draftVersion,
    event_type: 'EMAIL_DRAFT_BATCH',
    summary: `Draft batch for ${leads.length} leads; pipeline ${status.overall}; scheduler ${status.scheduledCycle.state}/${status.scheduledCycle.lastTaskResult ?? "unknown"}; ${runtimeStatus}`,
  });

  console.log(`[TelegramGuard] EMAIL_DRAFT_BATCH delivered and recorded in ledger (event_key: "${eventKey}").`);
  return { skipped: false, eventKey };
}

async function readLocalRuntimeStatus() {
  const probe = (url) => fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
  const [bff, ui, qdrant] = await Promise.all([probe("http://127.0.0.1:5000/health"), probe("http://127.0.0.1:50012/"), probe("http://127.0.0.1:6333/collections")]);
  let services = {};
  try { services = (await bff.clone().json()).services || {}; } catch {}
  const dependencies = ["ollama", "redis", "qdrant"].map((name) => `${name} ${services[name] || "unknown"}`).join(", ");
  return `BFF ${bff ? `HTTP ${bff.status}` : "offline"} (${dependencies}); UI ${ui ? `HTTP ${ui.status}` : "offline"}; Qdrant ${qdrant?.ok ? "connected" : "unreachable"}`;
}

async function main() {
  const tracker = await readText(TRACKER_PATH);
  const sentSet = await loadSentEmails();
  const suppressedSet = await loadSuppressedEmails();
  const leads = topLeads(parseCsv(tracker), sentSet, 5, suppressedSet);
  if (!leads.length) {
    const empty = buildApprovalInbox([]);
    await fs.writeFile(OUTPUT_PATH, [
      "# Email Outreach Drafts Today",
      "",
      `Generated: ${stamp()}`,
      "Mode: founder review + approval satu pesan; sender otomatis berjalan setelah approval valid",
      "Safety: tanpa approval persis tidak ada email terkirim; maksimal 5 percobaan/hari",
      "",
      "Belum ada prospek ber-email yang lolos status, suppression, dan pemeriksaan placeholder untuk draft saat ini.",
      "Discovery agent akan terus mencari prospek baru; approval lama tidak cocok dengan draft yang berubah.",
    ].join("\n"), "utf8");
    await fs.writeFile(APPROVAL_PATH, empty, "utf8");
    await fs.writeFile(MACHINE_DRAFTS_PATH, "[]\n", "utf8");
    console.log("EMAIL_DRAFT_AGENT=PASS");
    console.log("DRAFTS=0 (Semua email lama sudah dikirimi)");
    console.log(`APPROVAL_INBOX=${APPROVAL_PATH}`);
    console.log("TELEGRAM_SENT=false");
    return;
  }

  const output = buildDrafts(leads);
  const machineDrafts = leads.map(buildEmailPayload);
  await fs.writeFile(MACHINE_DRAFTS_PATH, `${JSON.stringify(machineDrafts, null, 2)}\n`, "utf8");
  await fs.writeFile(OUTPUT_PATH, output, "utf8");
  await fs.writeFile(APPROVAL_PATH, buildApprovalInbox(leads), "utf8");

  if (shouldSendTelegram) {
    await sendTelegram(leads);
  }

  console.log("EMAIL_DRAFT_AGENT=PASS");
  console.log(`DRAFTS=${OUTPUT_PATH}`);
  console.log(`APPROVAL_INBOX=${APPROVAL_PATH}`);
  console.log(`TELEGRAM_SENT=${shouldSendTelegram ? "true" : "false"}`);
}

main().catch((err) => {
  console.error("EMAIL_DRAFT_AGENT=FAIL");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
