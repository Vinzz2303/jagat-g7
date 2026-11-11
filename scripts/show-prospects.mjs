#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { isPlausibleOutreachEmail } from "./email-quality-guard.mjs";

dotenv.config();

const ROOT = process.cwd();
const TRACKER_PATH = path.join(ROOT, "ops", "revenue", "PROSPECT_TRACKER.csv");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
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
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ""]));
  });
  return { headers, rows };
}

async function main() {
  const args = process.argv.slice(2);
  const count = Number.parseInt(args.find((a) => a.startsWith("--count="))?.split("=")[1] ?? "10", 10);
  const sendTelegram = args.includes("--send-telegram");

  let raw = "";
  try {
    raw = await fs.readFile(TRACKER_PATH, "utf8");
  } catch (err) {
    console.error("Tracker CSV tidak ditemukan:", err.message);
    process.exit(1);
  }

  const { rows } = parseCsv(raw);
  const suppressed = JSON.parse((await fs.readFile(path.join(ROOT, "ops", "revenue", "SUPPRESSION_LIST.json"), "utf8")).replace(/^\uFEFF/, ""));
  if (!Array.isArray(suppressed)) throw new Error("Suppression list must be a JSON array.");
  const suppressedEmails = new Set(suppressed.map((row) => String(row.email || "").trim().toLowerCase()));
  if (!rows.length) {
    console.log("Tracker masih kosong.");
    process.exit(0);
  }

  // Ambil N prospek terbaru (dari baris paling akhir)
  const eligible = rows.filter((row) => {
    const contact = String(row.public_contact || "").trim();
    const status = String(row.status || "").trim().toLowerCase();
    return contact && !["suppressed", "unsubscribed"].includes(status) &&
      (!contact.includes("@") || (isPlausibleOutreachEmail(contact) && !suppressedEmails.has(contact.toLowerCase())));
  });
  const latest = eligible.slice(-count).reverse();

  let message = `🎯 <b>DAFTAR PROSPEK TERBARU JAGAT G7</b> 🎯\n\n`;
  message += `Menampilkan <b>${latest.length} prospek</b> terbaru dari pipeline revenue:\n\n`;

  latest.forEach((row, idx) => {
    const name = row.company_or_person || "Bisnis";
    const niche = row.niche || "Umum";
    const contact = row.public_contact || "-";
    const offer = row.offer || "AI Admin Bot";
    const status = row.status || "new";

    let waLink = "";
    if (contact && !contact.includes("@")) {
      let cleanPhone = contact.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);
      if (cleanPhone.startsWith("62")) {
        const textMsg = encodeURIComponent(row.recommended_message || `Halo ${name}, kami dari JAGAT AI...`);
        waLink = `https://wa.me/${cleanPhone}?text=${textMsg}`;
      }
    }

    message += `<b>${idx + 1}. ${escapeHtml(name)}</b>\n`;
    message += `• Kategori: <code>${escapeHtml(niche)}</code>\n`;
    message += `• Kontak: <code>${escapeHtml(contact)}</code>\n`;
    message += `• Status: <code>${escapeHtml(status)}</code>\n`;
    message += `• Penawaran: <i>${escapeHtml(offer)}</i>\n`;
    if (waLink) {
      message += `👉 <a href="${waLink}"><b>[Kirim WhatsApp Sekarang]</b></a>\n`;
    }
    message += `\n`;
  });

  console.log(message);

  if (sendTelegram) {
    try {
      const { sendTelegramText } = await import("../dist/colony/telegram-adapter.js");
      await sendTelegramText(message);
      console.log("✅ Berhasil dikirim langsung ke Telegram Founder!");
    } catch (err) {
      console.error("Gagal mengirim ke Telegram:", err.message);
      process.exitCode = 1;
    }
  }
}

main();
