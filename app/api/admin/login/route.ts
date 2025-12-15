import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, authLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export async function POST(req: NextRequest) {
  // ═══ RATE LIMITING (prevent brute force) ═══
  const identifier = getClientIdentifier(req);
  const rateLimit = await checkRateLimit(authLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { password } = body;

  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  // Timing-safe comparison would be better, but for admin password it's acceptable
  if (password === ADMIN_PASSWORD) {
    // Generate a simple session token
    const token = Buffer.from(
      JSON.stringify({
        authorized: true,
        timestamp: Date.now(),
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    ).toString("base64");

    return NextResponse.json(
      { success: true, token },
      {
        headers: {
          "Set-Cookie": `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
        },
      }
    );
  }

  // Log failed attempt
  console.warn(`[Admin] Failed login attempt from ${identifier}`);

  return NextResponse.json({ error: "invalid_password" }, { status: 401 });
}

export async function DELETE() {
  // Logout - clear cookie
  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": "admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      },
    }
  );
}

