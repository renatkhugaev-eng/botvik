import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  checkAndUnlockAchievements,
  getUserAchievements,
  getNewAchievements,
  markAchievementsNotified,
  checkTimeBasedAchievements,
  checkOGPlayerAchievement,
} from "@/lib/achievement-checker";
import {
  ACHIEVEMENTS,
  CATEGORY_INFO,
  RARITY_INFO,
  getAchievementStats,
} from "@/lib/achievements";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/achievements — Получить достижения пользователя
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const search = request.nextUrl.searchParams;
  const action = search.get("action");

  // Получить только новые (непросмотренные) достижения
  if (action === "new") {
    const newAchievements = await getNewAchievements(auth.user.id);
    return NextResponse.json({
      ok: true,
      achievements: newAchievements,
      count: newAchievements.length,
    });
  }

  // Получить статистику достижений (для UI)
  if (action === "stats") {
    const stats = getAchievementStats();
    return NextResponse.json({
      ok: true,
      stats,
      categories: CATEGORY_INFO,
      rarities: RARITY_INFO,
    });
  }

  // Получить все достижения с прогрессом
  const achievements = await getUserAchievements(auth.user.id);
  
  // Группируем по категориям
  const byCategory = Object.keys(CATEGORY_INFO).reduce((acc, cat) => {
    acc[cat] = achievements.filter(a => a.category === cat);
    return acc;
  }, {} as Record<string, typeof achievements>);

  // Статистика пользователя
  const unlocked = achievements.filter(a => a.unlocked);
  const stats = {
    total: ACHIEVEMENTS.length,
    unlocked: unlocked.length,
    percentage: Math.round((unlocked.length / ACHIEVEMENTS.length) * 100),
    totalXpEarned: unlocked.reduce((sum, a) => sum + a.xpReward, 0),
    byRarity: {
      common: unlocked.filter(a => a.rarity === "common").length,
      uncommon: unlocked.filter(a => a.rarity === "uncommon").length,
      rare: unlocked.filter(a => a.rarity === "rare").length,
      epic: unlocked.filter(a => a.rarity === "epic").length,
      legendary: unlocked.filter(a => a.rarity === "legendary").length,
    },
  };

  return NextResponse.json({
    ok: true,
    achievements,
    byCategory,
    stats,
    categories: CATEGORY_INFO,
    rarities: RARITY_INFO,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/achievements — Проверить и разблокировать достижения
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  // Отметить достижения как просмотренные
  if (action === "mark_notified") {
    const achievementIds = body.achievementIds as string[];
    if (!Array.isArray(achievementIds)) {
      return NextResponse.json(
        { error: "achievementIds must be an array" },
        { status: 400 }
      );
    }
    
    await markAchievementsNotified(auth.user.id, achievementIds);
    return NextResponse.json({ ok: true });
  }

  // Проверить и разблокировать достижения
  // Собираем специальные достижения для проверки
  const specialAchievements: string[] = [];

  // Проверяем временные достижения
  specialAchievements.push(...checkTimeBasedAchievements());

  // Проверяем OG Player
  const isOG = await checkOGPlayerAchievement(auth.user.id);
  if (isOG) {
    specialAchievements.push("og_player");
  }

  // Проверяем все достижения
  const result = await checkAndUnlockAchievements(
    auth.user.id,
    specialAchievements
  );

  if (result.newlyUnlocked.length > 0) {
    console.log(
      `[achievements] User ${auth.user.id} unlocked ${result.newlyUnlocked.length} achievements: ` +
      result.newlyUnlocked.map(a => a.achievement.id).join(", ")
    );
  }

  return NextResponse.json({
    ok: true,
    newlyUnlocked: result.newlyUnlocked.map(u => ({
      id: u.achievement.id,
      name: u.achievement.name,
      description: u.achievement.description,
      icon: u.achievement.icon,
      rarity: u.achievement.rarity,
      xpReward: u.achievement.xpReward,
      unlockedAt: u.unlockedAt.toISOString(),
    })),
    totalUnlocked: result.totalUnlocked,
    totalAchievements: result.totalAchievements,
    xpEarned: result.xpEarned,
  });
}
