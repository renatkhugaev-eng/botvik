import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInitData, parseInitData } from "@/lib/telegram";

export const runtime = "nodejs";

// Admin Telegram IDs - same as in layout
const ADMIN_IDS = ["dev-mock", "5731136459"]; // Renat's Telegram ID

export async function GET(req: NextRequest) {
  // For development, allow mock admin
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true") {
    return NextResponse.json({
      authorized: true,
      user: {
        id: 1,
        telegramId: "dev-mock",
        username: "admin",
        firstName: "Dev Admin",
      },
    });
  }

  // In production, check Telegram initData from cookie or header
  const initData = req.headers.get("x-telegram-init-data") || "";
  
  if (!initData) {
    return NextResponse.json({ authorized: false, reason: "NO_INIT_DATA" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ authorized: false, reason: "NO_BOT_TOKEN" }, { status: 500 });
  }

  const validation = validateInitData(initData, botToken);
  if (!validation.ok) {
    return NextResponse.json({ authorized: false, reason: validation.reason }, { status: 401 });
  }

  const parsed = parseInitData(initData);
  const userRaw = parsed["user"];

  if (!userRaw) {
    return NextResponse.json({ authorized: false, reason: "NO_USER" }, { status: 401 });
  }

  let tgUser;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    return NextResponse.json({ authorized: false, reason: "PARSE_ERROR" }, { status: 401 });
  }

  const telegramId = String(tgUser.id);

  if (!ADMIN_IDS.includes(telegramId)) {
    return NextResponse.json({ authorized: false, reason: "NOT_ADMIN" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, telegramId: true, username: true, firstName: true },
  });

  if (!user) {
    return NextResponse.json({ authorized: false, reason: "USER_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    authorized: true,
    user,
  });
}

