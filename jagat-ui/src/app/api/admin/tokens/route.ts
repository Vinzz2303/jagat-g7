import { NextResponse } from "next/server";
import {
  getRegistry,
  addToken,
  updateTokenStatus,
  extendToken,
  type TokenEntity,
  type TokenTier,
} from "@/lib/token-registry";

function generateTokenString(tier: TokenTier, ownerName: string): string {
  const prefix = ownerName.split(/\s+/)[0].toUpperCase().slice(0, 6);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `G7-${tier}-${prefix}-${rand}`;
}

export async function GET() {
  const tokens = await getRegistry();
  return NextResponse.json({ tokens });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { ownerName, tier } = body as { ownerName?: string; tier?: string };

  if (!ownerName?.trim()) {
    return NextResponse.json({ error: "ownerName is required" }, { status: 400 });
  }
  if (tier !== "PRO" && tier !== "ULTRA") {
    return NextResponse.json({ error: "tier must be PRO or ULTRA" }, { status: 400 });
  }

  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const entity: TokenEntity = {
    token: generateTokenString(tier as TokenTier, ownerName.trim()),
    ownerName: ownerName.trim(),
    tier: tier as TokenTier,
    status: "ACTIVE",
    expiredAt: expiry.toISOString(),
  };

  await addToken(entity);

  return NextResponse.json({ success: true, entity });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    action?: string;
    days?: number;
  } | null;

  const token = body?.token?.trim();
  const action = body?.action;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const existing = (await getRegistry()).find((item) => item.token === token);
  if (!existing) {
    return NextResponse.json({ error: "token not found" }, { status: 404 });
  }
  if (existing.tier === "SOVEREIGN" && action === "suspend") {
    return NextResponse.json(
      { error: "SOVEREIGN token cannot be suspended from admin UI" },
      { status: 400 },
    );
  }

  let entity: TokenEntity | null = null;

  if (action === "suspend") {
    entity = await updateTokenStatus(token, "SUSPENDED");
  } else if (action === "activate") {
    entity = await updateTokenStatus(token, "ACTIVE");
  } else if (action === "extend") {
    entity = await extendToken(token, body?.days ?? 30);
  } else {
    return NextResponse.json(
      { error: "action must be suspend, activate, or extend" },
      { status: 400 },
    );
  }

  if (!entity) {
    return NextResponse.json({ error: "token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, entity });
}
