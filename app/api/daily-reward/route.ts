import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import {
  getDailyRewardStatus,
  calculateNewStreak,
  getNextReward,
  type DailyRewardStatus,
} from "@/lib/daily-rewards";
import { getLevelProgress, getLevelTitle } from "@/lib/xp";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/daily-reward — Получить статус ежедневной награды
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // Аутентификация через Telegram initData
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      dailyRewardStreak: true,
      lastDailyRewardAt: true,
      xp: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const status = getDailyRewardStatus(
    user.dailyRewardStreak,
    user.lastDailyRewardAt
  );

  return NextResponse.json({
    ok: true,
    ...status,
    totalXp: user.xp,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/daily-reward — Забрать ежедневную награду
// ═══════════════════════════════════════════════════════════════════════════

type ClaimResponse = {
  ok: boolean;
  reward: {
    day: number;
    xp: number;
    bonusEnergy: number;
    icon: string;
    title: string;
    description: string;
    isSpecial: boolean;
  };
  newStreak: number;
  totalXp: number;
  levelUp: boolean;
  newLevel?: number;
  levelInfo: {
    level: number;
    progress: number;
    title: string;
    icon: string;
  };
};

export async function POST(request: NextRequest): Promise<NextResponse<ClaimResponse | { error: string }>> {
  // Аутентификация через Telegram initData
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      dailyRewardStreak: true,
      lastDailyRewardAt: true,
      xp: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Проверяем статус
  const status = getDailyRewardStatus(
    user.dailyRewardStreak,
    user.lastDailyRewardAt
  );

  if (!status.canClaim) {
    return NextResponse.json(
      { error: "already_claimed_today" },
      { status: 400 }
    );
  }

  // Рассчитываем новую серию
  const newStreak = calculateNewStreak(
    status.streakBroken ? 0 : user.dailyRewardStreak,
    user.lastDailyRewardAt
  );

  // Получаем награду
  const reward = getNextReward(status.streakBroken ? 0 : user.dailyRewardStreak);

  // Сохраняем старый уровень для проверки level up
  const oldLevelInfo = getLevelProgress(user.xp);

  // Обновляем пользователя
  const updatedUser = await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      dailyRewardStreak: newStreak,
      lastDailyRewardAt: new Date(),
      xp: { increment: reward.xp },
    },
    select: {
      xp: true,
      dailyRewardStreak: true,
    },
  });

  // Проверяем level up
  const newLevelInfo = getLevelProgress(updatedUser.xp);
  const levelUp = newLevelInfo.level > oldLevelInfo.level;
  const levelTitle = getLevelTitle(newLevelInfo.level);

  console.log(
    `[daily-reward] User ${auth.user.id} claimed day ${newStreak} reward: +${reward.xp} XP`,
    levelUp ? `(Level up! ${oldLevelInfo.level} → ${newLevelInfo.level})` : ""
  );

  return NextResponse.json({
    ok: true,
    reward,
    newStreak,
    totalXp: updatedUser.xp,
    levelUp,
    ...(levelUp && { newLevel: newLevelInfo.level }),
    levelInfo: {
      level: newLevelInfo.level,
      progress: newLevelInfo.progress,
      title: levelTitle.title,
      icon: levelTitle.icon,
    },
  });
}
