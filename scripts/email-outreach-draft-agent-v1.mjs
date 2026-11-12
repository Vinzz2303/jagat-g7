#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { campaignLeadEligibility, hasOutreachRefusal, isValidCampaignPolicy, normalizedCompany } from "./outreach-campaign-guard.mjs";
import { runRevenueNotification, sendRevenueTelegram } from "./revenue-notification.mjs";
import { isPlausibleOutreachEmail } from "./email-quality-guard.mjs";
import { readRevenueStatusSnapshot } from "./revenue-status-snapshot.mjs";
import {
  computeDraftHash,
  buildEventKey,
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

async function loadOutreachHistory() {
  let raw;
  try { raw = (await fs.readFile(SEND_LEDGER_PATH, "utf8")).replace(/^\uFEFF/, ""); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  // Unknown/corrupt history must not silently resurrect a previously attempted lead.
  return raw.split(/\r?\n/).filter(Boolean).map(line => {
    const event = JSON.parse(line);
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid outreach ledger record.');
    return event;
  });
}

async function loadCampaignPolicy() {
  let raw;
  try { raw = await fs.readFile(path.join(REVENUE_DIR, "AUTO_SEND_POLICY.json"), "utf8"); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const policy = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (policy?.enabled === false) return null;
  if (!isValidCampaignPolicy(policy)) throw new Error('Campaign policy is invalid; refusing to generate campaign drafts.');
  return policy;
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

export function isEligibleForNewDraft(lead, sentSet, suppressedSet = new Set(), campaignPolicy = null) {
  const contact = String(lead.public_contact || "").trim().toLowerCase();
  if (suppressedSet.has(contact)) return false;
  if (!isPlausibleOutreachEmail(contact)) return false;
  if (hasOutreachRefusal(lead)) return false;
  if (campaignPolicy && !campaignLeadEligibility(lead, campaignPolicy).ok) return false;
  if (sentSet && sentSet.has(contact)) {
    return false;
  }
  return true;
}

export function topLeads(leads, sentSet = new Set(), limit = 5, suppressedSet = new Set(), campaignPolicy = null, history = []) {
  const seenRecipients = new Set();
  const seenCompanies = new Set(campaignPolicy ? history.filter(event => ['attempted', 'sent', 'unknown'].includes(event.status)).map(event => normalizedCompany(event.company)).filter(Boolean) : []);
  return leads
    .filter((lead) => isEligibleForNewDraft(lead, sentSet, suppressedSet, campaignPolicy))
    .map((lead) => ({ ...lead, _score: scoreLead(lead) }))
    .sort((a, b) => b._score - a._score)
    .filter((lead) => {
      const recipient = String(lead.public_contact || "").trim().toLowerCase();
      const company = campaignPolicy ? normalizedCompany(lead.company_or_person) : '';
      if (seenRecipients.has(recipient) || (company && seenCompanies.has(company))) return false;
      seenRecipients.add(recipient);
      if (company) seenCompanies.add(company);
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

function buildDrafts(leads, campaignPolicy = null) {
  const now = stamp();
  return [
    "# Email Outreach Drafts Today",
    "",
    `Generated: ${now}`,
    campaignPolicy ? "Mode: kampanye D-052; hanya role mailbox domain resmi dengan bukti official_site" : "Mode: review founder; approval exact penerima/hash diperlukan sebelum kirim",
    campaignPolicy ? "Safety: maksimal 1 percobaan per 24 jam; tanpa follow-up; kontak STOP masuk suppression sebelum siklus selanjutnya" : "Safety: maksimal 1 per siklus, 5 percobaan/hari; tidak ada pengiriman tanpa approval exact",
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
    campaignPolicy ? "- Maksimal 1 email otomatis per 24 jam; tidak ada follow-up otomatis." : "- Maksimal 1 email per siklus dan 5 percobaan/hari setelah approval exact.",
    campaignPolicy ? "- Hanya alamat role mailbox dari domain situs resmi; alamat pribadi dan direktori dikecualikan." : "- Review sumber dan penerima sebelum memberikan approval exact.",
    "- Kalau calon klien menolak, jangan hubungi lagi.",
  ].join("\n");
}

function buildApprovalInbox(leads, campaignPolicy = null) {
  return [
    "# JAGAT Outreach Approval Inbox",
    "",
    `Generated: ${stamp()}`,
    campaignPolicy ? "Mode: kampanye D-052 aktif; hanya kandidat terverifikasi, maksimum satu email per 24 jam dan per siklus" : "Mode: review founder; satu approval exact per pesan; sender memproses maksimal satu pesan per siklus",
    "",
    "## Prinsip",
    "- JAGAT boleh mencari prospek, menilai prioritas, dan membuat draft.",
    "- Di luar kampanye D-052, pengiriman memerlukan approval founder yang mengikat alamat dan hash isi pesan.",
    "- D-052 tetap memerlukan kebijakan aktif, bukti situs resmi, role mailbox, status aman, suppression dan pemeriksaan riwayat saat kirim.",
    "- D-052: maksimum 1 per 24 jam, tanpa follow-up. Mode approval exact: maksimum 5 percobaan/hari. Bulk dilarang.",
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
    "- Jangan jadwalkan follow-up otomatis; kampanye D-052 hanya pesan awal.",
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

async function sendTelegram(leads, campaignPolicy = null) {
  const fallback = await readOpenClawTelegramConfig();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || fallback.botToken;
  const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID || fallback.chatId;
  if (!botToken || !chatId) throw new Error("Telegram token/chat id not available.");

  const status = await readRevenueStatusSnapshot();
  const runtimeStatus = await readLocalRuntimeStatus();
  // === TELEGRAM EVENT DEDUPLICATION (WP-A) ===
  // Runtime health changes must create a fresh event even when draft content is unchanged.
  const draftContent = `${leads.map((lead) => `${lead.company_or_person}:${buildEmailPayload(lead).draftHash}`).join('|')}|runtime:${status.scheduledCycle.state}:${status.scheduledCycle.lastTaskResult}:${runtimeStatus}`;
  const draftVersion = computeDraftHash(draftContent);
  const leadIds = leads.map((l) => l.company_or_person).join('_');
  const eventKey = buildEventKey({
    lead_id: leadIds,
    campaign_id: 'camp-id-b2b-q4',
    draft_version: draftVersion,
    event_type: 'EMAIL_DRAFT_BATCH',
  });

  const lines = [
    `Email Draft Agent v1 - ${stamp()}`,
    "",
    `Draft dibuat: ${leads.length}`,
    campaignPolicy ? "Mode: D-052, role mailbox situs resmi; maksimum 1 email per 24 jam dan per siklus; tanpa follow-up." : "Mode: founder review + approval exact penerima/hash; maksimal 1 pesan per siklus dan 5 percobaan/hari.",
    "",
    "Prioritas:",
    ...leads.map((lead, index) => `${index + 1}. ${lead.company_or_person} - ${subjectFor(lead)}`),
    "",
    "File: ops/revenue/EMAIL_DRAFTS_TODAY.md",
  ];
  const counts = status.outreach.counts;
  lines.push("", "Workflow monitoring (read-only):", `Pipeline: ${status.overall}; scheduler: ${status.scheduledCycle.status}/${status.scheduledCycle.state}; last result: ${status.scheduledCycle.lastTaskResult ?? "unknown"}; next: ${status.scheduledCycle.nextRunTime ?? "unavailable"}.`, `Runtime: ${runtimeStatus}.`, `Artifacts: discovery ${status.artifacts["latest-prospect-discovery.md"].status}, drafts ${status.artifacts["OUTREACH_DRAFTS.json"].status}. Telegram brief/drafts: ${status.notifications.brief.status}/${status.notifications.draftBatch.status}.`, `Email ledger: sent ${counts?.sent ?? "unknown"}, failed ${counts?.failed ?? "unknown"}, blocked ${status.outreach.otherStatuses?.blocked ?? "unknown"}; latest event: ${status.outreach.newestEventAt ?? "unavailable"}.`);

  return sendRevenueTelegram({
    botToken, chatId, text: lines.join("\n"),
    event: {
      event_key: eventKey, lead_id: leadIds, campaign_id: 'camp-id-b2b-q4',
      draft_version: draftVersion, event_type: 'EMAIL_DRAFT_BATCH',
      summary: `Draft batch for ${leads.length} leads; pipeline ${status.overall}; scheduler ${status.scheduledCycle.state}/${status.scheduledCycle.lastTaskResult ?? "unknown"}; ${runtimeStatus}`,
    },
  });
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
  const history = await loadOutreachHistory();
  const sentSet = new Set(history.filter(event => ['attempted', 'sent', 'unknown'].includes(event.status)).map(event => String(event.to || '').trim().toLowerCase()));
  const suppressedSet = await loadSuppressedEmails();
  const campaignPolicy = await loadCampaignPolicy();
  const leads = topLeads(parseCsv(tracker), sentSet, 5, suppressedSet, campaignPolicy, history);
  if (!leads.length) {
    const empty = buildApprovalInbox([], campaignPolicy);
    await fs.writeFile(OUTPUT_PATH, [
      "# Email Outreach Drafts Today",
      "",
      `Generated: ${stamp()}`,
      campaignPolicy ? "Mode: kampanye D-052 aktif; hanya kandidat dengan bukti situs resmi dan role mailbox" : "Mode: review founder + approval satu pesan",
      campaignPolicy ? "Safety: maksimum 1 email per 24 jam, tanpa follow-up; semua pemeriksaan sender tetap wajib" : "Safety: tanpa approval persis tidak ada email terkirim; maksimal 5 percobaan/hari",
      "",
      "Belum ada prospek yang lolos pemeriksaan status, suppression, riwayat, kualitas alamat, dan kebijakan campaign aktif.",
      "Discovery agent akan terus mencari prospek baru; approval lama tidak cocok dengan draft yang berubah.",
    ].join("\n"), "utf8");
    await fs.writeFile(APPROVAL_PATH, empty, "utf8");
    await fs.writeFile(MACHINE_DRAFTS_PATH, "[]\n", "utf8");
    console.log("EMAIL_DRAFT_AGENT=PASS");
    console.log("DRAFTS=0 (Tidak ada kandidat yang lolos pemeriksaan saat ini)");
    console.log(`APPROVAL_INBOX=${APPROVAL_PATH}`);
    await runRevenueNotification({ enabled: shouldSendTelegram, eventType: "EMAIL_DRAFT_BATCH", send: () => sendTelegram([], campaignPolicy) });
    return;
  }

  const output = buildDrafts(leads, campaignPolicy);
  const machineDrafts = leads.map(buildEmailPayload);
  await fs.writeFile(MACHINE_DRAFTS_PATH, `${JSON.stringify(machineDrafts, null, 2)}\n`, "utf8");
  await fs.writeFile(OUTPUT_PATH, output, "utf8");
  await fs.writeFile(APPROVAL_PATH, buildApprovalInbox(leads, campaignPolicy), "utf8");

  await runRevenueNotification({ enabled: shouldSendTelegram, eventType: "EMAIL_DRAFT_BATCH", send: () => sendTelegram(leads, campaignPolicy) });

  console.log("EMAIL_DRAFT_AGENT=PASS");
  console.log(`DRAFTS=${OUTPUT_PATH}`);
  console.log(`APPROVAL_INBOX=${APPROVAL_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((err) => {
  console.error("EMAIL_DRAFT_AGENT=FAIL");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
