#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from 'puppeteer';
import { resolveMx } from 'node:dns/promises';

const ROOT = process.cwd();
const REVENUE_DIR = path.join(ROOT, "ops", "revenue");
const TRACKER_PATH = path.join(REVENUE_DIR, "PROSPECT_TRACKER.csv");

const GLOBAL_QUERIES = [
  { query: 'marketing agency in New York "contact us" email', niche: 'marketing-agency', offer: 'AI Workflow Assistant', location: 'USA' },
  { query: 'plumbing services London "email"', niche: 'plumbing', offer: 'AI Lead Intake', location: 'UK' },
  { construct: true } // Just a marker
];

async function hasValidMx(email: string) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const mx = await resolveMx(domain);
    return mx && mx.length > 0;
  } catch (err) {
    return false;
  }
}

function extractEmails(text: string) {
  const ignore = new Set(["example@example.com", "email@example.com", "example@yourdomain.com", "admin@yourdomain.com", "info@yourdomain.com"]);
  const rawEmails = [...new Set([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0].toLowerCase()))];
  return rawEmails.filter((email) => {
    if (ignore.has(email) || email.endsWith(".png") || email.endsWith(".jpg") || email.includes("yourdomain.com")) return false;
    if (email.startsWith("sentry@") || email.startsWith("noreply@") || email.startsWith("test@") || email.startsWith("example@")) return false;
    return true;
  });
}

function decodeHtml(text: string) {
  return String(text || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function fetchSearch(query: string) {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`[GlobalScout] Searching DuckDuckGo: ${query}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract Result Links
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a.result__url'));
      return anchors.map(a => (a as HTMLAnchorElement).href);
    });
    
    await browser.close();
    return links;
  } catch (err) {
    console.error(`[GlobalScout] Search failed:`, err);
    await browser.close();
    return [];
  }
}

async function scrapeWebsiteForEmail(url: string) {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let validEmail = null;
  
  try {
    console.log(`[GlobalScout] Inspecting: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const html = await page.content();
    const emails = extractEmails(html);
    
    for (const e of emails) {
      if (await hasValidMx(e)) {
        validEmail = e;
        break;
      }
    }
  } catch (err) {
    // Ignore timeout/navigation errors for small sites
  } finally {
    await browser.close();
  }
  
  return validEmail;
}

function extractDomainName(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

async function main() {
  console.log("🌍 Starting JAGAT Global Prospect Discovery Agent...");
  
  const queryObj = GLOBAL_QUERIES[Math.floor(Math.random() * (GLOBAL_QUERIES.length - 1))];
  const links = await fetchSearch(queryObj.query as string);
  
  let found = 0;
  let newLeads = [];
  
  for (const link of links.slice(0, 5)) { // Check top 5 results
    // Attempt to decode DuckDuckGo redirect url if needed
    let target = link;
    if (target.includes('uddg=')) {
      target = decodeURIComponent(target.split('uddg=')[1].split('&')[0]);
    }
    
    if (target.includes('facebook.com') || target.includes('yelp.com') || target.includes('linkedin.com')) {
      continue; // Skip giant directories
    }

    const email = await scrapeWebsiteForEmail(target);
    if (email) {
      const companyName = extractDomainName(target);
      console.log(`✅ Found Global Lead: ${companyName} | ${email}`);
      newLeads.push(`"${nowDate()}","new","${queryObj.niche}","${companyName}","${target}","${email}","global_scout:${queryObj.location}","International prospect discovered via Global Scout","${queryObj.offer}","Outreach via Global Copywriter","","","",""`);
      found++;
    }
  }
  
  if (found > 0) {
    const trackerRaw = await fs.readFile(TRACKER_PATH, 'utf8');
    const prefix = trackerRaw.endsWith("\n") ? "" : "\n";
    await fs.appendFile(TRACKER_PATH, `${prefix}${newLeads.join("\n")}\n`, "utf8");
    console.log(`💾 Appended ${found} global leads to PROSPECT_TRACKER.csv`);
  } else {
    console.log(`ℹ️ No new valid global emails found in this cycle.`);
  }
}

function nowDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

main().catch(console.error);
