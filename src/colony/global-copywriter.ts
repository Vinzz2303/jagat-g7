// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import { HybridRouter } from '../services/hybrid-router.js';

const ROOT = process.cwd();
const REVENUE_DIR = path.join(ROOT, "ops", "revenue");
const TRACKER_PATH = path.join(REVENUE_DIR, "PROSPECT_TRACKER.csv");
const OUTPUT_PATH = path.join(REVENUE_DIR, "EMAIL_DRAFTS_TODAY.md");

function parseCsvLine(line: string) {
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

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? ""]));
  });
  return { headers, rows };
}

async function writeDrafts(leads: any[], draftedEmails: string[]) {
  const now = new Date().toISOString();
  const output = [
    "# Email Outreach Drafts Today (GLOBAL EDITION)",
    "",
    `Generated: ${now}`,
    "Mode: LLM-driven contextual copywriting",
    "",
    ...leads.map((lead, index) => [
      `## Email ${index + 1} - ${lead.company_or_person}`,
      `To: ${lead.public_contact}`,
      `Subject: Inquiry about ${lead.company_or_person} & AI Workflow`,
      "",
      "Body:",
      "```text",
      draftedEmails[index],
      "```",
      "",
    ].join("\n"))
  ].join("\n");
  
  await fs.writeFile(OUTPUT_PATH, output, "utf8");
  console.log(`[GlobalCopywriter] Drafts written to ${OUTPUT_PATH}`);
}

async function generateEmailForLead(lead: any): Promise<string> {
  const isGlobal = String(lead.source).includes('global');
  const language = isGlobal ? "English" : "Indonesian";
  const context = `Target Company: ${lead.company_or_person}\nTarget Niche: ${lead.niche}\nOffer: ${lead.offer}\nLocation/Source: ${lead.source}`;

  const prompt = `Write a short, highly professional cold outreach email (B2B) in ${language}. 
Context of the prospect:
${context}

Rules:
1. It must sound very human, not like an obvious template.
2. The sender is "Faturachman Al Kahfi from JAGAT AI".
3. We are offering AI workflow automation or an AI Admin bot to save them time and money.
4. Keep it under 100 words.
5. NO placeholders like [Insert Name]. If you don't know the name, just use a generic appropriate greeting (e.g., Hi Team, or Halo Tim).
6. DO NOT include the Subject line in the output, just the body.

Draft the email now:`;

  try {
    const res = await HybridRouter.callGeminiSmart(prompt, "You are a world-class B2B copywriter.");
    return res;
  } catch (err) {
    console.error(`[GlobalCopywriter] Failed to generate email for ${lead.company_or_person}`, err);
    return isGlobal 
      ? `Hi Team at ${lead.company_or_person},\n\nI noticed your company online and wanted to reach out. I'm Faturachman from JAGAT AI, and we help businesses like yours automate workflows with AI to save time and increase efficiency.\n\nWould you be open to a quick demo of how an AI Admin could help your operations?\n\nBest,\nFaturachman Al Kahfi`
      : `Halo Tim ${lead.company_or_person},\n\nSaya Faturachman dari JAGAT AI. Kami membantu otomasi admin bisnis dengan AI. Boleh saya kirim demo singkat?\n\nSalam,\nFaturachman`;
  }
}

async function main() {
  console.log("✍️  Starting JAGAT Global Copywriter Agent...");
  
  const tracker = await fs.readFile(TRACKER_PATH, "utf8");
  const { headers, rows } = parseCsv(tracker);
  
  const targetLeads = rows.filter(r => r.status === 'email_found' || r.status === 'new')
                          .filter(r => String(r.public_contact).includes('@'))
                          .slice(0, 10); // Prepare up to 10 drafts
                          
  if (targetLeads.length === 0) {
    console.log("ℹ️ No leads need drafts.");
    return;
  }
  
  console.log(`[GlobalCopywriter] Drafting emails for ${targetLeads.length} leads...`);
  
  const draftedEmails = [];
  for (const lead of targetLeads) {
    console.log(`  -> Drafting for ${lead.company_or_person}...`);
    const draft = await generateEmailForLead(lead);
    draftedEmails.push(draft);
    lead.llm_draft = draft; // Save to object
  }
  
  await writeDrafts(targetLeads, draftedEmails);
  
  // Write back to CSV
  console.log(`[GlobalCopywriter] Saving drafts to tracker...`);
  if (!headers.includes("llm_draft")) {
    headers.push("llm_draft");
  }
  
  const newCsvLines = rows.map((row) => {
    return headers.map((header) => {
      let val = row[header] ?? "";
      if (header === "llm_draft" && !val) {
        const foundLead = targetLeads.find(l => l.public_contact === row.public_contact);
        if (foundLead && foundLead.llm_draft) {
          val = foundLead.llm_draft;
        }
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",");
  });
  
  const newCsvContent = headers.map(h => `"${h}"`).join(",") + '\n' + newCsvLines.join('\n') + '\n';
  await fs.writeFile(TRACKER_PATH, newCsvContent, 'utf8');
}

main().catch(console.error);
