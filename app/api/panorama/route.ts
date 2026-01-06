import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllMissions } from "@/lib/panorama-missions";
import type { HiddenClueMission } from "@/types/hidden-clue";

/**
 * GET /api/panorama
 * Получить список всех панорамных миссий с прогрессом пользователя
 * 
 * Источники миссий (в порядке приоритета):
 * 1. БД (опубликованные миссии) — для production
 * 2. Демо-миссии из кода — fallback если БД пустая
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Получаем миссии из БД
    // ═══════════════════════════════════════════════════════════════════════════
    
    const dbMissions = await prisma.panoramaMission.findMany({
      where: { isPublished: true },
      orderBy: [
        { isFeatured: "desc" },
        { publishedAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        difficulty: true,
        theme: true,
        clueCount: true,
        requiredClues: true,
        timeLimit: true,
        xpReward: true,
        isFeatured: true,
        missionJson: true,
      },
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Если БД пустая — используем демо-миссии
    // ═══════════════════════════════════════════════════════════════════════════
    
    let missions: Array<{
      id: string;
      title: string;
      description: string;
      location: string;
      icon: string;
      color?: string;
      difficulty: string;
      cluesCount: number;
      timeLimit: number;
      xpReward: number;
      isFeatured: boolean;
      source: "db" | "demo";
    }>;
    
    if (dbMissions.length > 0) {
      // Используем миссии из БД
      missions = dbMissions.map(m => {
        const missionJson = m.missionJson as HiddenClueMission | null;
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          location: m.location,
          icon: missionJson?.icon || "🗺️",
          color: missionJson?.color,
          difficulty: m.difficulty,
          cluesCount: m.clueCount,
          timeLimit: m.timeLimit,
          xpReward: m.xpReward,
          isFeatured: m.isFeatured,
          source: "db" as const,
        };
      });
    } else {
      // Fallback на демо-миссии
      const demoMissions = getAllMissions();
      missions = demoMissions.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        location: m.location,
        icon: m.icon,
        color: m.color,
        difficulty: m.difficulty,
        cluesCount: m.clues.length,
        timeLimit: m.timeLimit ?? 600, // Default 10 minutes
        xpReward: m.xpReward,
        isFeatured: false,
        source: "demo" as const,
      }));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Получаем прогресс пользователя
    // ═══════════════════════════════════════════════════════════════════════════
    
    const userAttempts = await prisma.panoramaMissionAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      select: {
        missionId: true,
        isCompleted: true,
        cluesFound: true,
        xpEarned: true,
        completedAt: true,
      },
    });
    
    // Группируем по missionId — берём лучший результат
    const progressByMission = new Map<string, {
      isCompleted: boolean;
      bestCluesFound: number;
      bestXpEarned: number;
      attempts: number;
      lastPlayedAt: Date | null;
    }>();
    
    for (const attempt of userAttempts) {
      const existing = progressByMission.get(attempt.missionId);
      
      if (!existing) {
        progressByMission.set(attempt.missionId, {
          isCompleted: attempt.isCompleted,
          bestCluesFound: attempt.cluesFound,
          bestXpEarned: attempt.xpEarned,
          attempts: 1,
          lastPlayedAt: attempt.completedAt,
        });
      } else {
        existing.attempts++;
        if (attempt.isCompleted && !existing.isCompleted) {
          existing.isCompleted = true;
        }
        if (attempt.cluesFound > existing.bestCluesFound) {
          existing.bestCluesFound = attempt.cluesFound;
        }
        if (attempt.xpEarned > existing.bestXpEarned) {
          existing.bestXpEarned = attempt.xpEarned;
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Объединяем миссии с прогрессом
    // ═══════════════════════════════════════════════════════════════════════════
    
    const missionsWithProgress = missions.map(mission => {
      const progress = progressByMission.get(mission.id);
      
      return {
        ...mission,
        progress: progress ? {
          isCompleted: progress.isCompleted,
          bestCluesFound: progress.bestCluesFound,
          bestXpEarned: progress.bestXpEarned,
          attempts: progress.attempts,
          lastPlayedAt: progress.lastPlayedAt?.toISOString() || null,
        } : null,
      };
    });
    
    // Статистика
    const completed = missionsWithProgress.filter(m => m.progress?.isCompleted).length;
    const inProgress = missionsWithProgress.filter(m => m.progress && !m.progress.isCompleted).length;
    
    return NextResponse.json({
      missions: missionsWithProgress,
      stats: {
        total: missions.length,
        completed,
        inProgress,
        source: dbMissions.length > 0 ? "db" : "demo",
      },
    });
  } catch (error) {
    console.error("[panorama] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch panorama missions" },
      { status: 500 }
    );
  }
}
