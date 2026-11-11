export const INGEST_CATEGORIES = [
  "blueprint",
  "roadmap",
  "milestone",
  "infrastructure",
  "product",
  "risk",
  "decision",
  "commercial",
  "regulation",
  "founder_note",
] as const;

export const INGEST_DOC_TYPES = ["pdf", "xlsx", "md", "txt", "note"] as const;

export const INGEST_TRUST_LEVELS = [
  "founder_verified",
  "core_team_verified",
  "internal_draft",
  "external_reference",
] as const;

export type IngestCategory = (typeof INGEST_CATEGORIES)[number];
export type IngestDocType = (typeof INGEST_DOC_TYPES)[number];
export type IngestTrustLevel = (typeof INGEST_TRUST_LEVELS)[number];

export interface IngestionMetadata {
  title: string;
  source: string;
  category: IngestCategory;
  doc_type: IngestDocType;
  owner: string;
  created_at: string;
  trust_level: IngestTrustLevel;
  provenance: string;
  notes?: string;
}

export interface FormalIngestRequest {
  content: string;
  metadata: IngestionMetadata;
}

export interface ValidationResult {
  ok: boolean;
  value?: FormalIngestRequest;
  message?: string;
}

const REQUIRED_METADATA_FIELDS: Array<keyof Omit<IngestionMetadata, "notes">> = [
  "title",
  "source",
  "category",
  "doc_type",
  "owner",
  "created_at",
  "trust_level",
  "provenance",
];

const FORBIDDEN_KNOWLEDGE_PATTERNS = [
  /feedback[-\s]?loop/i,
  /\bDIREKTIF RISET\b/i,
  /\bThreshold Kemiripan\b/i,
  /\bSYSTEM_PROMPT\b/i,
  /\bOPERATIONAL DIRECTIVES\b/i,
  /\bJAGAT:STREAM\b/i,
  /\bJAGAT:RESEARCH\b/i,
  /\bModel lokal sedang menghasilkan analisis\b/i,
  /\bMenyiapkan pipeline riset\b/i,
  /\boutput model\b/i,
  /\bdebug transcript\b/i,
  /\bprompt leak\b/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export function hasForbiddenKnowledgeMarkers(...values: string[]): boolean {
  const combined = values.join("\n");
  return FORBIDDEN_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(combined));
}

export function validateFormalIngestRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, message: "Request body harus berupa object JSON." };
  }

  if (!isNonEmptyString(body.content)) {
    return { ok: false, message: 'Field "content" wajib diisi sebagai string non-empty.' };
  }

  if (!isRecord(body.metadata)) {
    return {
      ok: false,
      message: 'Field "metadata" wajib diisi. Legacy ingest content/source/category sudah tidak diterima pada Phase 3A.',
    };
  }

  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!isNonEmptyString(body.metadata[field])) {
      return { ok: false, message: `Metadata "${field}" wajib diisi sebagai string non-empty.` };
    }
  }

  const category = trimString(body.metadata.category);
  if (!INGEST_CATEGORIES.includes(category as IngestCategory)) {
    return { ok: false, message: `Metadata "category" tidak valid. Gunakan salah satu: ${INGEST_CATEGORIES.join(", ")}.` };
  }

  const docType = trimString(body.metadata.doc_type);
  if (!INGEST_DOC_TYPES.includes(docType as IngestDocType)) {
    return { ok: false, message: `Metadata "doc_type" tidak valid. Gunakan salah satu: ${INGEST_DOC_TYPES.join(", ")}.` };
  }

  const trustLevel = trimString(body.metadata.trust_level);
  if (!INGEST_TRUST_LEVELS.includes(trustLevel as IngestTrustLevel)) {
    return { ok: false, message: `Metadata "trust_level" tidak valid. Gunakan salah satu: ${INGEST_TRUST_LEVELS.join(", ")}.` };
  }

  const createdAt = trimString(body.metadata.created_at)!;
  if (!isDateOnly(createdAt)) {
    return { ok: false, message: 'Metadata "created_at" wajib format YYYY-MM-DD yang valid.' };
  }

  const notes = trimString(body.metadata.notes);
  const metadata: IngestionMetadata = {
    title: trimString(body.metadata.title)!,
    source: trimString(body.metadata.source)!,
    category: category as IngestCategory,
    doc_type: docType as IngestDocType,
    owner: trimString(body.metadata.owner)!,
    created_at: createdAt,
    trust_level: trustLevel as IngestTrustLevel,
    provenance: trimString(body.metadata.provenance)!,
    ...(notes ? { notes } : {}),
  };

  const content = body.content.trim();
  if (hasForbiddenKnowledgeMarkers(content, ...Object.values(metadata).filter((v): v is string => typeof v === "string"))) {
    return {
      ok: false,
      message: "Dokumen terdeteksi sebagai feedback-loop, prompt/debug transcript, atau output model. Tidak boleh masuk ke memori berdaulat.",
    };
  }

  return { ok: true, value: { content, metadata } };
}
