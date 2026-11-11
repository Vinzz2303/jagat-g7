import { NextResponse } from "next/server";
import { listCommercialRequests, updateCommercialRequestStatus } from "@/lib/commercial-requests";

export const runtime = "nodejs";

export async function GET() {
  const requests = await listCommercialRequests(100);
  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status } = body as { requestId?: string; status?: string };
    if (!requestId || !status) {
      return NextResponse.json({ error: "requestId and status are required." }, { status: 400 });
    }
    const updated = await updateCommercialRequestStatus(requestId, status as never);
    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update request.";
    const status = message.includes("not found") ? 404 : message.includes("Invalid transition") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
