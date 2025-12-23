import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/investigations/[slug]
 * Возвращает детали расследования с эпизодами и прогрессом
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  const { slug } = await context.params;
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  try {
    // Получаем расследование со всеми связями
    const investigation = await prisma.investigation.findUnique({
      where: { slug },
      include: {
        episodes: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            title: true,
            description: true,
            type: true,
            minScore: true,
            timeLimit: true,
            xpReward: true,
            unlocksClue: true,
            // Не возвращаем content — он нужен только при прохождении
          },
        },
        suspects: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            photoUrl: true,
            // Не возвращаем isGuilty — это спойлер!
          },
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

    // Получаем прогресс пользователя
    const progress = await prisma.investigationProgress.findUnique({
      where: {
        userId_investigationId: {
          userId,
          investigationId: investigation.id,
        },
      },
      include: {
        episodeProgress: {
          select: {
            episodeId: true,
            status: true,
            score: true,
            completedAt: true,
          },
        },
      },
    });

    // Определяем какие эпизоды доступны
    const episodesWithProgress = investigation.episodes.map((episode, index) => {
      const epProgress = progress?.episodeProgress.find(
        ep => ep.episodeId === episode.id
      );
      
      // Эпизод доступен если:
      // 1. Это первый эпизод, или
      // 2. Предыдущий эпизод завершён
      let isAvailable = false;
      if (index === 0) {
        isAvailable = true;
      } else if (progress) {
        const prevEpisode = investigation.episodes[index - 1];
        const prevProgress = progress.episodeProgress.find(
          ep => ep.episodeId === prevEpisode.id
        );
        isAvailable = prevProgress?.status === "COMPLETED";
      }

      return {
        ...episode,
        isAvailable,
        progress: epProgress ? {
          status: epProgress.status,
          score: epProgress.score,
          completedAt: epProgress.completedAt,
        } : null,
      };
    });

    // Собранные улики
    const collectedClues = progress?.collectedClues as string[] ?? [];

    return NextResponse.json({
      investigation: {
        id: investigation.id,
        slug: investigation.slug,
        title: investigation.title,
        subtitle: investigation.subtitle,
        description: investigation.description,
        city: investigation.city,
        years: investigation.years,
        icon: investigation.icon,
        color: investigation.color,
        coverImage: investigation.coverImage,
        difficulty: investigation.difficulty,
        xpReward: investigation.xpReward,
      },
      episodes: episodesWithProgress,
      suspects: investigation.suspects,
      progress: progress ? {
        status: progress.status,
        currentEpisode: progress.currentEpisode,
        totalScore: progress.totalScore,
        collectedClues,
        suspectChoiceId: progress.suspectChoiceId,
        isCorrectChoice: progress.isCorrectChoice,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      } : null,
    });
  } catch (error) {
    console.error("[investigations/slug] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch investigation" },
      { status: 500 }
    );
  }
}
