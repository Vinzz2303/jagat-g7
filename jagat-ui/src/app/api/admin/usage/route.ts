import { NextResponse } from "next/server";
import { getUsageLedgerSummary } from "@/lib/usage-metering";

export const runtime = "nodejs";

export async function GET() {
  const usage = await getUsageLedgerSummary(25);
  return NextResponse.json({ usage });
}
