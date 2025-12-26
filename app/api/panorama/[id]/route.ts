import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getMissionById } from "@/lib/panorama-missions";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/panorama/[id]
 * Получить конкретную панорамную миссию
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  
  try {
    const mission = getMissionById(id);
    
    if (!mission) {
      return NextResponse.json(
        { error: "Mission not found" },
        { status: 404 }
      );
    }
    
    // TODO: Получить прогресс пользователя
    // const progress = await prisma.panoramaMissionProgress.findUnique({
    //   where: {
    //     userId_missionId: {
    //       userId: auth.user.id,
    //       missionId: id,
    //     },
    //   },
    // });
    
    return NextResponse.json({
      mission,
      progress: null,
    });
  } catch (error) {
    console.error("[panorama/id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mission" },
      { status: 500 }
    );
  }
}

