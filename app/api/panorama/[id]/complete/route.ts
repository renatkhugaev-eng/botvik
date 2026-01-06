import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getMissionById } from "@/lib/panorama-missions";
import { prisma } from "@/lib/prisma";
import { getLevelProgress } from "@/lib/xp";
import { getWeekStart } from "@/lib/week";
import { invalidateLeaderboardCache } from "@/lib/leaderboard-cache";

type RouteParams = {
  params: Promise<{ id: string }>;
};

interface MissionCompleteBody {
  cluesFound: number;
  cluesTotal: number;
  timeSpent: number;
  status: "completed" | "failed";
  // Опциональный старый формат для обратной совместимости
  cluesProgress?: { clueId: string; isCorrect: boolean }[];
}

/**
 * POST /api/panorama/[id]/complete
 * Завершить панорамную миссию и сохранить результат
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  const userId = auth.user.id;
  
  try {
    const mission = getMissionById(id);
    
    if (!mission) {
      return NextResponse.json(
        { error: "Mission not found" },
        { status: 404 }
      );
    }
    
    // Получаем результат из тела запроса
    const body = await req.json() as MissionCompleteBody;
    
    // Валидация — поддерживаем оба формата
    const cluesFound = body.cluesFound ?? 
      (body.cluesProgress?.filter(c => c.isCorrect).length ?? 0);
    const cluesTotal = body.cluesTotal ?? mission.clues.length;
    
    if (typeof cluesFound !== "number" || cluesFound < 0) {
      return NextResponse.json(
        { error: "Invalid cluesFound" },
        { status: 400 }
      );
    }
    
    // Считаем XP на основе собранных улик
    const accuracyMultiplier = cluesTotal > 0 ? cluesFound / cluesTotal : 0;
    let earnedXp = Math.round(mission.xpReward * accuracyMultiplier);
    
    // Бонус за скорость
    const timeSpent = body.timeSpent ?? 0;
    if (mission.speedBonusPerSecond && mission.timeLimit && timeSpent > 0) {
      const timeRemaining = mission.timeLimit - timeSpent;
      if (timeRemaining > 0) {
        earnedXp += Math.round(timeRemaining * mission.speedBonusPerSecond);
      }
    }
    
    // Округляем итоговый XP
    earnedXp = Math.max(0, Math.round(earnedXp));
    
    // Получаем старого пользователя
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, panoramaBestScore: true, panoramaCount: true },
    });
    const oldLevelInfo = getLevelProgress(oldUser?.xp ?? 0);
    
    // Начисляем XP и обновляем panorama stats в User
    const shouldUpdateUserBest = earnedXp > (oldUser?.panoramaBestScore ?? 0);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        xp: { increment: earnedXp },
        panoramaCount: { increment: 1 },
        ...(shouldUpdateUserBest && { panoramaBestScore: earnedXp }),
      },
      select: { xp: true, panoramaBestScore: true, panoramaCount: true },
    });
    
    // Обновляем WeeklyScore для панорам
    const weekStart = getWeekStart();
    
    // Получаем текущий weekly best для ОТДЕЛЬНОЙ проверки
    const currentWeekly = await prisma.weeklyScore.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      select: { panoramaBestScore: true },
    });
    const shouldUpdateWeeklyBest = earnedXp > (currentWeekly?.panoramaBestScore ?? 0);
    
    await prisma.weeklyScore.upsert({
      where: {
        userId_weekStart: { userId, weekStart },
      },
      create: {
        userId,
        weekStart,
        panoramaBestScore: earnedXp,
        panoramaCount: 1,
      },
      update: {
        panoramaCount: { increment: 1 },
        // Обновляем лучший результат только если новый лучше НЕДЕЛЬНОГО
        ...(shouldUpdateWeeklyBest && { panoramaBestScore: earnedXp }),
      },
    });
    
    // Проверяем level up
    const newLevelInfo = getLevelProgress(updatedUser.xp);
    const levelUp = newLevelInfo.level > oldLevelInfo.level;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Сохраняем прогресс в PanoramaMissionAttempt (если миссия из БД)
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Проверяем есть ли миссия в БД
    const dbMission = await prisma.panoramaMission.findUnique({
      where: { id },
      select: { id: true },
    });
    
    if (dbMission) {
      // Миссия из БД — сохраняем attempt
      await prisma.panoramaMissionAttempt.create({
        data: {
          missionId: id,
          userId,
          isCompleted: body.status === "completed",
          cluesFound,
          timeSpent: timeSpent > 0 ? Math.round(timeSpent) : null,
          xpEarned: earnedXp,
          completedAt: new Date(),
          detailsJson: {
            cluesTotal,
            status: body.status,
            cluesProgress: body.cluesProgress || null,
          },
        },
      });
      
      // Обновляем статистику миссии
      await prisma.panoramaMission.update({
        where: { id },
        data: {
          playCount: { increment: 1 },
        },
      }).catch(() => {});
    }
    // Для демо-миссий прогресс не сохраняется (нет записи в БД)
    
    // Записываем активность
    await prisma.userActivity.create({
      data: {
        userId,
        type: "PANORAMA_COMPLETE",
        title: `Прошёл панораму «${mission.title}»`,
        icon: "🗺️",
        data: {
          missionId: id,
          missionTitle: mission.title,
          cluesFound,
          cluesTotal,
          timeSpent,
          earnedXp,
          status: body.status,
        },
      },
    });
    
    console.log(`[panorama/complete] User ${userId} completed mission ${id}, earned ${earnedXp} XP`);
    
    // ═══ INVALIDATE LEADERBOARD CACHE ═══
    invalidateLeaderboardCache({
      weekStart,
      invalidateGlobal: true,
    }).catch(err => console.error("[panorama/complete] Leaderboard cache invalidation failed:", err));
    
    return NextResponse.json({
      success: true,
      earnedXp,
      newTotalXp: updatedUser.xp,
      levelUp,
      newLevel: levelUp ? newLevelInfo.level : undefined,
    });
  } catch (error) {
    console.error("[panorama/complete] Error:", error);
    return NextResponse.json(
      { error: "Failed to complete mission" },
      { status: 500 }
    );
  }
}

