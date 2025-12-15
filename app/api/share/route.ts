import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════════════
   SHARE API — Генерирует данные для красивой карточки результата
   
   Используется для:
   - Шаринга в Telegram Stories
   - Отправки друзьям
   - Сохранения как изображение
═══════════════════════════════════════════════════════════════════════════ */

type ShareRequest = {
  sessionId?: number;
  userId?: number;
};

export async function POST(req: NextRequest) {
  let body: ShareRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { sessionId, userId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId_required" }, { status: 400 });
  }

  // Получаем сессию с деталями
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

  // Проверяем, что это сессия текущего пользователя (если передан userId)
  if (userId && session.userId !== userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  // Расчёт статистики
  const totalQuestions = session.answers.length;
  const correctAnswers = session.answers.filter(a => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  // Звёзды (1-5 на основе accuracy)
  const stars = accuracy >= 90 ? 5 : accuracy >= 70 ? 4 : accuracy >= 50 ? 3 : accuracy >= 30 ? 2 : 1;

  // Позиция в лидерборде (используем формулу Best + Activity)
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

  // Получаем позицию
  let rank: number | null = null;
  let totalPlayers = 0;

  if (leaderboardEntry) {
    // Рассчитываем total score пользователя
    const myTotalScore = leaderboardEntry.bestScore + Math.min(leaderboardEntry.attempts * 50, 500);
    
    // Получаем все записи для этого квиза и считаем сколько выше
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

  // Формируем данные для карточки
  const shareData = {
    // Основная информация
    quizTitle: session.quiz.title,
    prizeTitle: session.quiz.prizeTitle,
    
    // Игрок
    playerName: session.user.firstName || session.user.username || "Игрок",
    
    // Результаты
    score: session.totalScore,
    correctAnswers,
    totalQuestions,
    accuracy,
    stars,
    attemptNumber: session.attemptNumber,
    
    // Лидерборд
    rank,
    totalPlayers,
    
    // Мета
    finishedAt: session.finishedAt?.toISOString(),
    
    // Текст для шаринга
    shareText: generateShareText({
      quizTitle: session.quiz.title,
      score: session.totalScore,
      correctAnswers,
      totalQuestions,
      accuracy,
      stars,
      rank,
    }),
    
    // Deep link для приглашения
    inviteLink: `https://t.me/truecrimetg_bot/app?startapp=quiz_${session.quizId}`,
  };

  return NextResponse.json(shareData);
}

// Генерация текста для шаринга
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

