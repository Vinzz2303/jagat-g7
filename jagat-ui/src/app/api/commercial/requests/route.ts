import { NextResponse } from "next/server";
import { createCommercialRequest } from "@/lib/commercial-requests";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await createCommercialRequest({
      packageId: body?.packageId,
      clientName: body?.clientName,
      contact: body?.contact,
      channel: body?.channel,
      notes: body?.notes,
      source: body?.source || "pricing_page",
    });

    return NextResponse.json({
      success: true,
      request: {
        id: record.id,
        invoiceCode: record.invoiceCode,
        packageName: record.packageName,
        quotedPrice: record.quotedPrice,
        billingMode: record.billingMode,
        paymentStatus: record.paymentStatus,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
