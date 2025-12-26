import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getMissionById } from "@/lib/panorama-missions";
import { prisma } from "@/lib/prisma";
import { getLevelProgress } from "@/lib/xp";
import type { PanoramaMissionProgress } from "@/types/panorama";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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
    const body = await req.json() as PanoramaMissionProgress;
    
    // Валидация
    if (!body.cluesProgress || !Array.isArray(body.cluesProgress)) {
      return NextResponse.json(
        { error: "Invalid progress data" },
        { status: 400 }
      );
    }
    
    // Считаем XP
    const correctClues = body.cluesProgress.filter(c => c.isCorrect).length;
    const totalClues = mission.clues.length;
    const accuracyMultiplier = totalClues > 0 ? correctClues / totalClues : 0;
    
    let earnedXp = Math.round(mission.xpReward * accuracyMultiplier);
    
    // Бонус за скорость
    if (mission.speedBonusPerSecond && mission.timeLimit && body.timeSpent) {
      const timeRemaining = mission.timeLimit - body.timeSpent;
      if (timeRemaining > 0) {
        earnedXp += timeRemaining * mission.speedBonusPerSecond;
      }
    }
    
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
          cluesFound: body.cluesFound,
          cluesTotal: body.cluesTotal,
          earnedXp,
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

