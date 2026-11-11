// ============================================================================
// JAGAT G7 - Manual Commercial Request Ledger
// Server-only helper for early revenue intake. This is not a payment gateway and
// does not store payment credentials, card data, raw prompts, or passwords.
// ============================================================================

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type CommercialPackageId =
  | "PRO"
  | "ULTRA"
  | "AI_ADMIN_BOT_UMKM"
  | "WEBSITE_CEPAT"
  | "SOVEREIGN_RESEARCH_ASSISTANT"
  | "INTERNAL_COMMAND_CENTER";

export type CommercialRequestStatus = "new" | "qualified" | "quoted" | "closed_won" | "closed_lost";
export type CommercialContactChannel = "whatsapp" | "email" | "phone" | "other";

export interface CommercialRequestInput {
  packageId: string;
  clientName: string;
  contact: string;
  channel?: string;
  notes?: string;
  source?: string;
}

export interface CommercialRequestRecord {
  id: string;
  invoiceCode: string;
  createdAt: string;
  status: CommercialRequestStatus;
  packageId: CommercialPackageId;
  packageName: string;
  quotedPrice: string;
  clientName: string;
  contact: string;
  channel: CommercialContactChannel;
  notes: string;
  source: string;
  billingMode: "manual_invoice";
  paymentStatus: "not_requested";
}

export interface CommercialInvoiceDraft {
  requestId: string;
  invoiceCode: string;
  generatedAt: string;
  dueAt: string;
  clientName: string;
  packageName: string;
  quotedPrice: string;
  billingMode: "manual_invoice";
  paymentStatus: "not_requested";
  markdown: string;
}

export const COMMERCIAL_PACKAGES: Record<
  CommercialPackageId,
  { name: string; quotedPrice: string }
> = {
  PRO: { name: "G7 PRO Node", quotedPrice: "Rp 150.000/bulan" },
  ULTRA: { name: "G7 ULTRA Node", quotedPrice: "Rp 500.000/bulan" },
  AI_ADMIN_BOT_UMKM: {
    name: "AI Admin Bot UMKM",
    quotedPrice: "Rp 500.000 - Rp 1.500.000 setup",
  },
  WEBSITE_CEPAT: {
    name: "Website Cepat + Admin Panel Ringan",
    quotedPrice: "Rp 750.000 - Rp 2.500.000 setup",
  },
  SOVEREIGN_RESEARCH_ASSISTANT: {
    name: "Sovereign Research Assistant",
    quotedPrice: "Rp 300.000 - Rp 1.000.000/project",
  },
  INTERNAL_COMMAND_CENTER: {
    name: "Internal Command Center / Colony-lite",
    quotedPrice: "Rp 1.500.000 - Rp 5.000.000 setup",
  },
};

const CREDENTIAL_MARKERS = [
  "password",
  "passwd",
  "api key",
  "apikey",
  "secret",
  "private key",
  "bearer ",
  "credential",
];

