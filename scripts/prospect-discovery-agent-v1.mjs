#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from 'node:url';
import { campaignLeadEligibility, isValidCampaignPolicy, websiteHost } from './outreach-campaign-guard.mjs';
import { resolveMx } from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isPlausibleOutreachEmail } from './email-quality-guard.mjs';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const REVENUE_DIR = path.join(ROOT, "ops", "revenue");
const TRACKER_PATH = path.join(REVENUE_DIR, "PROSPECT_TRACKER.csv");
const REPORT_PATH = path.join(REVENUE_DIR, "latest-prospect-discovery.md");
const STATE_PATH = path.join(REVENUE_DIR, "prospect-discovery-state.json");
const BASE = "https://www.indonesiayp.com";

const args = new Set(process.argv.slice(2));
const maxNew = Number.parseInt(process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] ?? "8", 10);
const maxScan = Number.parseInt(process.argv.find((arg) => arg.startsWith("--max-scan="))?.split("=")[1] ?? "60", 10);
const emailOnly = !args.has("--allow-phone");

const CITY_POOL = [
  // Batch 1 (original)
  "Jakarta", "Bandung", "Surabaya", "Tangerang", "Bekasi", "Depok", "Semarang",
  // Batch 2 (new cities — fresh territory)
  "Medan", "Makassar", "Yogyakarta", "Palembang", "Pekanbaru", "Balikpapan",
  "Bogor", "Malang", "Denpasar", "Manado",
];
const SOURCE_TEMPLATES = [
  // Original niches
  { niche: "restaurant", offer: "AI Admin Bot + Website Cepat", slug: "restaurants" },
  { niche: "school", offer: "AI Admin Bot + Website Cepat", slug: "schools" },
  { niche: "printing", offer: "AI Admin Bot + Website Cepat", slug: "printing" },
  { niche: "laundry", offer: "AI Admin Bot", slug: "laundry" },
  { niche: "fashion-tailor", offer: "AI Admin Bot + Website Cepat", slug: "fashion" },
  { niche: "digital-agency", offer: "AI Research Assistant + AI Admin Bot", slug: "digital_marketing" },
  { niche: "consulting", offer: "Sovereign Research Assistant", slug: "business_consultants" },
  { niche: "software", offer: "AI Workflow Assistant", slug: "software_applications" },
  { niche: "event", offer: "Website Cepat + AI Admin Bot", slug: "event_management" },
  { niche: "real-estate", offer: "AI Lead Intake + Website Cepat", slug: "real_estate_agents" },
  { niche: "clinic", offer: "AI Admin Bot + Research Assistant", slug: "clinics" },
  { niche: "logistics", offer: "Internal Command Center", slug: "logistics" },
  // NEW niches — fresh territory
  { niche: "salon", offer: "AI Admin Bot + Website Cepat", slug: "beauty_salons" },
  { niche: "gym-fitness", offer: "AI Admin Bot + Website Cepat", slug: "gymnasiums" },
  { niche: "photography", offer: "Website Cepat + AI Admin Bot", slug: "photographers" },
  { niche: "catering", offer: "AI Admin Bot + Website Cepat", slug: "catering" },
  { niche: "travel-agent", offer: "AI Lead Intake + Website Cepat", slug: "travel_agencies" },
  { niche: "furniture", offer: "Website Cepat + AI Admin Bot", slug: "furniture" },
  { niche: "bengkel", offer: "AI Admin Bot + Website Cepat", slug: "auto_repair" },
  { niche: "apotek", offer: "AI Admin Bot + Website Cepat", slug: "pharmacies" },
];
const CATEGORIES = SOURCE_TEMPLATES.flatMap((source) =>
  CITY_POOL.map((city) => ({ ...source, city })),
);

let browser = null;

