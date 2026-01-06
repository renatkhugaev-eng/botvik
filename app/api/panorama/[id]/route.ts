import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMissionById } from "@/lib/panorama-missions";
import type { HiddenClueMission } from "@/types/hidden-clue";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/panorama/[id]
 * Получить конкретную панорамную миссию
 * 
 * Источники (в порядке приоритета):
 * 1. БД (по id) — для production миссий
 * 2. Демо-миссии — fallback
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  const userId = auth.user.id;
  
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Пробуем найти в БД
    // ═══════════════════════════════════════════════════════════════════════════
    
    let dbMission: {
      id: string;
      title: string;
      isPublished: boolean;
      missionJson: unknown;
    } | null = null;
    
    try {
      dbMission = await prisma.panoramaMission.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          isPublished: true,
          missionJson: true,
        },
      });
    } catch (dbError) {
      console.error(`[panorama/${id}] DB query failed:`, dbError);
      // Continue - will fallback to demo missions
    }
    
    let mission: HiddenClueMission | null = null;
    let source: "db" | "demo" = "demo";
    
    if (dbMission) {
      // Проверяем что опубликована
      if (!dbMission.isPublished) {
        return NextResponse.json(
          { error: "Mission not published" },
          { status: 404 }
        );
      }
      
      mission = dbMission.missionJson as unknown as HiddenClueMission;
      source = "db";
      // playCount увеличивается в /complete, не здесь
    } else {
      // ═══════════════════════════════════════════════════════════════════════════
      // 2. Fallback на демо-миссии
      // ═══════════════════════════════════════════════════════════════════════════
      
      mission = getMissionById(id) ?? null;
      source = "demo";
    }
    
    if (!mission) {
      return NextResponse.json(
        { error: "Mission not found" },
        { status: 404 }
      );
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Получаем прогресс пользователя (только для БД миссий)
    // ═══════════════════════════════════════════════════════════════════════════
    
    let progress = null;
    
    if (source === "db") {
      const attempts = await prisma.panoramaMissionAttempt.findMany({
        where: { userId, missionId: id },
        orderBy: { xpEarned: "desc" },
        take: 1,
        select: {
          isCompleted: true,
          cluesFound: true,
          xpEarned: true,
          timeSpent: true,
          completedAt: true,
        },
      });
      
      if (attempts.length > 0) {
        const best = attempts[0];
        const totalAttempts = await prisma.panoramaMissionAttempt.count({
          where: { userId, missionId: id },
        });
        
        progress = {
          isCompleted: best.isCompleted,
          bestCluesFound: best.cluesFound,
          bestXpEarned: best.xpEarned,
          bestTimeSpent: best.timeSpent,
          attempts: totalAttempts,
          lastPlayedAt: best.completedAt?.toISOString() || null,
        };
      }
    }
    
    return NextResponse.json({
      mission,
      progress,
      source,
    });
  } catch (error) {
    console.error("[panorama/id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mission" },
      { status: 500 }
    );
  }
}
