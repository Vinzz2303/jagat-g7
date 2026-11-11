#!/usr/bin/env node
import { runSwarmCycle } from '../src/colony/revenue-swarm.js';

const DELAY_HOURS = 2;
const DELAY_MS = DELAY_HOURS * 60 * 60 * 1000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n🤖 Menghidupkan JAGAT Revenue Swarm...`);
  console.log(`⏱️ Mode: Berkelanjutan (Interval ${DELAY_HOURS} Jam)\n`);

  let cycleCount = 1;

  while (true) {
    console.log(`\n>>> [SWARM ENGINE] Menjalankan Siklus Ke-${cycleCount} <<<`);
    try {
      await runSwarmCycle();
    } catch (err) {
      console.error(`[SWARM ENGINE] Terjadi kesalahan fatal pada siklus ${cycleCount}:`, err);
    }
    
    console.log(`\n[SWARM ENGINE] Siklus ${cycleCount} selesai. Mesin beristirahat selama ${DELAY_HOURS} jam untuk menghindari deteksi spam/bot...`);
    cycleCount++;
    await sleep(DELAY_MS);
  }
}

main().catch(console.error);