async function getBrowser() {
  if (!browser) {
    const { default: puppeteer } = await import("puppeteer");
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function fetchPageWithPuppeteer(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (!response?.ok()) return { html: '', url: page.url() };
    return { html: await page.content(), url: page.url() };
  } catch (err) {
    console.error(`Error fetching ${url}: ${err.message}`);
    return { html: "", url };
  } finally {
    await page.close();
  }
}

async function fetchHtmlWithPuppeteer(url) {
  return (await fetchPageWithPuppeteer(url)).html;
}

async function hasValidMx(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const mx = await resolveMx(domain);
    return mx && mx.length > 0;
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' && process.platform === 'win32') {
      try {
        const { stdout } = await execFileAsync('nslookup', ['-type=mx', email.split('@')[1]], { timeout: 5000 });
        return /mail exchanger|MX preference/i.test(stdout);
      } catch {
        return false;
      }
    }
    return false;
  }
}

function nowDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]*>/g, " "));
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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

async function readText(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(filePath, fallback) {
  const raw = await readText(filePath, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function categoryKey(category) {
  return `${category.slug}:${category.city}`;
}

function categoryPageUrl(category, page) {
  const city = encodeURIComponent(category.city);
  if (page <= 1) return `${BASE}/category/${category.slug}/city:${city}`;
  return `${BASE}/category/${category.slug}/${page}/city:${city}`;
}

function rotateArray(items, startIndex) {
  if (!items.length) return [];
  const index = Math.max(0, Math.min(startIndex, items.length - 1));
  return [...items.slice(index), ...items.slice(0, index)];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(raw, baseUrl = "") {
  try {
    const url = new URL(decodeHtml(raw), baseUrl || undefined);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function extractCompanyUrls(html) {
  const found = new Set();
  for (const match of html.matchAll(/href=["'](\/company\/[0-9]+\/[^"']+)["']/gi)) {
    const url = `${BASE}${decodeHtml(match[1]).split("?")[0]}`;
    found.add(url);
  }
  for (const match of html.matchAll(/company\/[0-9]+\/[A-Za-z0-9_%\-]+/gi)) {
    found.add(`${BASE}/${match[0]}`);
  }
  return [...found];
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripTags(match[1]);
  }
  return "";
}

function extractEmails(text) {
  const ignore = new Set(["example@example.com", "email@example.com", "example@yourdomain.com", "admin@yourdomain.com", "info@yourdomain.com"]);
  const rawEmails = [...new Set([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0].toLowerCase()))];
  return rawEmails.filter((email) => {
    if (!isPlausibleOutreachEmail(email)) return false;
    if (ignore.has(email) || email.endsWith(".png") || email.endsWith(".jpg") || email.includes("wixpress.com") || email.includes("yourdomain.com")) return false;
    // Basic junk filter
    if (email.startsWith("sentry@") || email.startsWith("noreply@") || email.startsWith("no-reply@") || email.startsWith("example@")) return false;
    if (email.startsWith("test@") || email.startsWith("info@example")) return false;
    return true;
  });
}

function extractPhones(text) {
  const phones = [...text.matchAll(/(?:\+?62|0)[\d\s().-]{8,18}/g)]
    .map((m) => m[0].replace(/\s+/g, " ").trim())
    .filter((phone) => phone.replace(/\D/g, "").length >= 9);
  return [...new Set(phones)];
}

function extractWebsite(html) {
  // Only the directory's explicit business Website field/link is a candidate
  // official site. Arbitrary /redir links can be sponsored advertisements.
  const website = firstMatch(html, [
    /Website\s*<\/[^>]+>\s*<[^>]+>\s*<a[^>]+href=["']([^"']+)["']/i,
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Website\s*<\/a>/i,
  ]);
  let url = safeUrl(website, BASE);
  if (!website || !url) return "-";
  if (url.hostname.replace(/^www\./, '') === 'indonesiayp.com' && /^\/redir\/\d+$/.test(url.pathname)) {
    const target = url.searchParams.get('u') || '';
    url = safeUrl(/^https?:\/\//i.test(target) ? target : `https://${target}`);
  }
  if (!url) return "-";
  const ignoredHosts = ["indonesiayp.com", "fonts.googleapis.com", "schema.org", "w3.org", "google.com", "gstatic.com", "facebook.com", "instagram.com", "wa.me", "api.whatsapp.com", "woomar.com"];
  if (ignoredHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return "-";
  return url.toString();
}

function extractExternalLinks(html, pageUrl) {
  const links = new Set();
  const blockedHosts = [
    "ajax.googleapis.com",
    "maxcdn.bootstrapcdn.com",
    "googleads.g.doubleclick.net",
    "googletagmanager.com",
    "fundingchoicesmessages.google.com",
    "pagead2.googlesyndication.com",
    "static.cloudflareinsights.com",
    "fonts.googleapis.com",
    "schema.org",
    "w3.org",
    "google.com",
    "gstatic.com",
    "wa.me",
    "api.whatsapp.com",
    "woomar.com"
  ];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = safeUrl(match[1], pageUrl);
    if (!url) continue;
    if (url.hostname.endsWith("indonesiayp.com")) continue;
    if (blockedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) continue;
    if (["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com"].some((host) => url.hostname.includes(host))) continue;
    links.add(url.origin + url.pathname.replace(/\/$/, ""));
  }
  return [...links];
}

function contactPageCandidates(website) {
  const base = safeUrl(website);
  if (!base) return [];
  const paths = ["/", "/contact", "/contact-us", "/kontak", "/hubungi-kami", "/about", "/tentang-kami"];
  return paths.map((suffix) => new URL(suffix, base.origin).toString());
}

export async function findEmailsFromWebsite(website, { fetchPage = fetchPageWithPuppeteer } = {}) {
  const observations = [];
  const checked = [];
  for (const url of contactPageCandidates(website).slice(0, 3)) {
    try {
      console.log(`  [Puppeteer] Crawling ${url}`);
      const page = await fetchPage(url);
      checked.push(page.url || url);
      // Cross-domain redirects do not prove official-site provenance.
      if (!page.html || websiteHost(page.url) !== websiteHost(website)) continue;
      for (const email of extractEmails(page.html)) {
        if (!observations.some(item => item.email === email)) observations.push({ email, sourceUrl: page.url });
      }
    } catch {
      // Missing/blocked pages provide no provenance evidence.
    }
  }
  return { emails: observations.map(item => item.email), observations, checked };
}

function businessNameFromUrl(url) {
  const slug = decodeURIComponent(url.split("/").pop() || "Unknown");
  return slug.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function buildProblem(niche, hasWebsite, hasEmail) {
  if (!hasWebsite) return `Bisnis ${niche} belum terlihat punya website resmi; peluang untuk website cepat dan AI admin.`;
  if (hasEmail) return `Bisnis ${niche} punya kontak email publik; cocok untuk outreach profesional tentang AI admin dan workflow digital.`;
  return `Bisnis ${niche} punya presence publik; cocok ditawarkan audit AI readiness dan automasi admin ringan.`;
}

export async function inspectCompany(url, category, { fetchPage = fetchPageWithPuppeteer, validateMx = hasValidMx, campaignPolicy = null } = {}) {
  console.log(`[Puppeteer] Inspecting directory page: ${url}`);
  const { html } = await fetchPage(url);
  if (!html) return null;
  
  const text = stripTags(html);
  const title = firstMatch(html, [/<title>(.*?)<\/title>/i]);
  const name = title
    ? title.replace(/\s*-\s*.*$/g, "").trim()
    : businessNameFromUrl(url);
  const pageEmails = extractEmails(html);
  const phones = extractPhones(text);
  const directoryWebsite = extractWebsite(html);
  const externalWebsite = directoryWebsite !== "-" ? directoryWebsite : extractExternalLinks(html, url)[0] || "-";
  
  const siteLookup = externalWebsite !== "-" ? await findEmailsFromWebsite(externalWebsite, { fetchPage }) : { emails: [], observations: [], checked: [] };
  const officialSource = (email) => directoryWebsite !== "-" && email.split('@')[1] === websiteHost(directoryWebsite)
    ? siteLookup.observations.find(item => item.email === email)?.sourceUrl : undefined;
  const eligibleRole = (email) => campaignLeadEligibility({ status: 'email_found', public_contact: email, website: directoryWebsite, source: `official_site:${officialSource(email) || ''}` }, campaignPolicy).ok;
  const allEmails = [...new Set([...siteLookup.emails, ...pageEmails])]
    .sort((a, b) => Number(eligibleRole(b)) - Number(eligibleRole(a)) || Number(Boolean(officialSource(b))) - Number(Boolean(officialSource(a))));
  
  // Anti-bounce MX Validation filter
  const validEmails = [];
  for (const e of allEmails) {
    if (await validateMx(e)) {
      validEmails.push(e);
      break; // Just need one good email
    } else {
      console.log(`  [Validator] ❌ Dead domain rejected: ${e}`);
    }
  }

  const contact = validEmails[0] || (!emailOnly ? phones[0] : "") || "";

  if (!contact) return null;

  const hasWebsite = externalWebsite && externalWebsite !== "-";
  const hasEmail = Boolean(validEmails[0]);
  if (emailOnly && !hasEmail) return null;

  return {
    date: nowDate(),
    status: hasEmail ? "email_found" : "new",
    niche: category.niche,
    company_or_person: name,
    website: externalWebsite,
    public_contact: contact,
    source: officialSource(contact) ? `official_site:${officialSource(contact)}` : `puppeteer_discovery:${url}`,
    problem_hypothesis: buildProblem(category.niche, hasWebsite, hasEmail),
    offer: category.offer,
    recommended_message: `Halo Kak, saya Faturachman dari JAGAT AI. Saya lihat ${name} cocok untuk ${category.offer}; boleh saya kirim demo ringan tentang AI admin/website?`,
    next_action: hasEmail ? "Review dan kirim email manual dari EMAIL_DRAFTS_TODAY.md" : "Cari email/DM manual sebelum outreach",
    quoted_price: "",
    response: "",
    follow_up_due: "",
    notes: `Directory=${url}. Email evidence=${officialSource(contact) || "directory/unverified external link"}. Autodiscovered via Puppeteer. Email=${hasEmail ? "yes" : "no"}. Checked=${siteLookup.checked.length} website pages. MX Validated.`,
  };
}

function leadKeys(lead) {
  const keys = [];
  const email = lead.public_contact?.trim().toLowerCase();
  if (email?.includes("@")) keys.push(`email:${email}`);
  const website = safeUrl(lead.website || "");
  const sharedHosts = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "twitter.com", "x.com", "youtube.com", "youtu.be", "alturl.com", "bit.ly", "linktr.ee"];
  if (website) {
    const host = website.hostname.replace(/^www\./, "");
    const shared = sharedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
    keys.push(`website:${host}${shared ? website.pathname.replace(/\/+$/, "").toLowerCase() : ""}`);
  }
  const name = lead.company_or_person?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (name) keys.push(`name:${name}`);
  return keys;
}

async function discover() {
  const trackerRaw = await readText(TRACKER_PATH);
  const { headers, rows } = parseCsv(trackerRaw);
  if (!headers.length) throw new Error("Tracker CSV headers not found.");

  const candidatePolicy = await readJson(path.join(REVENUE_DIR, "AUTO_SEND_POLICY.json"), null);
  const campaignPolicy = isValidCampaignPolicy(candidatePolicy) ? candidatePolicy : null;
  const state = await readJson(STATE_PATH, { nextPages: {}, nextCategoryIndex: 0, lastRunAt: "" });
  const existing = new Set(rows.flatMap(leadKeys));
  const discovered = [];
  const scanned = [];
  const exploredPages = [];
  let inspected = 0;
  let processedCategories = 0;
  const deadline = Date.now() + 8 * 60_000;
  let lastCategoryIndex = Number.isInteger(state.nextCategoryIndex) ? state.nextCategoryIndex : 0;
  const maxPerCategory = Math.max(1, Math.ceil(maxNew / Math.min(CATEGORIES.length, 4)));
  const orderedCategories = rotateArray(CATEGORIES, lastCategoryIndex);

  for (const category of orderedCategories) {
    if (discovered.length >= maxNew) break;
    if (inspected >= maxScan) break;
    if (processedCategories >= Math.min(12, maxScan)) break;
    if (Date.now() >= deadline) break;
    const originalIndex = CATEGORIES.findIndex((item) => categoryKey(item) === categoryKey(category));
    const key = categoryKey(category);
    const startPage = Number.isInteger(state.nextPages?.[key]) ? state.nextPages[key] : 1;
    let lastAttemptedPage = startPage;
    let currentUrlsLength = -1;
    try {
      console.log(`[Puppeteer] Crawling category page: ${categoryPageUrl(category, startPage)}`);
      const html = await fetchHtmlWithPuppeteer(categoryPageUrl(category, startPage));
      const urls = extractCompanyUrls(html).slice(0, 18);
      currentUrlsLength = urls.length;
      let categoryAdded = 0;
      scanned.push(`${category.niche}: page ${startPage}, ${urls.length} urls`);
      exploredPages.push(`${category.niche} p${startPage}`);

      for (const url of urls) {
        if (discovered.length >= maxNew) break;
        if (inspected >= maxScan) break;
        if (categoryAdded >= maxPerCategory) break;
        if (Date.now() >= deadline) break;
        try {
          inspected += 1;
          const lead = await inspectCompany(url, category, { campaignPolicy });
          if (!lead) continue;
          const keys = leadKeys(lead);
          if (keys.some((key) => existing.has(key))) {
            console.log(`  [Skip] Already exists: ${lead.public_contact}`);
            continue;
          }
          keys.forEach((key) => existing.add(key));
          discovered.push(lead);
          categoryAdded += 1;
          console.log(`  [Success] Found valid lead: ${lead.company_or_person} (${lead.public_contact})`);
        } catch (e) {
          console.error(`Error inspecting company ${url}:`, e);
        }
      }
      lastAttemptedPage = startPage;
    } catch (err) {
      scanned.push(`${category.niche}: page ${startPage} failed ${err instanceof Error ? err.message : String(err)}`);
    }
    state.nextPages = state.nextPages || {};
    if (currentUrlsLength === 0) {
      state.nextPages[key] = 1;
    } else {
      state.nextPages[key] = lastAttemptedPage >= 300 ? 1 : lastAttemptedPage + 1;
    }
    if (originalIndex >= 0) lastCategoryIndex = originalIndex;
    processedCategories += 1;
  }

  if (browser) {
    await browser.close();
  }

  if (!args.has("--dry-run") && discovered.length) {
    const lines = discovered.map((lead) => headers.map((header) => csvEscape(lead[header] ?? "")).join(","));
    const prefix = trackerRaw.endsWith("\n") ? "" : "\n";
    await fs.appendFile(TRACKER_PATH, `${prefix}${lines.join("\n")}\n`, "utf8");
  }

  if (!args.has("--dry-run")) {
    state.lastRunAt = new Date().toISOString();
    state.nextCategoryIndex = processedCategories
      ? (lastCategoryIndex + 1) % CATEGORIES.length
      : lastCategoryIndex % CATEGORIES.length;
    await fs.writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  const report = [
    "# Email Prospect Discovery Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: Puppeteer + DNS MX Validation (High Quality)`,
    `Source queue: ${CATEGORIES.length} category/city sources, next index ${state.nextCategoryIndex ?? 0}`,
    `Scanned: ${scanned.join("; ")}`,
    `Explored pages: ${exploredPages.join(", ") || "-"}`,
    `Inspected company pages: ${inspected}`,
    `New email leads: ${discovered.filter((lead) => lead.public_contact.includes("@")).length}`,
    `New leads appended: ${discovered.length}`,
    "",
    "## New Leads",
    ...(discovered.length
      ? discovered.map((lead, index) => `${index + 1}. ${lead.company_or_person} | ${lead.niche} | ${lead.public_contact} | ${lead.website} | ${lead.offer}`)
      : ["No email-ready prospects found in this cycle."]),
    "",
    "## Safety",
    "Puppeteer browsing was used. Dead domains were filtered using MX validation.",
  ].join("\n");

  await fs.writeFile(REPORT_PATH, report, "utf8");
  console.log("PROSPECT_DISCOVERY=PASS");
  console.log(`NEW_LEADS=${discovered.length}`);
  console.log(`REPORT=${REPORT_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) discover().catch((err) => {
  if (browser) browser.close();
  console.error("PROSPECT_DISCOVERY=FAIL");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
