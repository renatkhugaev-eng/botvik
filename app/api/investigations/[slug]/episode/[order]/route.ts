import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

type RouteContext = { params: Promise<{ slug: string; order: string }> };

/**
 * GET /api/investigations/[slug]/episode/[order]
 * Возвращает содержимое эпизода для прохождения
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  const { slug, order } = await context.params;
  const episodeOrder = parseInt(order);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  if (isNaN(episodeOrder)) {
    return NextResponse.json({ error: "Invalid episode order" }, { status: 400 });
  }

  try {
    // Получаем расследование и эпизод
    const investigation = await prisma.investigation.findUnique({
      where: { slug },
      select: { id: true, title: true },
    });

    if (!investigation) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    const episode = await prisma.investigationEpisode.findFirst({
      where: {
        investigationId: investigation.id,
        order: episodeOrder,
      },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    // Проверяем прогресс пользователя
    const progress = await prisma.investigationProgress.findUnique({
      where: {
        userId_investigationId: {
          userId,
          investigationId: investigation.id,
        },
      },
      include: {
        episodeProgress: true,
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "Start the investigation first" },
        { status: 403 }
      );
    }

    // Проверяем, доступен ли этот эпизод
    if (episodeOrder > 1) {
      const prevEpisode = await prisma.investigationEpisode.findFirst({
        where: {
          investigationId: investigation.id,
          order: episodeOrder - 1,
        },
      });

      if (prevEpisode) {
        const prevProgress = progress.episodeProgress.find(
          ep => ep.episodeId === prevEpisode.id
        );
        
        if (!prevProgress || prevProgress.status !== "COMPLETED") {
          return NextResponse.json(
            { error: "Complete previous episode first" },
            { status: 403 }
          );
        }
      }
    }

    // Получаем или создаём прогресс эпизода
    let episodeProgress = progress.episodeProgress.find(
      ep => ep.episodeId === episode.id
    );

    if (!episodeProgress) {
      episodeProgress = await prisma.episodeProgress.create({
        data: {
          investigationProgressId: progress.id,
          episodeId: episode.id,
          status: "IN_PROGRESS",
        },
      });
    } else if (episodeProgress.status === "NOT_STARTED") {
      episodeProgress = await prisma.episodeProgress.update({
        where: { id: episodeProgress.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return NextResponse.json({
      episode: {
        id: episode.id,
        order: episode.order,
        title: episode.title,
        description: episode.description,
        type: episode.type,
        content: episode.content, // Полный контент эпизода
        minScore: episode.minScore,
        timeLimit: episode.timeLimit,
        xpReward: episode.xpReward,
      },
      progress: {
        status: episodeProgress.status,
        score: episodeProgress.score,
        choices: episodeProgress.choices,
      },
      investigation: {
        title: investigation.title,
        collectedClues: progress.collectedClues,
      },
    });
  } catch (error) {
    console.error("[investigations/episode] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch episode" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/investigations/[slug]/episode/[order]
 * Отправляет ответы/результат эпизода
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  const { slug, order } = await context.params;
  const episodeOrder = parseInt(order);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;

  try {
    const body = await req.json();
    const { score, choices, answers, timeSpent } = body as {
      score?: number;
      choices?: Record<string, string>;
      answers?: Record<string, unknown>;
      timeSpent?: number;
    };

    // Получаем расследование
    const investigation = await prisma.investigation.findUnique({
      where: { slug },
      include: {
        episodes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!investigation) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    const episode = investigation.episodes.find(e => e.order === episodeOrder);
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    // Получаем прогресс
    const progress = await prisma.investigationProgress.findUnique({
      where: {
        userId_investigationId: {
          userId,
          investigationId: investigation.id,
        },
      },
      include: {
        episodeProgress: true,
      },
    });

    if (!progress) {
      return NextResponse.json({ error: "Start the investigation first" }, { status: 403 });
    }

    const episodeProgress = progress.episodeProgress.find(
      ep => ep.episodeId === episode.id
    );

    if (!episodeProgress) {
      return NextResponse.json({ error: "Episode not started" }, { status: 403 });
    }

    // Обновляем прогресс эпизода
    const updatedEpisodeProgress = await prisma.episodeProgress.update({
      where: { id: episodeProgress.id },
      data: {
        status: "COMPLETED",
        score: score ?? 0,
        choices: choices ?? undefined,
        answers: answers ?? undefined,
        timeSpentSeconds: timeSpent ?? 0,
        completedAt: new Date(),
      },
    });

    // Добавляем улику если есть
    let newClues: string[] = progress.collectedClues as string[] ?? [];
    if (episode.unlocksClue) {
      if (!newClues.includes(episode.unlocksClue)) {
        newClues = [...newClues, episode.unlocksClue];
      }
    }

    // Проверяем, есть ли следующий эпизод
    const nextEpisode = investigation.episodes.find(e => e.order === episodeOrder + 1);
    const isLastEpisode = !nextEpisode;

    // Обновляем общий прогресс расследования
    const newTotalScore = progress.totalScore + (score ?? 0);
    const newCurrentEpisode = isLastEpisode ? episodeOrder : episodeOrder + 1;

    await prisma.investigationProgress.update({
      where: { id: progress.id },
      data: {
        totalScore: newTotalScore,
        currentEpisode: newCurrentEpisode,
        collectedClues: newClues,
        // Если это последний эпизод типа DEDUCTION, нужно обработать отдельно
        status: isLastEpisode && episode.type !== "DEDUCTION" ? "COMPLETED" : "IN_PROGRESS",
        completedAt: isLastEpisode && episode.type !== "DEDUCTION" ? new Date() : undefined,
      },
    });

    // Начисляем XP за эпизод
    if (episode.xpReward > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { xp: { increment: episode.xpReward } },
      });
    }

    console.log(
      `[investigations/episode] User ${userId} completed episode ${episodeOrder} ` +
      `of "${slug}" with score ${score}`
    );

    return NextResponse.json({
      success: true,
      episodeProgress: {
        status: updatedEpisodeProgress.status,
        score: updatedEpisodeProgress.score,
      },
      unlockedClue: episode.unlocksClue,
      xpEarned: episode.xpReward,
      nextEpisode: nextEpisode ? {
        order: nextEpisode.order,
        title: nextEpisode.title,
      } : null,
      isLastEpisode,
    });
  } catch (error) {
    console.error("[investigations/episode] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to complete episode" },
      { status: 500 }
    );
  }
}
