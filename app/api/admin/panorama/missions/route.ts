/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS ADMIN API
 * 
 * GET  /api/admin/panorama/missions — Список всех миссий
 * POST /api/admin/panorama/missions — Сохранить и опубликовать миссию
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// GET — Список миссий
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";
    const theme = searchParams.get("theme");
    
    const missions = await prisma.panoramaMission.findMany({
      where: {
        ...(showAll ? {} : { isPublished: true }),
        ...(theme ? { theme } : {}),
      },
      orderBy: [
        { isFeatured: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
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
        isPublished: true,
        isFeatured: true,
        playCount: true,
        avgCompletionTime: true,
        avgCluesFound: true,
        createdAt: true,
        publishedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            username: true,
          },
        },
      },
    });
    
    // Статистика
    const stats = await prisma.panoramaMission.aggregate({
      _count: { id: true },
      _sum: { playCount: true },
    });
    
    const publishedCount = await prisma.panoramaMission.count({
      where: { isPublished: true },
    });
    
    return NextResponse.json({
      ok: true,
      missions,
      stats: {
        total: stats._count.id,
        published: publishedCount,
        totalPlays: stats._sum.playCount || 0,
      },
    });
  } catch (error) {
    console.error("[Admin Panorama Missions GET] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch missions" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Сохранить и опубликовать миссию (из генератора)
// ═══════════════════════════════════════════════════════════════════════════

const SaveMissionSchema = z.object({
  mission: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    briefing: z.string().optional(),
    location: z.string(),
    difficulty: z.string(),
    icon: z.string().optional(),
    color: z.string().optional(),
    startPanoId: z.string(),
    startCoordinates: z.tuple([z.number(), z.number()]),
    startHeading: z.number().optional(),
    allowNavigation: z.boolean().default(true), // CRITICAL: разрешить навигацию
    clues: z.array(z.any()),
    requiredClues: z.number(),
    timeLimit: z.number(),
    xpReward: z.number(),
    speedBonusPerSecond: z.number().optional(),
    seed: z.string().optional(),
    generatedAt: z.string().optional(),
    generatorVersion: z.string().optional(),
  }),
  theme: z.string(),
  publish: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  try {
    const body = await req.json();
    const validation = SaveMissionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: "Ошибка валидации", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const { mission, theme, publish, featured } = validation.data;
    
    // Проверяем нет ли уже миссии с таким ID
    const existing = await prisma.panoramaMission.findUnique({
      where: { id: mission.id },
      select: { id: true },
    });
    
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Миссия с таким ID уже существует" },
        { status: 409 }
      );
    }
    
    // Создаём миссию
    // NOTE: auth.user.id === 0 для браузерных админ-сессий (JWT), 
    // поэтому используем null чтобы избежать FK constraint error
    const creatorId = auth.user.id > 0 ? auth.user.id : null;
    
    const savedMission = await prisma.panoramaMission.create({
      data: {
        id: mission.id,
        title: mission.title,
        description: mission.description,
        location: mission.location,
        difficulty: mission.difficulty,
        theme: theme,
        startLat: mission.startCoordinates[0],
        startLng: mission.startCoordinates[1],
        startPanoId: mission.startPanoId,
        missionJson: JSON.parse(JSON.stringify(mission)),
        clueCount: mission.clues.length,
        requiredClues: mission.requiredClues,
        timeLimit: mission.timeLimit,
        xpReward: mission.xpReward,
        seed: mission.seed,
        isPublished: publish,
        isFeatured: featured,
        publishedAt: publish ? new Date() : null,
        createdById: creatorId,
        generatorVersion: "3.1.0",
      },
    });
    
    console.log(`[Admin Panorama] Mission saved: ${savedMission.id} by user ${auth.user.id}, published=${publish}`);
    
    return NextResponse.json({
      ok: true,
      mission: {
        id: savedMission.id,
        title: savedMission.title,
        isPublished: savedMission.isPublished,
        isFeatured: savedMission.isFeatured,
      },
    });
  } catch (error) {
    console.error("[Admin Panorama Missions POST] Error:", error);
    
    // Возвращаем детальную ошибку для отладки
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: "Failed to save mission",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorDetails : undefined,
      },
      { status: 500 }
    );
  }
}

