import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * POST /api/investigations/[slug]/start
 * Начинает расследование для пользователя
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  const { slug } = await context.params;
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  try {
    // Получаем расследование
    const investigation = await prisma.investigation.findUnique({
      where: { slug },
      include: {
        episodes: {
          orderBy: { order: "asc" },
          take: 1, // Только первый эпизод
          select: { id: true, order: true, title: true },
        },
      },
    });

    if (!investigation) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 }
      );
    }

    if (!investigation.isActive) {
      return NextResponse.json(
        { error: "Investigation is not available" },
        { status: 403 }
      );
    }

    // Проверяем, не начато ли уже
    const existingProgress = await prisma.investigationProgress.findUnique({
      where: {
        userId_investigationId: {
          userId,
          investigationId: investigation.id,
        },
      },
    });

    if (existingProgress) {
      // Уже начато — возвращаем текущий прогресс
      return NextResponse.json({
        message: "Investigation already started",
        progress: existingProgress,
        firstEpisode: investigation.episodes[0],
      });
    }

    // BACKLOG: Add proper unlock verification before starting
    // Should check: level requirement, Stars purchase, achievement unlock
    // Currently skipped - all investigations are startable
    // See: app/api/investigations/route.ts for unlock logic

    // Создаём прогресс
    const progress = await prisma.investigationProgress.create({
      data: {
        userId,
        investigationId: investigation.id,
        status: "IN_PROGRESS",
        currentEpisode: 1,
        collectedClues: [],
      },
    });

    // Создаём прогресс для первого эпизода
    const firstEpisode = investigation.episodes[0];
    if (firstEpisode) {
      await prisma.episodeProgress.create({
        data: {
          investigationProgressId: progress.id,
          episodeId: firstEpisode.id,
          status: "NOT_STARTED",
        },
      });
    }

    console.log(`[investigations/start] User ${userId} started investigation "${slug}"`);

    return NextResponse.json({
      message: "Investigation started",
      progress: {
        id: progress.id,
        status: progress.status,
        currentEpisode: progress.currentEpisode,
      },
      firstEpisode: firstEpisode ? {
        id: firstEpisode.id,
        order: firstEpisode.order,
        title: firstEpisode.title,
      } : null,
    });
  } catch (error) {
    console.error("[investigations/start] Error:", error);
    return NextResponse.json(
      { error: "Failed to start investigation" },
      { status: 500 }
    );
  }
}
