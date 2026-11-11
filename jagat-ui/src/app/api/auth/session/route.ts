import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/cookie-signer";

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("jagat_g7_session")?.value;

  if (!raw) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = await verifySession(raw);

  if (!session) {
    const response = NextResponse.json(
      { authenticated: false, error: "Session cookie tidak valid." },
      { status: 401 },
    );
    response.cookies.delete("jagat_g7_session");
    return response;
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      ownerName: session.ownerName,
      tier: session.tier,
      expiredAt: session.expiredAt,
    },
  });
}
