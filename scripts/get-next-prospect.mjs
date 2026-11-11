import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TRACKER_PATH = path.join(ROOT, 'ops/revenue/PROSPECT_TRACKER.csv');

if (!fs.existsSync(TRACKER_PATH)) {
  console.log("JSON_OUTPUT:" + JSON.stringify({ error: "File tracker tidak ditemukan." }));
  process.exit(0);
}

const raw = fs.readFileSync(TRACKER_PATH, 'utf-8');
const lines = raw.split(/\r?\n/);
if (lines.length < 2) {
  console.log("JSON_OUTPUT:" + JSON.stringify({ error: "Tracker masih kosong." }));
  process.exit(0);
}

const headerLine = lines[0];
const headers = headerLine.split(',').map(h => h.replace(/"/g, ''));
const statusIdx = headers.indexOf('status');
const contactIdx = headers.indexOf('public_contact');
const msgIdx = headers.indexOf('recommended_message');
const nameIdx = headers.indexOf('company_or_person');

if (statusIdx === -1 || contactIdx === -1) {
  console.log("JSON_OUTPUT:" + JSON.stringify({ error: "Format CSV tracker tidak valid (kolom status atau public_contact hilang)." }));
  process.exit(0);
}

let foundIndex = -1;
let foundContact = "";
let foundMsg = "";
let foundName = "";

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { cells.push(current); current = ""; }
    else current += ch;
  }
  cells.push(current);
  
  const status = cells[statusIdx];
  const contact = cells[contactIdx];
  
  if ((status === 'new' || status === 'demo_ready') && contact && !contact.includes('@') && (contact.includes('+62') || contact.startsWith('08'))) {
    foundIndex = i;
    foundContact = contact;
    foundMsg = cells[msgIdx] || `Halo ${cells[nameIdx]}, kami dari JAGAT AI...`;
    foundName = cells[nameIdx];
    
    cells[statusIdx] = 'wa_sent';
    lines[i] = cells.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    break;
  }
}

if (foundIndex === -1) {
  console.log("JSON_OUTPUT:" + JSON.stringify({ error: "Saat ini tidak ada prospek WA baru di tracker." }));
  process.exit(0);
}

fs.writeFileSync(TRACKER_PATH, lines.join('\n'), 'utf-8');

let cleanPhone = foundContact.replace(/\D/g, '');
if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(foundMsg)}`;

const replyMsg = `🎯 **PROSPEK DITEMUKAN** 🎯\n\n**Nama Bisnis:** ${foundName}\n**Nomor WA:** ${foundContact}\n\n✅ Klik link di bawah ini untuk mengirim pesan penawaran secara instan lewat WhatsApp Anda:\n\n${waLink}`;

console.log("JSON_OUTPUT:" + JSON.stringify({ success: true, replyText: replyMsg }));
process.exit(0);
