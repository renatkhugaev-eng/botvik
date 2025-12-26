import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseInitData, validateInitData } from "@/lib/telegram";
import { notifyFriendActivity } from "@/lib/notifications";

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
  
  // Only log initData length in production, no preview (contains sensitive user data)
  if (process.env.NODE_ENV === "development") {
    console.log("[auth/telegram] incoming initData length:", rawInitData.length);
  }

  // ═══ DEV MODE: Return dev-mock user when no initData in development ═══
  if (!rawInitData && process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true" && process.env.NODE_ENV === "development") {
    console.log("[auth/telegram] Dev mode - returning dev-mock user");
    
    // Find or create dev-mock user
    let devUser = await prisma.user.findUnique({
      where: { telegramId: "dev-mock" },
    });
    
    if (!devUser) {
      devUser = await prisma.user.create({
        data: {
          telegramId: "dev-mock",
          username: "dev_user",
          firstName: "Developer",
          lastName: "Mode",
          xp: 1000,
          status: "ONLINE",
        },
      });
      console.log("[auth/telegram] Created dev-mock user:", devUser.id);
    }
    
    return NextResponse.json({
      ok: true,
      user: {
        id: devUser.id,
        telegramId: devUser.telegramId,
        username: devUser.username,
        firstName: devUser.firstName,
        lastName: devUser.lastName,
        photoUrl: devUser.photoUrl,
      },
      isNewUser: false,
    });
  }

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
    // Don't log initData content in production — contains sensitive user data
    console.error("[auth/telegram] invalid initData", {
      reason: validation.reason,
      initDataLength: rawInitData.length,
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
          
          // Уведомляем реферера о новом друге (async, не блокируем)
          const friendName = newUser.username || newUser.firstName || "Новый игрок";
          notifyFriendActivity(referrerId, friendName, "joined").catch(err => {
            console.error("[auth/telegram] Failed to notify referrer:", err);
          });
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

