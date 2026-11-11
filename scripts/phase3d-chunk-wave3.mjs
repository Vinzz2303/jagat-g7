import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PHASE3C_REPORT = path.join(ROOT, "ops", "phase3c_reports", "extraction_report_wave3.json");
const CHUNK_DIR = path.join(ROOT, "ops", "phase3d_chunks");
const REPORT_DIR = path.join(ROOT, "ops", "phase3d_reports");
const CHUNKS_JSON = path.join(CHUNK_DIR, "wave3_chunks.json");
const CHUNKS_JSONL = path.join(CHUNK_DIR, "wave3_chunks.jsonl");
const REPORT_JSON = path.join(REPORT_DIR, "chunk_report_wave3.json");
const REPORT_MD = path.join(REPORT_DIR, "CHUNK_REPORT_WAVE3.md");

const TARGET_CHARS = 1400;
const MAX_CHARS = 2200;
const OVERLAP_CHARS = 180;
const MIN_CHARS = 160;

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { metadata: {}, body: text.trim() };

  const metadata = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    metadata[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { metadata, body: text.slice(match[0].length).trim() };
}

function normalizeChunkText(raw) {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text) {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

function isBoundary(line) {
  const trimmed = line.trim();
  const isMarkdownHeading = /^#{1,3}\s+\S/.test(trimmed);
  return (
    isMarkdownHeading ||
    /^\d+(\.\d+)*\.\s+[A-Z0-9].{4,}/.test(trimmed) ||
    /^\|\s*(ID|R-|D-|T-|P-|G7-|L\d|Model|Gap|Level)/.test(trimmed)
  );
}

function splitIntoSections(body) {
  const lines = body.split("\n");
  const sections = [];
  let current = [];
  let currentTitle = "Dokumen";

  for (const line of lines) {
    if (isBoundary(line) && current.length > 0) {
      sections.push({ title: currentTitle, text: normalizeChunkText(current.join("\n")) });
      current = [];
      currentTitle = line.trim().replace(/^#+\s*/, "");
    } else if (isBoundary(line)) {
      currentTitle = line.trim().replace(/^#+\s*/, "");
    }
    current.push(line);
  }

  if (current.length > 0) {
    sections.push({ title: currentTitle, text: normalizeChunkText(current.join("\n")) });
  }

  return sections.filter((section) => section.text.length > 0);
}

function splitLongText(text) {
  if (text.length <= MAX_CHARS) return [text];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 2) <= TARGET_CHARS) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    const overlap = current.slice(Math.max(0, current.length - OVERLAP_CHARS));
    current = `${overlap}\n\n${paragraph}`.trim();
  }

  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= MAX_CHARS) return [chunk];

    const pieces = [];
    for (let i = 0; i < chunk.length; i += TARGET_CHARS - OVERLAP_CHARS) {
      pieces.push(chunk.slice(i, i + TARGET_CHARS).trim());
    }
    return pieces.filter(Boolean);
  });
}

function mergeTinyChunks(chunks) {
  const merged = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const next = chunks[i + 1];

    if (
      chunk.text.length < MIN_CHARS &&
      next &&
      chunk.text.length + next.text.length + 2 <= MAX_CHARS
    ) {
      merged.push({
        section_title: `${chunk.section_title} / ${next.section_title}`,
        text: normalizeChunkText(`${chunk.text}\n\n${next.text}`),
      });
      i += 1;
      continue;
    }

    if (
      merged.length > 0 &&
      chunk.text.length < MIN_CHARS &&
      merged[merged.length - 1].text.length + chunk.text.length + 2 <= MAX_CHARS
    ) {
      const previous = merged[merged.length - 1];
      previous.text = normalizeChunkText(`${previous.text}\n\n${chunk.text}`);
      previous.section_title = `${previous.section_title} / ${chunk.section_title}`;
      continue;
    }

    merged.push({ ...chunk });
  }

  return merged;
}

function chunkId(source, index, text) {
  const hash = createHash("sha1").update(`${source}:${index}:${text}`).digest("hex").slice(0, 10);
  return `${source}::chunk-${String(index + 1).padStart(4, "0")}::${hash}`;
}

