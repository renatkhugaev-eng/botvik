import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseInitData, validateInitData } from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export async function POST(req: NextRequest) {
  let payload: { initData?: string; referralCode?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const rawInitData = payload?.initData ?? "";
  const referralCodeFromBody = payload?.referralCode?.toUpperCase()?.trim();
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

  const telegramId = String(tgUser.id);
  
  // Проверяем существует ли пользователь
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  const isNewUser = !user;
  
  if (isNewUser) {
    // ═══ REFERRAL SYSTEM: Обработка реферального кода ═══
    // Код может прийти из:
    // 1. start_param в initData (от Telegram Mini App)
    // 2. referralCode в body (от ?ref= параметра в URL)
    const startParam = parsed["start_param"];
    
    // DEBUG: Логируем все источники реферального кода
    console.log("[auth/telegram] Referral debug:", {
      startParam,
      referralCodeFromBody,
      allParsedKeys: Object.keys(parsed),
    });
    
    let referralCode = startParam?.startsWith("ref_") 
      ? startParam.replace("ref_", "").toUpperCase() 
      : referralCodeFromBody;
    
    let referrerId: number | null = null;
    
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true, telegramId: true },
      });
      
      // Защита от самореферала
      if (referrer && referrer.telegramId !== telegramId) {
        referrerId = referrer.id;
      }
    }
    
    // Создаём пользователя с наградами в транзакции
    try {
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            telegramId,
            username: tgUser.username ?? null,
            firstName: tgUser.first_name ?? null,
            lastName: tgUser.last_name ?? null,
            photoUrl: tgUser.photo_url ?? null,
            xp: referrerId ? 25 : 0, // Бонус новичку
            ...(referrerId && { referredById: referrerId }),
          },
        });
        
        // Награда рефереру
        if (referrerId) {
          await tx.user.update({
            where: { id: referrerId },
            data: {
              xp: { increment: 50 },
              bonusEnergy: { increment: 1 },
              bonusEnergyEarned: { increment: 1 },
            },
          });
          console.log(`[auth/telegram] Referral: user ${newUser.id} referred by ${referrerId}`);
        }
        
        return newUser;
      });
    } catch (txError) {
      console.error("[auth/telegram] Referral transaction failed:", txError);
      // Fallback без реферала
      user = await prisma.user.create({
        data: {
          telegramId,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: tgUser.last_name ?? null,
          photoUrl: tgUser.photo_url ?? null,
        },
      });
    }
  } else {
    // Обновляем существующего пользователя
    user = await prisma.user.update({
      where: { telegramId },
      data: {
        username: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
        photoUrl: tgUser.photo_url ?? null,
      },
    });
  }

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
      photoUrl: tgUser.photo_url ?? null,
    },
  });
}

