import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseInitData, validateInitData } from "@/lib/telegram";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "bot_token_not_configured" }, { status: 500 });
  }

  let payload: { initData?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const rawInitData = payload?.initData ?? "";
  if (!validateInitData(rawInitData, botToken)) {
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  const parsed = parseInitData(rawInitData);
  const userRaw = parsed["user"];

  if (!userRaw) {
    return NextResponse.json({ error: "user_not_found" }, { status: 400 });
  }

  let tgUser: TelegramUser | null = null;
  try {
    tgUser = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return NextResponse.json({ error: "user_parse_error" }, { status: 400 });
  }

  if (!tgUser?.id) {
    return NextResponse.json({ error: "user_id_missing" }, { status: 400 });
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

  return NextResponse.json({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
  });
}

