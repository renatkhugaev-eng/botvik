import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

/**
 * GET /api/investigations
 * Возвращает список всех расследований с прогрессом пользователя
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  try {
    // Получаем все активные расследования
    const investigations = await prisma.investigation.findMany({
      where: { isActive: true },
      orderBy: [
        { isFeatured: "desc" },
        { order: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        city: true,
        years: true,
        coordinates: true,
        icon: true,
        color: true,
        coverImage: true,
        difficulty: true,
        xpReward: true,
        unlockType: true,
        unlockValue: true,
        isFeatured: true,
        _count: {
          select: { episodes: true },
        },
      },
    });

    // Получаем прогресс пользователя по всем расследованиям
    const userProgress = await prisma.investigationProgress.findMany({
      where: { userId },
      select: {
        investigationId: true,
        status: true,
        currentEpisode: true,
        totalScore: true,
        completedAt: true,
        isCorrectChoice: true,
      },
    });

    // Получаем уровень пользователя для проверки разблокировки
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });
    
    // Простой расчёт уровня (можно вынести в lib)
    const userLevel = Math.floor((user?.xp ?? 0) / 1000) + 1;

    // Маппим прогресс к расследованиям
    const progressMap = new Map(
      userProgress.map(p => [p.investigationId, p])
    );

    // Формируем ответ с информацией о разблокировке
    const result = investigations.map((inv, index) => {
      const progress = progressMap.get(inv.id);
      
      // Проверяем разблокировку
      let isUnlocked = false;
      let unlockReason: string | null = null;
      
      switch (inv.unlockType) {
        case "FREE":
          isUnlocked = true;
          break;
        case "LEVEL":
          isUnlocked = userLevel >= (inv.unlockValue ?? 1);
          if (!isUnlocked) unlockReason = `Нужен ${inv.unlockValue} уровень`;
          break;
        case "STARS":
          // TODO: Проверить покупку
          isUnlocked = false;
          unlockReason = `${inv.unlockValue} ⭐`;
          break;
        case "PREVIOUS":
          // Проверяем, пройдено ли предыдущее расследование
          if (index === 0) {
            isUnlocked = true;
          } else {
            const prevInv = investigations[index - 1];
            const prevProgress = progressMap.get(prevInv.id);
            isUnlocked = prevProgress?.status === "COMPLETED";
            if (!isUnlocked) unlockReason = `Пройди "${prevInv.title}"`;
          }
          break;
        case "ACHIEVEMENT":
          // TODO: Проверить достижение
          isUnlocked = false;
          unlockReason = "Нужно достижение";
          break;
      }

      return {
        ...inv,
        episodesCount: inv._count.episodes,
        isUnlocked,
        unlockReason,
        progress: progress ? {
          status: progress.status,
          currentEpisode: progress.currentEpisode,
          totalScore: progress.totalScore,
          completedAt: progress.completedAt,
          isCorrectChoice: progress.isCorrectChoice,
        } : null,
      };
    });

    // Статистика
    const stats = {
      total: investigations.length,
      unlocked: result.filter(i => i.isUnlocked).length,
      completed: userProgress.filter(p => p.status === "COMPLETED").length,
      inProgress: userProgress.filter(p => p.status === "IN_PROGRESS").length,
    };

    return NextResponse.json({
      investigations: result,
      stats,
    });
  } catch (error) {
    console.error("[investigations] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch investigations" },
      { status: 500 }
    );
  }
}