async function chunkDocument(result) {
  const absolutePath = path.join(ROOT, result.normalized_path);
  const normalizedText = await readFile(absolutePath, "utf8");
  const { metadata, body } = parseFrontMatter(normalizedText);
  const sections = splitIntoSections(body);
  const rawChunks = [];

  for (const section of sections) {
    for (const part of splitLongText(section.text)) {
      rawChunks.push({
        section_title: section.title,
        text: normalizeChunkText(part),
      });
    }
  }

  const merged = mergeTinyChunks(rawChunks).filter((chunk) => wordCount(chunk.text) >= 12);

  return merged.map((chunk, index) => {
    const id = chunkId(metadata.source ?? result.source, index, chunk.text);
    return {
      chunk_id: id,
      document_id: metadata.id ?? result.id,
      chunk_index: index,
      chunk_total: merged.length,
      title: metadata.title ?? result.title,
      source: metadata.source ?? result.source,
      category: metadata.category ?? result.category,
      doc_type: metadata.doc_type ?? result.doc_type,
      owner: metadata.owner,
      created_at: metadata.created_at,
      trust_level: metadata.trust_level,
      provenance: metadata.provenance,
      sha256: metadata.sha256,
      section_title: chunk.section_title,
      char_count: chunk.text.length,
      word_count: wordCount(chunk.text),
      content: chunk.text,
    };
  });
}

function reportMarkdown(report) {
  const docRows = report.documents.map((doc) => (
    `| ${doc.id} | ${doc.title} | ${doc.chunk_count} | ${doc.min_chars} | ${doc.max_chars} | ${doc.avg_chars} |`
  ));

  return [
    "# JAGAT G7 Phase 3D - Chunk Report Wave 3",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Summary",
    "",
    `- Documents processed: ${report.documents.length}`,
    `- Total chunks: ${report.total_chunks}`,
    `- Target chars: ${TARGET_CHARS}`,
    `- Max chars: ${MAX_CHARS}`,
    `- Overlap chars: ${OVERLAP_CHARS}`,
    `- Qdrant ingest performed: no`,
    "",
    "## Document Results",
    "",
    "| ID | Title | Chunks | Min Chars | Max Chars | Avg Chars |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...docRows,
    "",
    "## Policy",
    "",
    "- Chunking follows headings and section markers.",
    "- Chunks carry parent metadata and provenance.",
    "- These chunks feed Phase 3E embedding massal.",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(CHUNK_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const phase3cReport = JSON.parse(await readFile(PHASE3C_REPORT, "utf8"));
  const normalizedDocs = phase3cReport.results.filter((result) => result.status === "normalized");

  const allChunks = [];
  const documents = [];

  for (const doc of normalizedDocs) {
    console.log(`[Phase 3D-W3] Chunking ${doc.id}: ${doc.title}`);
    const chunks = await chunkDocument(doc);
    allChunks.push(...chunks);
    const charCounts = chunks.map((chunk) => chunk.char_count);
    documents.push({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      chunk_count: chunks.length,
      min_chars: Math.min(...charCounts),
      max_chars: Math.max(...charCounts),
      avg_chars: Math.round(charCounts.reduce((sum, count) => sum + count, 0) / Math.max(1, charCounts.length)),
    });
  }

  const report = {
    phase: "3D",
    wave: 3,
    generated_at: new Date().toISOString(),
    source_report: path.relative(ROOT, PHASE3C_REPORT),
    policy: {
      target_chars: TARGET_CHARS,
      max_chars: MAX_CHARS,
      overlap_chars: OVERLAP_CHARS,
      ingest_performed: false,
      next_phase: "3E",
    },
    total_chunks: allChunks.length,
    documents,
  };

  await writeFile(CHUNKS_JSON, JSON.stringify(allChunks, null, 2), "utf8");
  await writeFile(CHUNKS_JSONL, allChunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n", "utf8");
  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  await writeFile(REPORT_MD, reportMarkdown(report), "utf8");

  console.log(`[Phase 3D-W3] Chunks: ${path.relative(ROOT, CHUNKS_JSON)}`);
  console.log(`[Phase 3D-W3] Report: ${path.relative(ROOT, REPORT_MD)}`);
  console.log(`[Phase 3D-W3] Completed ${allChunks.length} chunk(s).`);
}

main().catch((error) => {
  console.error("[Phase 3D-W3] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
