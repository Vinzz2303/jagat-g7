import { NextResponse } from "next/server";
import { generateCommercialInvoiceDraft } from "@/lib/commercial-requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, dueDays, dpPercent } = body as {
      requestId?: string;
      dueDays?: number;
      dpPercent?: number;
    };

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    const invoice = await generateCommercialInvoiceDraft(requestId, { dueDays, dpPercent });
    return NextResponse.json({ invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate invoice draft.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Qualify") || message.includes("Cannot generate")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
