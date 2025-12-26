import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getAllMissions } from "@/lib/panorama-missions";

/**
 * GET /api/panorama
 * Получить список всех панорамных миссий с прогрессом пользователя
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  try {
    const missions = getAllMissions();
    
    // TODO: Получить прогресс пользователя из БД
    // const userProgress = await prisma.panoramaMissionProgress.findMany({
    //   where: { userId: auth.user.id },
    // });
    
    // Пока возвращаем статические данные
    const missionsWithProgress = missions.map(mission => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      location: mission.location,
      icon: mission.icon,
      color: mission.color,
      difficulty: mission.difficulty,
      cluesCount: mission.clues.length,
      timeLimit: mission.timeLimit,
      xpReward: mission.xpReward,
      // Progress (TODO: из БД)
      progress: null,
    }));
    
    return NextResponse.json({
      missions: missionsWithProgress,
      stats: {
        total: missions.length,
        completed: 0,
        inProgress: 0,
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

