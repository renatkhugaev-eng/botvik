import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  getDailyRewardStatus,
  calculateNewStreak,
  calculateTotalStreak,
  getNextReward,
  isToday,
} from "@/lib/daily-rewards";
import { getLevelProgress, getLevelTitle } from "@/lib/xp";
import { logStreakMilestone, logLevelUp } from "@/lib/activity";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// STREAK MILESTONES — Значимые серии для ленты друзей
// ═══════════════════════════════════════════════════════════════════════════

const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90, 100, 180, 365] as const;

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING — Защита от abuse
// ═══════════════════════════════════════════════════════════════════════════

const redis = Redis.fromEnv();
const claimLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 m"), // 3 попытки claim в минуту
  analytics: false,
  prefix: "daily-reward:claim",
});

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
  totalBonusEnergy: number;  // Общее количество бонусной энергии после claim
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

  // Rate limiting — защита от abuse
  const { success } = await claimLimiter.limit(`user:${auth.user.id}`);
  if (!success) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ТРАНЗАКЦИЯ — Атомарная операция для предотвращения race condition
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Получаем пользователя с блокировкой (FOR UPDATE через транзакцию)
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: {
          id: true,
          dailyRewardStreak: true,
          totalDailyStreak: true,
          maxDailyStreak: true,
          lastDailyRewardAt: true,
          xp: true,
        },
      });

      if (!user) {
        throw new Error("user_not_found");
      }

      // 2. Double-check: проверяем что награда ещё не получена сегодня
      //    Это защита от race condition на уровне БД
      if (user.lastDailyRewardAt && isToday(user.lastDailyRewardAt)) {
        throw new Error("already_claimed_today");
      }

      // 3. Рассчитываем новую серию
      const status = getDailyRewardStatus(
        user.dailyRewardStreak,
        user.lastDailyRewardAt
      );
      
      // Серия для UI (циклическая 1-7)
      const newStreak = calculateNewStreak(
        status.streakBroken ? 0 : user.dailyRewardStreak,
        user.lastDailyRewardAt
      );
      
      // Общая серия для достижений (не сбрасывается на 7)
      const newTotalStreak = calculateTotalStreak(
        status.streakBroken ? 0 : (user.totalDailyStreak ?? 0),
        user.lastDailyRewardAt
      );
      
      // Обновляем максимум если побили рекорд
      const newMaxStreak = Math.max(user.maxDailyStreak ?? 0, newTotalStreak);

      // 4. Получаем награду
      const reward = getNextReward(status.streakBroken ? 0 : user.dailyRewardStreak);

      // 5. Сохраняем старый уровень
      const oldLevelInfo = getLevelProgress(user.xp);

      // 6. Атомарно обновляем пользователя (включая бонусную энергию)
      const updatedUser = await tx.user.update({
        where: { id: auth.user.id },
        data: {
          dailyRewardStreak: newStreak,
          totalDailyStreak: newTotalStreak,
          maxDailyStreak: newMaxStreak,
          lastDailyRewardAt: new Date(),
          xp: { increment: reward.xp },
          // Начисляем бонусную энергию если она есть в награде
          ...(reward.bonusEnergy > 0 && {
            bonusEnergy: { increment: reward.bonusEnergy },
            bonusEnergyEarned: { increment: reward.bonusEnergy }, // Для достижений
          }),
        },
        select: {
          xp: true,
          dailyRewardStreak: true,
          totalDailyStreak: true,
          maxDailyStreak: true,
          bonusEnergy: true,
        },
      });

      return { user, updatedUser, reward, newStreak, newTotalStreak, oldLevelInfo };
    });

    // Проверяем level up
    const newLevelInfo = getLevelProgress(result.updatedUser.xp);
    const levelUp = newLevelInfo.level > result.oldLevelInfo.level;
    const levelTitle = getLevelTitle(newLevelInfo.level);

    // ═══ ACTIVITY LOGGING (для ленты друзей) ═══
    const totalStreak = result.newTotalStreak;
    
    // Логируем если достигнут milestone серии
    if (STREAK_MILESTONES.includes(totalStreak as typeof STREAK_MILESTONES[number])) {
      logStreakMilestone(auth.user.id, totalStreak).catch(err =>
        console.error("[daily-reward] Streak milestone activity log failed:", err)
      );
    }
    
    // Логируем повышение уровня
    if (levelUp) {
      logLevelUp(auth.user.id, newLevelInfo.level).catch(err =>
        console.error("[daily-reward] Level up activity log failed:", err)
      );
    }

    // ВАЖНО: Не проверяем достижения здесь!
    // Достижения проверяются при завершении квиза и на странице профиля.
    // Это гарантирует что Daily Reward даёт ТОЛЬКО указанные очки (10, 20, 30...)

    return NextResponse.json({
      ok: true,
      reward: result.reward,
      newStreak: result.newStreak,
      totalXp: result.updatedUser.xp,
      totalBonusEnergy: result.updatedUser.bonusEnergy,
      levelUp,
      ...(levelUp && { newLevel: newLevelInfo.level }),
      levelInfo: {
        level: newLevelInfo.level,
        progress: newLevelInfo.progress,
        title: levelTitle.title,
        icon: levelTitle.icon,
      },
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    
    if (message === "user_not_found") {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    
    if (message === "already_claimed_today") {
      return NextResponse.json({ error: "already_claimed_today" }, { status: 400 });
    }
    
    console.error("[daily-reward] Error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