function ledgerPath(): string {
  return path.join(process.cwd(), "data", "commercial_requests.jsonl");
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizePackageId(value: unknown): CommercialPackageId | null {
  const candidate = cleanText(value, 64).toUpperCase();
  return candidate in COMMERCIAL_PACKAGES ? (candidate as CommercialPackageId) : null;
}

function normalizeChannel(value: unknown): CommercialContactChannel {
  const candidate = cleanText(value, 32).toLowerCase();
  if (candidate === "email" || candidate === "phone" || candidate === "other") return candidate;
  return "whatsapp";
}

function assertNoCredentials(record: Pick<CommercialRequestRecord, "contact" | "notes">): void {
  const text = `${record.contact} ${record.notes}`.toLowerCase();
  const marker = CREDENTIAL_MARKERS.find((item) => text.includes(item));
  if (marker) {
    throw new Error(`Do not submit credentials or secrets in commercial requests (${marker}).`);
  }
}

function formatInvoiceDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function slugClientName(value: string): string {
  const slug = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return slug || "CLIENT";
}

export async function createCommercialRequest(
  input: CommercialRequestInput,
): Promise<CommercialRequestRecord> {
  const packageId = normalizePackageId(input.packageId);
  if (!packageId) throw new Error("Paket komersial tidak valid.");

  const clientName = cleanText(input.clientName, 90);
  const contact = cleanText(input.contact, 140);
  const notes = cleanText(input.notes, 1000);

  if (clientName.length < 2) throw new Error("Nama client wajib diisi.");
  if (contact.length < 5) throw new Error("Kontak WhatsApp/email/telepon wajib diisi.");

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const packageInfo = COMMERCIAL_PACKAGES[packageId];
  const record: CommercialRequestRecord = {
    id: `REQ-${today}-${randomUUID().slice(0, 8).toUpperCase()}`,
    invoiceCode: `JAGAT-${today}-${slugClientName(clientName)}`,
    createdAt: new Date().toISOString(),
    status: "new",
    packageId,
    packageName: packageInfo.name,
    quotedPrice: packageInfo.quotedPrice,
    clientName,
    contact,
    channel: normalizeChannel(input.channel),
    notes,
    source: cleanText(input.source || "pricing_page", 80),
    billingMode: "manual_invoice",
    paymentStatus: "not_requested",
  };

  assertNoCredentials(record);

  const file = ledgerPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function listCommercialRequests(limit = 50): Promise<CommercialRequestRecord[]> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CommercialRequestRecord)
      .reverse()
      .slice(0, Math.max(1, Math.min(200, limit)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getCommercialRequestById(
  requestId: string,
): Promise<CommercialRequestRecord | null> {
  const id = cleanText(requestId, 80);
  if (!id) return null;
  const requests = await listCommercialRequests(200);
  return requests.find((request) => request.id === id) ?? null;
}

export async function generateCommercialInvoiceDraft(
  requestId: string,
  options: { dueDays?: number; dpPercent?: number } = {},
): Promise<CommercialInvoiceDraft> {
  const request = await getCommercialRequestById(requestId);
  if (!request) throw new Error(`Request ${requestId} not found.`);
  if (request.status === "new") {
    throw new Error("Qualify the commercial request before generating an invoice draft.");
  }
  if (request.status === "closed_lost") {
    throw new Error("Cannot generate an invoice draft for a closed_lost request.");
  }

  const generatedAt = new Date();
  const dueDays = clampInteger(options.dueDays, 7, 1, 30);
  const dpPercent = clampInteger(options.dpPercent, 50, 0, 100);
  const dueAt = new Date(generatedAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + dueDays);

  const dpText =
    dpPercent > 0
      ? `${dpPercent}% dari harga final jika DP disepakati; nominal akhir dikonfirmasi manual.`
      : "Tanpa DP default; mengikuti kesepakatan founder/client.";
  const safeNotes = request.notes || "Scope final dikonfirmasi manual sebelum pekerjaan dimulai.";
  const markdown = [
    `# Invoice Draft ${request.invoiceCode}`,
    "",
    `- Request ID: ${request.id}`,
    `- Tanggal Draft: ${formatInvoiceDate(generatedAt.toISOString())}`,
    `- Jatuh Tempo: ${formatInvoiceDate(dueAt.toISOString())}`,
    `- Client: ${request.clientName}`,
    `- Kontak: ${request.contact} (${request.channel})`,
    `- Paket: ${request.packageName}`,
    `- Estimasi Harga: ${request.quotedPrice}`,
    `- DP: ${dpText}`,
    `- Billing Mode: manual invoice`,
    `- Payment Status: not requested`,
    "",
    "## Scope",
    safeNotes,
    "",
    "## Instruksi Pembayaran",
    "Instruksi pembayaran dikirim manual oleh founder/admin setelah scope dan harga final disetujui. Draft ini bukan bukti pembayaran, tidak mengaktifkan token otomatis, dan tidak memproses payment gateway.",
    "",
    "## Catatan Operasional",
    "- Token atau akses produk dibuat/diaktifkan manual oleh admin setelah konfirmasi pembayaran.",
    "- Revisi, timeline, dan delivery final mengikuti scope tertulis yang disetujui kedua pihak.",
  ].join("\n");

  return {
    requestId: request.id,
    invoiceCode: request.invoiceCode,
    generatedAt: generatedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    clientName: request.clientName,
    packageName: request.packageName,
    quotedPrice: request.quotedPrice,
    billingMode: "manual_invoice",
    paymentStatus: "not_requested",
    markdown,
  };
}

const VALID_STATUS_TRANSITIONS: Record<CommercialRequestStatus, CommercialRequestStatus[]> = {
  new: ["qualified", "closed_lost"],
  qualified: ["quoted", "closed_lost"],
  quoted: ["closed_won", "closed_lost"],
  closed_won: [],
  closed_lost: [],
};

export async function updateCommercialRequestStatus(
  requestId: string,
  newStatus: CommercialRequestStatus,
): Promise<CommercialRequestRecord> {
  const requests = await listCommercialRequests(200);
  const target = requests.find((r) => r.id === requestId);
  if (!target) throw new Error(`Request ${requestId} not found.`);

  const allowed = VALID_STATUS_TRANSITIONS[target.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${target.status} → ${newStatus}. Allowed: ${allowed?.join(", ") || "none (terminal state)"}.`,
    );
  }

  target.status = newStatus;
  const updated = requests.reverse();
  const file = ledgerPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, updated.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  return target;
}
