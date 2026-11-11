import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ChunkRecord {
  document_id: string;
  title: string;
  source: string;
  category: string;
  doc_type: string;
  owner: string;
  created_at: string;
  trust_level: string;
  provenance: string;
  sha256: string;
  chunk_id: string;
  chunk_index: number;
  chunk_total: number;
  section_title?: string;
  char_count: number;
  word_count: number;
  content: string;
}

interface MemoryDocument {
  documentId: string;
  title: string;
  source: string;
  category: string;
  docType: string;
  owner: string;
  createdAt: string;
  trustLevel: string;
  provenance: string;
  sha256: string;
  wave: string;
  chunkCount: number;
  totalChars: number;
  totalWords: number;
  firstSection: string;
  lastSection: string;
  sample: string;
}

export async function GET() {
  try {
    const root = getWorkspaceRoot();
    const [wave1, wave2, wave3] = await Promise.all([
      readChunkWave(path.join(root, "ops", "phase3d_chunks", "wave1_chunks.json"), "Wave 1"),
      readChunkWave(path.join(root, "ops", "phase3d_chunks", "wave2_chunks.json"), "Wave 2"),
      readWave3Markdown(path.join(root, "ops", "wave3")),
    ]);

    const documents = [...wave1, ...wave2, ...wave3].sort((a, b) => {
      if (a.wave !== b.wave) return a.wave.localeCompare(b.wave);
      return a.title.localeCompare(b.title);
    });

    const stats = {
      documents: documents.length,
      chunks: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
      words: documents.reduce((sum, doc) => sum + doc.totalWords, 0),
      categories: countBy(documents, "category"),
      trustLevels: countBy(documents, "trustLevel"),
      waves: countBy(documents, "wave"),
    };

    return NextResponse.json({ success: true, generatedAt: new Date().toISOString(), stats, documents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown memory library error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function getWorkspaceRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd).toLowerCase() === "jagat-ui" ? path.resolve(cwd, "..") : cwd;
}

async function readChunkWave(filePath: string, wave: string): Promise<MemoryDocument[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const chunks = JSON.parse(raw) as ChunkRecord[];
  const grouped = new Map<string, ChunkRecord[]>();

  for (const chunk of chunks) {
    const current = grouped.get(chunk.document_id) ?? [];
    current.push(chunk);
    grouped.set(chunk.document_id, current);
  }

  return [...grouped.entries()].map(([documentId, records]) => {
    const ordered = records.sort((a, b) => a.chunk_index - b.chunk_index);
    const first = ordered[0]!;
    const last = ordered.at(-1)!;
    const totalChars = ordered.reduce((sum, chunk) => sum + (chunk.char_count ?? chunk.content.length), 0);
    const totalWords = ordered.reduce((sum, chunk) => sum + (chunk.word_count ?? countWords(chunk.content)), 0);

    return {
      documentId,
      title: first.title,
      source: first.source,
      category: first.category,
      docType: first.doc_type,
      owner: first.owner,
      createdAt: first.created_at,
      trustLevel: first.trust_level,
      provenance: first.provenance,
      sha256: first.sha256,
      wave,
      chunkCount: ordered.length,
      totalChars,
      totalWords,
      firstSection: first.section_title ?? "Dokumen",
      lastSection: last.section_title ?? "Dokumen",
      sample: compactSample(first.content),
    };
  });
}

async function readWave3Markdown(dirPath: string): Promise<MemoryDocument[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const docs: MemoryDocument[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(dirPath, entry.name);
    const content = await fs.readFile(filePath, "utf8");
    const title = extractTitle(content) ?? entry.name.replace(/\.md$/i, "").replace(/_/g, " ");
    const hash = crypto.createHash("sha256").update(content).digest("hex").toUpperCase();

    docs.push({
      documentId: `WAVE3-${entry.name.replace(/\.md$/i, "")}`,
      title,
      source: entry.name,
      category: "founder_policy",
      docType: "markdown",
      owner: "Faturachman Al Kahfi",
      createdAt: "2026-05-30",
      trustLevel: "founder_draft",
      provenance: "ops/wave3 local founder policy",
      sha256: hash,
      wave: "Wave 3",
      chunkCount: 1,
      totalChars: content.length,
      totalWords: countWords(content),
      firstSection: title,
      lastSection: title,
      sample: compactSample(content),
    });
  }

  return docs;
}

function countBy<T, K extends keyof T>(items: T[], key: K): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function compactSample(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 360);
}
