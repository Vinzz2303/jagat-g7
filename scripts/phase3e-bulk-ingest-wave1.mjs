import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHUNKS_PATH = path.join(ROOT, "ops", "phase3d_chunks", "wave1_chunks.json");
const REPORT_DIR = path.join(ROOT, "ops", "phase3e_reports");

const QDRANT_HOST = (process.env.QDRANT_HOST ?? "http://127.0.0.1:6333").replace(/\/+$/, "");
const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
const COLLECTION_NAME = process.env.JAGAT_KNOWLEDGE_COLLECTION ?? "jagat_indonesia_knowledge";
const EMBEDDING_MODEL = process.env.JAGAT_EMBEDDING_MODEL ?? "nomic-embed-text";
const EMBEDDING_DIM = Number.parseInt(process.env.JAGAT_EMBEDDING_DIM ?? "768", 10);
const BATCH_SIZE = Number.parseInt(process.env.JAGAT_BULK_INGEST_BATCH_SIZE ?? "25", 10);

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const reportStem = dryRun ? "dry_run_report_wave1" : force ? "force_ingest_report_wave1" : "bulk_ingest_report_wave1";
const REPORT_JSON = path.join(REPORT_DIR, `${reportStem}.json`);
const REPORT_MD = path.join(REPORT_DIR, `${reportStem.toUpperCase()}.md`);

function stableUuid(input) {
  const hex = createHash("sha1").update(input).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assertChunkShape(chunk) {
  const required = [
    "chunk_id",
    "document_id",
    "chunk_index",
    "chunk_total",
    "title",
    "source",
    "category",
    "doc_type",
    "owner",
    "created_at",
    "trust_level",
    "provenance",
    "section_title",
    "content",
  ];

  for (const key of required) {
    if (chunk[key] === undefined || chunk[key] === null || String(chunk[key]).trim() === "") {
      throw new Error(`Chunk ${chunk.chunk_id ?? "(unknown)"} missing required field: ${key}`);
    }
  }

  if (typeof chunk.content !== "string" || chunk.content.trim().length < 1) {
    throw new Error(`Chunk ${chunk.chunk_id} has empty content.`);
  }
}

async function qdrantRequest(method, endpoint, body) {
  const response = await fetch(`${QDRANT_HOST}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const detail = data?.status?.error ?? data?.message ?? response.statusText;
    throw new Error(`[Phase 3E] Qdrant ${method} ${endpoint} failed (${response.status}): ${detail}`);
  }

  return data;
}

async function ensureCollection() {
  try {
    await qdrantRequest("GET", `/collections/${COLLECTION_NAME}`);
    return "existing";
  } catch {
    await qdrantRequest("PUT", `/collections/${COLLECTION_NAME}`, {
      vectors: {
        size: EMBEDDING_DIM,
        distance: "Cosine",
      },
    });
    return "created";
  }
}

async function retrieveExistingIds(ids) {
  if (ids.length === 0) return new Set();

  const data = await qdrantRequest("POST", `/collections/${COLLECTION_NAME}/points`, {
    ids,
    with_payload: false,
    with_vector: false,
  });

  return new Set((data.result ?? []).map((point) => String(point.id)));
}

async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`[Phase 3E] Ollama embedding failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.embedding) || data.embedding.length !== EMBEDDING_DIM) {
    throw new Error(`[Phase 3E] Invalid embedding dimension: expected ${EMBEDDING_DIM}, got ${data.embedding?.length ?? 0}`);
  }

  return data.embedding;
}

async function upsertPoints(points) {
  if (points.length === 0) return;

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await qdrantRequest("PUT", `/collections/${COLLECTION_NAME}/points`, { points: batch });
    console.log(`[Phase 3E] Upsert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} point(s).`);
  }
}

function buildPoint(chunk, vector) {
  const pointId = stableUuid(`phase3e:${chunk.chunk_id}`);
  const hash = contentHash(chunk.content);

  return {
    id: pointId,
    vector,
    payload: {
      ...chunk,
      content_hash: hash,
      embedding_model: EMBEDDING_MODEL,
      embedded_at: new Date().toISOString(),
      ingestion_phase: "3E",
      point_id: pointId,
    },
  };
}

function summarizeDocuments(chunks) {
  const docs = new Map();

  for (const chunk of chunks) {
    const current = docs.get(chunk.document_id) ?? {
      document_id: chunk.document_id,
      title: chunk.title,
      source: chunk.source,
      category: chunk.category,
      doc_type: chunk.doc_type,
      chunks: 0,
    };
    current.chunks += 1;
    docs.set(chunk.document_id, current);
  }

  return [...docs.values()];
}

