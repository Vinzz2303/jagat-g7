#!/usr/bin/env node
/**
 * JAGAT Colony — Distillation Pool Founder Review CLI
 * 
 * Provides an interactive terminal UI for the founder to review 
 * cognitive distillation records that need human screening.
 * 
 * Usage:
 *   npm run distillation:review
 */

import readline from "readline";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET || "jagat-colony-internal-2026";

const HEADERS = {
  "Content-Type": "application/json",
  "X-Colony-Secret": SECRET,
  "X-Colony-Caller": "Faturachman Al Kahfi",
  "X-Colony-Tier": "SOVEREIGN",
  "X-Colony-Token": "distillation-review-cli",
};

// ANSI Color codes
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgCyan: "\x1b[46m",
  white: "\x1b[37m",
};

async function fetchPendingRecords() {
  try {
    const res = await fetch(`${BACKEND}/colony/distillation/records?status=needs_founder_review`, {
      method: "GET",
      headers: HEADERS,
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error(`${C.red}Error fetching records: ${err.message}${C.reset}`);
    return [];
  }
}

async function updateRecordStatus(recordId, status, reviewNote = "") {
  try {
    const res = await fetch(`${BACKEND}/colony/distillation/records/${recordId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ status, reviewNote }),
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error(`${C.red}Error updating record ${recordId}: ${err.message}${C.reset}`);
    return false;
  }
}

function promptChar(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

function promptLine(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log(`${C.cyan}${C.bold}============================================================${C.reset}`);
  console.log(`${C.cyan}${C.bold}   JAGAT G7 — Cognitive Distillation Founder Review CLI${C.reset}`);
  console.log(`${C.gray}   Backend: ${BACKEND}${C.reset}`);
  console.log(`${C.cyan}${C.bold}============================================================${C.reset}\n`);

  console.log(`${C.gray}Fetching records needing founder review...${C.reset}`);
  const records = await fetchPendingRecords();

  if (records.length === 0) {
    console.log(`\n🎉 ${C.green}${C.bold}Tidak ada record yang perlu direview!${C.reset}`);
    console.log(`${C.gray}Semua record distillation sudah discreen atau diexport.${C.reset}\n`);
    process.exit(0);
  }

  console.log(`\nFound ${C.yellow}${C.bold}${records.length}${C.reset} record(s) awaiting review.\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let accepted = 0;
  let rejected = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const percentage = Math.round(((i + 1) / records.length) * 100);

    console.log(`${C.cyan}${C.bold}------------------------------------------------------------${C.reset}`);
    console.log(`${C.cyan}${C.bold}RECORD ${i + 1} OF ${records.length} (${percentage}% completed)${C.reset}`);
    console.log(`${C.gray}ID: ${record.recordId} | Created: ${record.createdAt}${C.reset}`);
    if (record.tags && record.tags.length > 0) {
      console.log(`${C.gray}Tags: ${C.magenta}${record.tags.join(", ")}${C.reset}`);
    }
    console.log(`${C.cyan}${C.bold}------------------------------------------------------------${C.reset}\n`);

    console.log(`${C.bold}${C.yellow}QUESTION:${C.reset}`);
    console.log(`${record.question}\n`);

    console.log(`${C.bold}${C.green}ANSWER:${C.reset}`);
    console.log(`${record.answer}\n`);

    if (record.screening) {
      console.log(`${C.bold}${C.magenta}SCREENING ASSESSMENT (Score: ${record.screening.overallScore.toFixed(2)}):${C.reset}`);
      console.log(`  - Grounding:  ${record.screening.groundingScore >= 0.7 ? C.green : C.red}${record.screening.groundingScore.toFixed(2)}${C.reset}`);
      console.log(`  - Citation:   ${record.screening.citationScore >= 0.7 ? C.green : C.red}${record.screening.citationScore.toFixed(2)}${C.reset}`);
      console.log(`  - Safety:     ${record.screening.safetyScore >= 0.7 ? C.green : C.red}${record.screening.safetyScore.toFixed(2)}${C.reset}`);
      console.log(`  - Usefulness: ${record.screening.usefulnessScore >= 0.7 ? C.green : C.red}${record.screening.usefulnessScore.toFixed(2)}${C.reset}`);
      if (record.screening.reasons && record.screening.reasons.length > 0) {
        console.log(`  - Flags:`);
        for (const reason of record.screening.reasons) {
          console.log(`    ⚠️  ${C.yellow}${reason}${C.reset}`);
        }
      }
      console.log();
    }

    if (record.contextSources && record.contextSources.length > 0) {
      console.log(`${C.bold}${C.gray}SOURCES CITED:${C.reset}`);
      for (const src of record.contextSources) {
        console.log(`  📖 [${src.source}] ${src.title || "No Title"} (score: ${src.score?.toFixed(2) || "N/A"})`);
      }
      console.log();
    }

    let validAction = false;
    while (!validAction) {
      const action = await promptChar(rl, `${C.bold}Actions: [a] Accept  [r] Reject  [s] Skip  [q] Quit → ${C.reset}`);

      if (action === "a") {
        const note = await promptLine(rl, `${C.gray}Add note (optional): ${C.reset}`);
        const success = await updateRecordStatus(record.recordId, "accepted", note);
        if (success) {
          console.log(`\n✅ ${C.green}Record accepted!${C.reset}\n`);
          accepted++;
          validAction = true;
        }
      } else if (action === "r") {
        const note = await promptLine(rl, `${C.red}Reason/Note for rejection (required): ${C.reset}`);
        if (!note.trim()) {
          console.log(`${C.red}Note is required to reject a record.${C.reset}`);
          continue;
        }
        const success = await updateRecordStatus(record.recordId, "rejected", note);
        if (success) {
          console.log(`\n❌ ${C.red}Record rejected!${C.reset}\n`);
          rejected++;
          validAction = true;
        }
      } else if (action === "s") {
        console.log(`\n⏭️  ${C.yellow}Record skipped.${C.reset}\n`);
        skipped++;
        validAction = true;
      } else if (action === "q") {
        console.log(`\n👋 Exiting review session.`);
        console.log(`${C.cyan}Summary: Accepted: ${accepted} | Rejected: ${rejected} | Skipped: ${skipped}${C.reset}\n`);
        rl.close();
        process.exit(0);
      } else {
        console.log(`${C.red}Invalid option. Please enter a, r, s, or q.${C.reset}`);
      }
    }
  }

  console.log(`${C.cyan}${C.bold}============================================================${C.reset}`);
  console.log(`${C.green}${C.bold}   Review session completed!${C.reset}`);
  console.log(`   Accepted: ${C.green}${accepted}${C.reset} | Rejected: ${C.red}${rejected}${C.reset} | Skipped: ${C.yellow}${skipped}${C.reset}`);
  console.log(`${C.cyan}${C.bold}============================================================${C.reset}\n`);

  rl.close();
}

main();
