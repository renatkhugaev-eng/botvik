import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseInitData, validateInitData } from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export async function POST(req: NextRequest) {
  let payload: { initData?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const rawInitData = payload?.initData ?? "";
  const initDataPreview = rawInitData ? rawInitData.slice(0, 120) : "";
  console.log("[auth/telegram] incoming initData", {
    length: rawInitData.length,
    preview: initDataPreview,
  });

  if (!rawInitData) {
    return NextResponse.json({ ok: false, reason: "NO_INIT_DATA" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[auth/telegram] NO_BOT_TOKEN");
    return NextResponse.json({ ok: false, reason: "NO_BOT_TOKEN" }, { status: 500 });
  }

  const validation = validateInitData(rawInitData, botToken);
  if (!validation.ok) {
    console.error("[auth/telegram] invalid initData", {
      reason: validation.reason,
      initDataLength: rawInitData.length,
      initDataPreview: rawInitData.slice(0, 80),
    });
    return NextResponse.json({ ok: false, reason: validation.reason }, { status: 401 });
  }

  const parsed = parseInitData(rawInitData);
  const userRaw = parsed["user"];

  if (!userRaw) {
    return NextResponse.json({ ok: false, reason: "USER_NOT_FOUND" }, { status: 400 });
  }

  let tgUser: TelegramUser | null = null;
  try {
    tgUser = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return NextResponse.json({ ok: false, reason: "USER_PARSE_ERROR" }, { status: 400 });
  }

  if (!tgUser?.id) {
    return NextResponse.json({ ok: false, reason: "USER_ID_MISSING" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { telegramId: String(tgUser.id) },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
    },
    create: {
      telegramId: String(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
    },
  });

  console.log("[auth/telegram] ok", {
    length: rawInitData.length,
    userId: user.id,
    telegramId: user.telegramId,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}

