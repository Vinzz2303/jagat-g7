import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "ops", "phase3_wave2_manifest.json");
const NORMALIZED_DIR = path.join(ROOT, "ops", "phase3c_normalized");
const REPORT_DIR = path.join(ROOT, "ops", "phase3c_reports");
const REPORT_JSON = path.join(REPORT_DIR, "extraction_report_wave2.json");
const REPORT_MD = path.join(REPORT_DIR, "EXTRACTION_REPORT_WAVE2.md");

function normalizeText(raw) {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text) {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function frontMatter(doc) {
  const lines = [
    "---",
    `id: ${doc.id}`,
    `title: ${doc.title}`,
    `source: ${doc.source}`,
    `category: ${doc.category}`,
    `doc_type: ${doc.doc_type}`,
    `owner: ${doc.owner}`,
    `created_at: ${doc.created_at}`,
    `trust_level: ${doc.trust_level}`,
    `provenance: ${doc.provenance}`,
    `sha256: ${doc.sha256}`,
    doc.notes ? `notes: ${doc.notes}` : undefined,
    "---",
  ].filter(Boolean).join("\n");
  return `${lines}\n\n`;
}

async function extractDocument(doc) {
  const filePath = doc.local_path;
  const actualHash = await sha256(filePath);
  const hashMatch = actualHash === doc.sha256;
  if (!hashMatch) {
    throw new Error(`SHA256 mismatch for ${doc.id}. Expected ${doc.sha256}, got ${actualHash}.`);
  }

  const rawContent = await readFile(filePath, "utf8");
  const text = normalizeText(rawContent);

  const normalizedPath = path.join(NORMALIZED_DIR, `${doc.id}_${doc.source}.txt`);
  const sidecarPath = path.join(NORMALIZED_DIR, `${doc.id}_${doc.source}.metadata.json`);
  const normalizedContent = `${frontMatter(doc)}${text}\n`;
  const status = text.length > 0 ? "normalized" : "empty";

  await writeFile(normalizedPath, normalizedContent, "utf8");
  await writeFile(sidecarPath, JSON.stringify({
    ...doc,
    extraction: { status, doc_type: doc.doc_type }
  }, null, 2), "utf8");

  return {
    id: doc.id,
    title: doc.title,
    source: doc.source,
    category: doc.category,
    doc_type: doc.doc_type,
    status,
    local_path: filePath,
    normalized_path: path.relative(ROOT, normalizedPath),
    metadata_path: path.relative(ROOT, sidecarPath),
    sha256_match: hashMatch,
    char_count: text.length,
    word_count: wordCount(text),
    ocr_used: false,
  };
}

function renderMarkdownReport(manifest, results) {
  const rows = results.map((r) => (
    `| ${r.id} | ${r.title} | ${r.status} | ${r.doc_type} | ${r.char_count} | ${r.word_count} | ${r.sha256_match ? "yes" : "no"} |`
  ));

  return [
    "# JAGAT G7 Phase 3C - Extraction Report Wave 2",
    "",
    `Manifest: \`${manifest.manifest_id}\``,
    "",
    "## Summary",
    "",
    `- Documents processed: ${results.length}`,
    `- Normalized: ${results.filter((r) => r.status === "normalized").length}`,
    `- Empty: ${results.filter((r) => r.status === "empty").length}`,
    `- Output directory: \`ops/phase3c_normalized\``,
    "",
    "## Results",
    "",
    "| ID | Title | Status | Type | Chars | Words | SHA256 Match |",
    "| --- | --- | --- | --- | ---: | ---: | --- |",
    ...rows,
    "",
    "## Policy",
    "",
    "- Phase 3C only extracts and normalizes.",
    "- No Qdrant ingest is performed.",
    "- These artifacts feed Phase 3D semantic chunking.",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(NORMALIZED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const results = [];

  for (const doc of manifest.documents) {
    console.log(`[Phase 3C-W2] Normalizing ${doc.id}: ${doc.title}`);
    results.push(await extractDocument(doc));
  }

  const report = {
    phase: "3C",
    wave: 2,
    manifest_id: manifest.manifest_id,
    generated_at: new Date().toISOString(),
    policy: {
      ingest_performed: false,
      next_phase: "3D",
    },
    results,
  };

  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  await writeFile(REPORT_MD, renderMarkdownReport(manifest, results), "utf8");

  console.log(`[Phase 3C-W2] Report: ${path.relative(ROOT, REPORT_JSON)}`);
  console.log(`[Phase 3C-W2] Markdown: ${path.relative(ROOT, REPORT_MD)}`);
  console.log(`[Phase 3C-W2] Completed ${results.length} document(s).`);
}

main().catch((error) => {
  console.error("[Phase 3C-W2] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
