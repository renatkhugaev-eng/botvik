/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARE API — Generate beautiful share card data
 * Best practices 2025: Authentication, rate limiting, Zod validation
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, generalLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { validate } from "@/lib/validation";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const ShareRequestSchema = z.object({
  sessionId: z.number().int().positive("Session ID must be a positive integer"),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/share — Generate share data for a quiz session
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(generalLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ VALIDATE BODY ═══
  const body = await validate(req, ShareRequestSchema);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error, details: body.details },
      { status: 400 }
    );
  }

  const { sessionId } = body.data;

  try {
    // ═══ FETCH SESSION ═══
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            prizeTitle: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
          },
        },
        answers: {
          select: {
            isCorrect: true,
            scoreDelta: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    // ═══ VERIFY OWNERSHIP ═══
    if (session.userId !== auth.user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // ═══ CALCULATE STATISTICS ═══
    const totalQuestions = session.answers.length;
    const correctAnswers = session.answers.filter((a) => a.isCorrect).length;
    const accuracy = totalQuestions > 0 
      ? Math.round((correctAnswers / totalQuestions) * 100) 
      : 0;

    // Stars (1-5 based on accuracy)
    const stars = accuracy >= 90 ? 5 
      : accuracy >= 70 ? 4 
      : accuracy >= 50 ? 3 
      : accuracy >= 30 ? 2 
      : 1;

    // ═══ GET LEADERBOARD POSITION ═══
    const leaderboardEntry = await prisma.leaderboardEntry.findUnique({
      where: {
        userId_quizId_periodType: {
          userId: session.userId,
          quizId: session.quizId,
          periodType: "ALL_TIME",
        },
      },
      select: { bestScore: true, attempts: true },
    });

    let rank: number | null = null;
    let totalPlayers = 0;

    if (leaderboardEntry) {
      // Calculate user's total score
      const myTotalScore = leaderboardEntry.bestScore + 
        Math.min(leaderboardEntry.attempts * 50, 500);

      // Get all entries and count how many are higher
      const allEntries = await prisma.leaderboardEntry.findMany({
        where: {
          quizId: session.quizId,
          periodType: "ALL_TIME",
        },
        select: { bestScore: true, attempts: true },
      });

      let higherCount = 0;
      for (const entry of allEntries) {
        const entryTotalScore = entry.bestScore + Math.min(entry.attempts * 50, 500);
        if (entryTotalScore > myTotalScore) {
          higherCount++;
        }
      }

      rank = higherCount + 1;
      totalPlayers = allEntries.length;
    }

    // ═══ BUILD SHARE DATA ═══
    const shareData = {
      // Quiz info
      quizTitle: session.quiz.title,
      prizeTitle: session.quiz.prizeTitle,

      // Player
      playerName: session.user.firstName || session.user.username || "Игрок",

      // Results
      score: session.totalScore,
      correctAnswers,
      totalQuestions,
      accuracy,
      stars,
      attemptNumber: session.attemptNumber,

      // Leaderboard
      rank,
      totalPlayers,

      // Meta
      finishedAt: session.finishedAt?.toISOString(),

      // Share text
      shareText: generateShareText({
        quizTitle: session.quiz.title,
        score: session.totalScore,
        correctAnswers,
        totalQuestions,
        accuracy,
        stars,
        rank,
      }),

      // Deep link
      inviteLink: `https://t.me/truecrimetg_bot/app?startapp=quiz_${session.quizId}`,
    };

    return NextResponse.json(shareData);
    
  } catch (error) {
    console.error("[share] Error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Generate share text
// ═══════════════════════════════════════════════════════════════════════════

function generateShareText(params: {
  quizTitle: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  stars: number;
  rank: number | null;
}): string {
  const { quizTitle, score, correctAnswers, totalQuestions, accuracy, stars, rank } = params;

  const starEmoji = "⭐".repeat(stars) + "☆".repeat(5 - stars);

  let text = `🎮 ${quizTitle}\n\n`;
  text += `${starEmoji}\n\n`;
  text += `📊 Мой результат:\n`;
  text += `✅ ${correctAnswers}/${totalQuestions} правильных\n`;
  text += `🎯 ${accuracy}% точность\n`;
  text += `🏆 ${score.toLocaleString()} очков\n`;

  if (rank) {
    text += `\n🥇 #${rank} в рейтинге\n`;
  }

  text += `\n💀 Попробуй побить мой рекорд!`;

  return text;
}
