import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";

const REQUIRED_METADATA_FIELDS = [
  "title",
  "source",
  "category",
  "doc_type",
  "owner",
  "created_at",
  "trust_level",
  "provenance",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isRecord(body) || !isNonEmptyString(body.content) || !isRecord(body.metadata)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Field 'content' dan 'metadata' wajib diisi untuk ingest Phase 3A." },
        { status: 400 },
      );
    }

    for (const field of REQUIRED_METADATA_FIELDS) {
      if (!isNonEmptyString(body.metadata[field])) {
        return NextResponse.json(
          { error: "Bad Request", message: `Metadata '${field}' wajib diisi.` },
          { status: 400 },
        );
      }
    }

    const upstream = await fetch(`${BACKEND_URL}/research/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: body.content.trim(),
        metadata: body.metadata,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Koneksi ke backend JAGAT gagal.";
    console.error("[BFF:INGEST] Error:", message);
    return NextResponse.json(
      { error: "BFF Proxy Error", message },
      { status: 502 },
    );
  }
}
