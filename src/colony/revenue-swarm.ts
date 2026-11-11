// @ts-nocheck
// ============================================================================
// JAGAT Colony Ã¢â‚¬â€ Revenue Swarm (Multi-Agent Orchestrator)
// CEO Agent that manages Scout, Copywriter, Delivery, and Reporter agents.
// ============================================================================

import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { generateVoiceNote, formatForSpeech } from './voice-engine.js';
import { sendTelegramVoiceNote, sendTelegramText } from './telegram-adapter.js';

const execAsync = util.promisify(exec);
const ROOT = process.cwd();
const DAILY_DIR = path.join(ROOT, 'ops', 'revenue', 'daily');

/**
 * Runs a worker agent script and returns its output.
 */
async function runWorker(scriptName: string, args: string = '', executor: string = 'node'): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const cmd = `${executor} ${path.join(ROOT, 'scripts', scriptName)} ${args}`;
  console.log(`[CEO Agent] Mendisiplinkan agen: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { stdout, stderr, success: true };
  } catch (error: any) {
    return { stdout: error.stdout, stderr: error.stderr, success: false };
  }
}

/**
 * Executes one full Swarm cycle.
 */
export async function runSwarmCycle(): Promise<void> {
  console.log("=========================================");
  console.log("Ã°Å¸Å¡â‚¬ [CEO Agent] Memulai Siklus Revenue Swarm...");
  console.log("=========================================\n");

  let reportText = "Laporan Siklus Swarm:\n";

  // 1. Scout Agent (Pencarian Lead Lokal & Global)
  console.log("[1A] Memanggil Local Scout Agent (Indonesia)...");
  const scoutLocal = await runWorker('prospect-discovery-agent-v1.mjs', '--max=5 --max-scan=30');
  
  console.log("[1B] Memanggil Global Scout Agent (International)...");
  // We use tsx for ts files
  const scoutGlobal = await runWorker('global-discovery-agent.ts', '', 'npx tsx');
  
  if (scoutLocal.success || scoutGlobal.success) {
    reportText += "- Scout Agent berhasil mengumpulkan prospek baru dari internet (Lokal & Global).\n";
  } else {
    reportText += "- Scout Agent mengalami sedikit kendala pencarian, menggunakan data sebelumnya.\n";
  }

  // 2. Analyst Agent (Briefing)
  console.log("\n[2] Memanggil Analyst Agent (Analisis Prospek)...");
  const analyst = await runWorker('autonomous-revenue-agent-v1.mjs');
  if (analyst.success) {
    reportText += "- Analyst Agent telah mengevaluasi kelayakan prospek dan menyusun prioritas.\n";
  }

  // 3. Copywriter Agent (Pembuatan Draf Email Multibahasa)
  console.log("\n[3] Memanggil Global Copywriter Agent (AI Drafts)...");
  const copywriter = await runWorker('global-copywriter.ts', '', 'npx tsx');
  if (copywriter.success) {
    reportText += "- Copywriter Agent berhasil merangkai pesan email penawaran yang personal (ID & EN).\n";
  }

  // 4. Delivery Agent (approval exact-recipient/hash; max satu per siklus)
  console.log("\n[4] Memproses email yang sudah disetujui founder...");
  if ((scoutLocal.success || scoutGlobal.success) && analyst.success && copywriter.success) {
    const delivery = await runWorker('process-approved-outreach.mjs');
    const deliverySummary = delivery.stdout?.trim().split(/\r?\n/).find(line => line.startsWith('APPROVED_OUTREACH ')) || '';
    reportText += delivery.success && deliverySummary.includes('failed=0')
      ? `- Outreach approval-only selesai: ${deliverySummary}.\n`
      : `- Outreach approval-only gagal atau belum dapat dipastikan: ${deliverySummary || delivery.stderr?.trim() || 'tidak ada ringkasan worker'}.\n`;
  } else {
    reportText += "- Outreach dilewati karena tahap scout, analyst, atau copywriter gagal.\n";
  }
  // 5. Closer Agent (Inbox Negotiator)
  console.log("\n[5] Memanggil Closer Agent (Membaca Balasan Inbox)...");
  const closer = await runWorker('closer-agent.ts', '', 'npx tsx');
  if (closer.success && closer.stdout.includes('hot prospects!')) {
    reportText += "- Ã°Å¸Å½Â¯ Closer Agent berhasil menemukan balasan klien dan mengirimkan link meeting!\n";
  } else {
    reportText += "- Closer Agent telah mengecek inbox, belum ada balasan prospek baru.\n";
  }

  console.log("[CEO Agent] Siklus eksekusi selesai. Menyusun laporan akhir...");

  // 6. Reporter Agent (Voice & Telegram)
  console.log("\n[6] Memanggil Reporter Agent (Voice & Telegram)...");
  
  try {
    const naturalSpeech = await formatForSpeech(reportText);
    const audioFileName = `swarm-report-${Date.now()}.mp3`;
    const audioPath = await generateVoiceNote(naturalSpeech, audioFileName);
    
    // Kirim ke Telegram
    await sendTelegramVoiceNote(audioPath);
    
    // Kirim rekap teks juga sebagai backup/log cepat
    await sendTelegramText(`Ã°Å¸â€œÅ  <b>JAGAT Swarm Cycle Selesai</b>\n\n${reportText}\n\nÃ°Å¸Å½â„¢Ã¯Â¸Â <i>Voice Note telah dikirim.</i>`);
    
    console.log("[Reporter Agent] Laporan suara dan teks sukses dikirim ke Bos Fatur!");
  } catch (err) {
    console.error("[Reporter Agent] Gagal mengirim laporan Telegram:", err);
  }

  console.log("\n=========================================");
  console.log("Ã°Å¸ÂÂ [CEO Agent] Siklus Swarm Berakhir.");
  console.log("=========================================");
}
