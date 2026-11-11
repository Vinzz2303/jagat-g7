import { NextRequest } from "next/server";
import { verifySession } from "@/lib/cookie-signer";
import {
  assertUsageAllowed,
  encodeUsageSummary,
  recordUsage,
  type UsageActor,
  type UsageSummary,
} from "@/lib/usage-metering";

const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const AGENT_MODES = new Set(["research", "kiting", "ting", "motherbox"]);

export const runtime = "nodejs";

function usageSummaryFromError(error: unknown): UsageSummary | undefined {
  if (error && typeof error === "object" && "usageSummary" in error) {
    return (error as { usageSummary?: UsageSummary }).usageSummary;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const startedAt = Date.now();
    const body = await request.json();
    const { topic, filters, agentMode: rawAgentMode } = body as {
      topic?: string;
      filters?: unknown;
      agentMode?: unknown;
    };

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Field 'topic' wajib diisi." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const trimmedTopic = topic.trim();
    const agentMode =
      typeof rawAgentMode === "string" && AGENT_MODES.has(rawAgentMode)
        ? rawAgentMode
        : "research";
    const meteredAgentMode = agentMode as "research" | "kiting" | "ting" | "motherbox";

    const sessionCookie = request.cookies.get("jagat_g7_session")?.value;
    const verifiedSession = sessionCookie ? await verifySession(sessionCookie) : null;
    const clientFingerprint =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";
    const usageActor: UsageActor = verifiedSession
      ? {
          ownerName: verifiedSession.ownerName,
          tier: verifiedSession.tier,
          subject: verifiedSession.token,
        }
      : {
          ownerName: "Guest",
          tier: "GUEST",
          subject: `guest:${clientFingerprint}`,
        };

    try {
      await assertUsageAllowed(usageActor);
    } catch (quotaError) {
      const usage = usageSummaryFromError(quotaError);
      return new Response(
        JSON.stringify({
          error: "Quota Exceeded",
          message: "Kuota harian tier ini sudah habis. Upgrade/perpanjang akses dilakukan manual via admin JAGAT.",
          usage,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const upstream = await fetch(`${BACKEND_URL}/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-tier": usageActor.tier,
      },
      body: JSON.stringify({ topic: trimmedTopic, agentMode, ...(filters ? { filters } : {}) }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => upstream.statusText);
      await recordUsage(usageActor, {
        agentMode: meteredAgentMode,
        endpoint: "/research",
        status: "error",
        latencyMs: Date.now() - startedAt,
        refusalReason: `backend_${upstream.status}`,
      }).catch((ledgerError) => {
        console.error("[BFF:RESEARCH] Usage ledger error:", ledgerError);
      });
      return new Response(errText, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!upstream.body) {
      await recordUsage(usageActor, {
        agentMode: meteredAgentMode,
        endpoint: "/research",
        status: "error",
        latencyMs: Date.now() - startedAt,
        refusalReason: "empty_stream_body",
      }).catch((ledgerError) => {
        console.error("[BFF:RESEARCH] Usage ledger error:", ledgerError);
      });
      return new Response(
        JSON.stringify({ error: "Stream body null" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const usageSummary = await recordUsage(usageActor, {
      agentMode: meteredAgentMode,
      endpoint: "/research",
      status: "success",
      latencyMs: Date.now() - startedAt,
    });

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush() {
        console.log(`[BFF:RESEARCH] Stream selesai tanpa auto-ingest | Topik: "${trimmedTopic.slice(0, 60)}"`);
      },
    });

    return new Response(upstream.body.pipeThrough(transformStream), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-JAGAT-Usage-Summary": encodeUsageSummary(usageSummary),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Koneksi ke backend JAGAT gagal.";
    console.error("[BFF:RESEARCH] Error:", message, "URL:", `${BACKEND_URL}/research`);
    return new Response(
      JSON.stringify({ error: "BFF Proxy Error", message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
