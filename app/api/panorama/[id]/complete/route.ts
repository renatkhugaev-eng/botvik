import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getMissionById } from "@/lib/panorama-missions";
import { prisma } from "@/lib/prisma";
import { getLevelProgress } from "@/lib/xp";

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
    
    // Получаем старый уровень
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });
    const oldLevelInfo = getLevelProgress(oldUser?.xp ?? 0);
    
    // Начисляем XP пользователю
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: earnedXp } },
      select: { xp: true },
    });
    
    // Проверяем level up
    const newLevelInfo = getLevelProgress(updatedUser.xp);
    const levelUp = newLevelInfo.level > oldLevelInfo.level;
    
    // TODO: Сохранить прогресс в БД
    // await prisma.panoramaMissionProgress.upsert({
    //   where: {
    //     userId_missionId: { userId, missionId: id },
    //   },
    //   create: {
    //     userId,
    //     missionId: id,
    //     status: body.status,
    //     cluesFound: body.cluesFound,
    //     cluesTotal: body.cluesTotal,
    //     timeSpent: body.timeSpent,
    //     earnedXp,
    //     completedAt: new Date(),
    //   },
    //   update: {
    //     status: body.status,
    //     cluesFound: body.cluesFound,
    //     timeSpent: body.timeSpent,
    //     earnedXp,
    //     completedAt: new Date(),
    //   },
    // });
    
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

