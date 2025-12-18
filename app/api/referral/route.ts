import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import {
  generateReferralCode,
  REFERRAL_REWARDS,
  type ReferralStats,
} from "@/lib/referral";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/referral — Получить реферальную статистику и код
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Получаем пользователя с его рефералами
    let user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        referralCode: true,
        referrals: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Генерируем код если его нет
    let referralCode = user.referralCode;
    if (!referralCode) {
      // Генерируем уникальный код
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const newCode = generateReferralCode();
        const existing = await prisma.user.findUnique({
          where: { referralCode: newCode },
          select: { id: true },
        });
        
        if (!existing) {
          referralCode = newCode;
          break;
        }
        attempts++;
      }

      if (!referralCode) {
        return NextResponse.json(
          { error: "failed_to_generate_code" },
          { status: 500 }
        );
      }

      // Сохраняем код
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { referralCode },
      });
    }

    // Формируем ссылку
    const botName = process.env.TELEGRAM_BOT_NAME || "botvik_bot";
    const referralLink = `https://t.me/${botName}?start=ref_${referralCode}`;

    // Считаем статистику
    const referralsCount = user.referrals.length;
    const totalXpEarned = referralsCount * REFERRAL_REWARDS.referrer.xp;
    const totalEnergyEarned = referralsCount * REFERRAL_REWARDS.referrer.bonusEnergy;

    const stats: ReferralStats = {
      referralCode,
      referralLink,
      referralsCount,
      totalXpEarned,
      totalEnergyEarned,
      referrals: user.referrals.map(r => ({
        id: r.id,
        username: r.username,
        firstName: r.firstName,
        photoUrl: r.photoUrl,
        joinedAt: r.createdAt,
      })),
    };

    return NextResponse.json({
      ok: true,
      ...stats,
      rewards: REFERRAL_REWARDS,
    });
    
  } catch (error) {
    console.error("[Referral GET] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
