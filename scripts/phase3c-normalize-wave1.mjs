import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import readExcelFile from "read-excel-file/node";
import { createWorker } from "tesseract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "ops", "phase3_wave1_manifest.json");
const NORMALIZED_DIR = path.join(ROOT, "ops", "phase3c_normalized");
const REPORT_DIR = path.join(ROOT, "ops", "phase3c_reports");
const REPORT_JSON = path.join(REPORT_DIR, "extraction_report_wave1.json");
const REPORT_MD = path.join(REPORT_DIR, "EXTRACTION_REPORT_WAVE1.md");

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

async function extractPdf(filePath) {
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pageCount = result.total ?? result.pages?.length ?? null;
    let text = normalizeText(result.text);
    const textExtractionChars = text.length;

    if (typeof pageCount === "number" && pageCount > 0 && text.length / pageCount < 100) {
      console.log(`[Phase 3C] Low embedded text detected (${text.length} chars / ${pageCount} pages). Running OCR...`);
      const screenshots = await parser.getScreenshot({ scale: 1.2 });
      const worker = await createWorker("eng");
      const pageTexts = [];
      try {
        for (let i = 0; i < screenshots.pages.length; i += 1) {
          const page = screenshots.pages[i];
          const recognized = await worker.recognize(page.data);
          pageTexts.push(`## OCR Page ${i + 1}\n\n${recognized.data.text}`);
          console.log(`[Phase 3C] OCR page ${i + 1}/${screenshots.pages.length} complete.`);
        }
      } finally {
        await worker.terminate();
      }
      text = normalizeText(pageTexts.join("\n\n"));
    }

    return {
      text,
      stats: {
        page_count: pageCount,
        text_extraction_chars: textExtractionChars,
        ocr_used: text.length > textExtractionChars && textExtractionChars < 500,
      },
    };
  } finally {
    await parser.destroy();
  }
}

function cellToText(cell) {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object" && "text" in cell) return String(cell.text ?? "").trim();
  if (typeof cell === "object" && "result" in cell) return String(cell.result ?? "").trim();
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function sheetToText(sheetName, data) {
  const lines = data
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return cells
      .map(cellToText)
      .filter(Boolean)
      .join(" | ");
    })
    .filter(Boolean);

  return [`## Sheet: ${sheetName}`, "", ...lines].join("\n");
}

async function extractXlsx(filePath) {
  const sheets = await readExcelFile(filePath);
  const sections = sheets
    .map((sheet) => sheetToText(sheet.name ?? sheet.sheet, sheet.data ?? []))
    .filter((section) => section.trim().length > 0);

  return {
    text: normalizeText(sections.join("\n\n")),
    stats: {
      sheet_count: sheets.length,
      sheets: sheets.map((sheet) => sheet.name ?? sheet.sheet),
    },
  };
}

async function extractDocument(doc) {
  const filePath = doc.local_path;
  const actualHash = await sha256(filePath);
  const hashMatch = actualHash === doc.sha256;
  if (!hashMatch) {
    throw new Error(`SHA256 mismatch for ${doc.id}. Expected ${doc.sha256}, got ${actualHash}.`);
  }

  const extracted =
    doc.doc_type === "pdf"
      ? await extractPdf(filePath)
      : doc.doc_type === "xlsx"
        ? await extractXlsx(filePath)
        : { text: normalizeText(await readFile(filePath, "utf8")), stats: {} };

  const normalizedPath = path.join(NORMALIZED_DIR, `${doc.id}_${doc.source}.txt`);
  const sidecarPath = path.join(NORMALIZED_DIR, `${doc.id}_${doc.source}.metadata.json`);
  const normalizedContent = `${frontMatter(doc)}${extracted.text}\n`;
  const charsPerPage =
    typeof extracted.stats.page_count === "number" && extracted.stats.page_count > 0
      ? Math.round(extracted.text.length / extracted.stats.page_count)
      : null;
  const status =
    doc.doc_type === "pdf" && (extracted.text.length < 500 || (charsPerPage !== null && charsPerPage < 100))
      ? "needs_ocr"
      : extracted.text.length > 0
        ? "normalized"
        : "empty";

  await writeFile(normalizedPath, normalizedContent, "utf8");
  await writeFile(sidecarPath, JSON.stringify({ ...doc, extraction: { ...extracted.stats, chars_per_page: charsPerPage, status } }, null, 2), "utf8");

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
    char_count: extracted.text.length,
    word_count: wordCount(extracted.text),
    chars_per_page: charsPerPage,
    ...extracted.stats,
  };
}

function renderMarkdownReport(manifest, results) {
  const rows = results.map((r) => (
    `| ${r.id} | ${r.title} | ${r.status} | ${r.doc_type} | ${r.char_count} | ${r.word_count} | ${r.ocr_used ? "yes" : "no"} | ${r.sha256_match ? "yes" : "no"} |`
  ));

  return [
    "# JAGAT G7 Phase 3C - Extraction Report Wave 1",
    "",
    `Manifest: \`${manifest.manifest_id}\``,
    "",
    "## Summary",
    "",
    `- Documents processed: ${results.length}`,
    `- Normalized: ${results.filter((r) => r.status === "normalized").length}`,
    `- Needs OCR: ${results.filter((r) => r.status === "needs_ocr").length}`,
    `- Empty: ${results.filter((r) => r.status === "empty").length}`,
    `- Output directory: \`ops/phase3c_normalized\``,
    "",
    "## Results",
    "",
    "| ID | Title | Status | Type | Chars | Words | OCR | SHA256 Match |",
    "| --- | --- | --- | --- | ---: | ---: | --- | --- |",
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
    console.log(`[Phase 3C] Normalizing ${doc.id}: ${doc.title}`);
    results.push(await extractDocument(doc));
  }

  const report = {
    phase: "3C",
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

  console.log(`[Phase 3C] Report: ${path.relative(ROOT, REPORT_JSON)}`);
  console.log(`[Phase 3C] Markdown: ${path.relative(ROOT, REPORT_MD)}`);
  console.log(`[Phase 3C] Completed ${results.length} document(s).`);
}

main().catch((error) => {
  console.error("[Phase 3C] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