function markdownReport(report) {
  const docRows = report.documents.map((doc) => (
    `| ${doc.document_id} | ${doc.title} | ${doc.source} | ${doc.chunks} |`
  ));

  return [
    "# JAGAT G7 Phase 3E - Bulk Ingest Report Wave 1",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Summary",
    "",
    `- Mode: ${report.mode}`,
    `- Collection: ${report.collection}`,
    `- Embedding model: ${report.embedding_model}`,
    `- Chunks total: ${report.chunks_total}`,
    `- Existing points before run: ${report.existing_points_before}`,
    `- Points embedded: ${report.points_embedded}`,
    `- Points upserted: ${report.points_upserted}`,
    `- Points skipped: ${report.points_skipped}`,
    `- Failures: ${report.failures.length}`,
    "",
    "## Documents",
    "",
    "| Document ID | Title | Source | Chunks |",
    "| --- | --- | --- | ---: |",
    ...docRows,
    "",
    "## Policy",
    "",
    "- Point IDs are deterministic from `chunk_id`, so reruns are idempotent.",
    "- `--dry-run` validates chunks and duplicate state without embedding or upsert.",
    "- Default run skips existing point IDs; `--force` re-embeds and upserts all chunks.",
    "- Every Qdrant payload carries parent metadata, provenance, chunk index, content hash, and embedding model.",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });

  const chunks = JSON.parse(await readFile(CHUNKS_PATH, "utf8"));
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("[Phase 3E] No chunks found. Run `npm run phase3d:chunk` first.");
  }

  chunks.forEach(assertChunkShape);

  console.log(`[Phase 3E] Mode: ${dryRun ? "dry-run" : force ? "force-ingest" : "ingest"}`);
  console.log(`[Phase 3E] Loaded ${chunks.length} chunk(s) from ${path.relative(ROOT, CHUNKS_PATH)}.`);

  const collectionState = await ensureCollection();
  console.log(`[Phase 3E] Qdrant collection "${COLLECTION_NAME}" ${collectionState}.`);

  const pointIds = chunks.map((chunk) => stableUuid(`phase3e:${chunk.chunk_id}`));
  const existingIds = await retrieveExistingIds(pointIds);
  const candidates = chunks.filter((chunk, index) => force || !existingIds.has(pointIds[index]));
  const skipped = chunks.length - candidates.length;

  const report = {
    phase: "3E",
    generated_at: new Date().toISOString(),
    mode: dryRun ? "dry-run" : force ? "force-ingest" : "ingest",
    collection: COLLECTION_NAME,
    collection_state: collectionState,
    embedding_model: EMBEDDING_MODEL,
    embedding_dim: EMBEDDING_DIM,
    source_chunks: path.relative(ROOT, CHUNKS_PATH),
    chunks_total: chunks.length,
    existing_points_before: existingIds.size,
    points_embedded: 0,
    points_upserted: 0,
    points_skipped: skipped,
    failures: [],
    documents: summarizeDocuments(chunks),
  };

  if (dryRun) {
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
    await writeFile(REPORT_MD, markdownReport(report), "utf8");
    console.log(`[Phase 3E] Dry-run complete. Existing=${existingIds.size}, candidates=${candidates.length}, skipped=${skipped}.`);
    return;
  }

  const points = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const chunk = candidates[i];
    const ordinal = `${i + 1}/${candidates.length}`;

    try {
      console.log(`[Phase 3E] Embedding ${ordinal}: ${chunk.chunk_id}`);
      const vector = await generateEmbedding(chunk.content);
      points.push(buildPoint(chunk, vector));
      report.points_embedded += 1;
    } catch (error) {
      report.failures.push({
        chunk_id: chunk.chunk_id,
        source: chunk.source,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`[Phase 3E] Failed ${chunk.chunk_id}: ${report.failures.at(-1).message}`);
    }
  }

  await upsertPoints(points);
  report.points_upserted = points.length;

  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  await writeFile(REPORT_MD, markdownReport(report), "utf8");

  if (report.failures.length > 0) {
    throw new Error(`[Phase 3E] Completed with ${report.failures.length} failure(s). See ${path.relative(ROOT, REPORT_JSON)}.`);
  }

  console.log(`[Phase 3E] Completed. Embedded=${report.points_embedded}, upserted=${report.points_upserted}, skipped=${report.points_skipped}.`);
  console.log(`[Phase 3E] Report: ${path.relative(ROOT, REPORT_MD)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
