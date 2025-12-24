/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DELETE /api/me/delete — GDPR Account Deletion
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Полное удаление аккаунта пользователя и всех связанных данных.
 * Соответствует требованиям GDPR Article 17 (Right to Erasure).
 * 
 * Что удаляется:
 * - Профиль пользователя
 * - Все игровые сессии и ответы
 * - Записи в лидербордах
 * - Достижения
 * - Друзья и заявки
 * - Сообщения в чате
 * - Покупки и инвентарь
 * - Активность
 * 
 * Что НЕ удаляется (анонимизируется):
 * - Агрегированная статистика (без привязки к пользователю)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, generalLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const log = logger.child({ route: "me/delete" });

export async function DELETE(req: NextRequest) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  // ═══ RATE LIMITING (strict - 1 request per hour) ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(generalLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ CONFIRMATION CHECK ═══
  // Требуем подтверждение в теле запроса
  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.confirm !== true) {
    return NextResponse.json({
      error: "confirmation_required",
      message: "Для удаления аккаунта необходимо отправить { confirm: true }",
    }, { status: 400 });
  }

  log.info("Account deletion requested", { userId });

  try {
    // ═══ TRANSACTIONAL DELETE ═══
    // Удаляем все данные в одной транзакции
    await prisma.$transaction(async (tx) => {
      // 1. Удаляем ответы на вопросы
      await tx.answer.deleteMany({
        where: { session: { userId } },
      });

      // 2. Удаляем сессии квизов
      await tx.quizSession.deleteMany({
        where: { userId },
      });

      // 3. Удаляем записи лидерборда
      await tx.leaderboardEntry.deleteMany({
        where: { userId },
      });

      // 4. Удаляем weekly scores
      await tx.weeklyScore.deleteMany({
        where: { userId },
      });

      // 5. Удаляем weekly wins
      await tx.weeklyWinner.deleteMany({
        where: { userId },
      });

      // 6. Удаляем достижения
      await tx.userAchievement.deleteMany({
        where: { userId },
      });

      // 7. Удаляем дружбу (обе стороны)
      await tx.friendship.deleteMany({
        where: {
          OR: [{ userId }, { friendId: userId }],
        },
      });

      // 8. Удаляем реакции на сообщения
      await tx.messageReaction.deleteMany({
        where: { userId },
      });

      // 9. Удаляем сообщения чата
      await tx.chatMessage.deleteMany({
        where: { userId },
      });

      // 10. Удаляем инвентарь
      await tx.userInventory.deleteMany({
        where: { userId },
      });

      // 11. Удаляем покупки
      await tx.purchase.deleteMany({
        where: { userId },
      });

      // 12. Удаляем турнирные результаты
      await tx.tournamentStageResult.deleteMany({
        where: { userId },
      });

      // 13. Удаляем турнирное участие
      await tx.tournamentParticipant.deleteMany({
        where: { userId },
      });

      // 14. Обнуляем winnerId в турнирных призах (не удаляем сами призы)
      await tx.tournamentPrize.updateMany({
        where: { winnerId: userId },
        data: { winnerId: null },
      });

      // 15. Удаляем запланированные уведомления
      await tx.scheduledNotification.deleteMany({
        where: { userId },
      });

      // 16. Удаляем активность
      await tx.userActivity.deleteMany({
        where: { userId },
      });

      // 17. Удаляем прогресс расследований
      // Сначала episodeProgress, потом investigationProgress
      const investigations = await tx.investigationProgress.findMany({
        where: { userId },
        select: { id: true },
      });
      
      for (const inv of investigations) {
        await tx.episodeProgress.deleteMany({
          where: { investigationProgressId: inv.id },
        });
      }
      
      await tx.investigationProgress.deleteMany({
        where: { userId },
      });

      // 18. Удаляем ответы в дуэлях
      await tx.duelAnswer.deleteMany({
        where: {
          duel: {
            OR: [{ challengerId: userId }, { opponentId: userId }],
          },
        },
      });

      // 19. Удаляем дуэли
      await tx.duel.deleteMany({
        where: {
          OR: [{ challengerId: userId }, { opponentId: userId }],
        },
      });

      // 20. Обнуляем referredById у рефералов (не удаляем их аккаунты)
      await tx.user.updateMany({
        where: { referredById: userId },
        data: { referredById: null },
      });

      // 21. Наконец, удаляем самого пользователя
      await tx.user.delete({
        where: { id: userId },
      });
    });

    log.info("Account deleted successfully", { userId });

    return NextResponse.json({
      ok: true,
      message: "Ваш аккаунт и все данные были удалены",
      deletedAt: new Date().toISOString(),
    });

  } catch (error) {
    log.error("Failed to delete account", { userId, error });
    
    return NextResponse.json({
      error: "deletion_failed",
      message: "Не удалось удалить аккаунт. Попробуйте позже.",
    }, { status: 500 });
  }
}

// ═══ GET — Information about deletion ═══
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    endpoint: "DELETE /api/me/delete",
    description: "Полное удаление аккаунта и всех данных (GDPR Article 17)",
    requirements: {
      method: "DELETE",
      body: { confirm: true },
      authentication: "Required (Telegram initData)",
    },
    dataDeleted: [
      "Профиль пользователя",
      "Игровые сессии и ответы",
      "Записи в лидербордах",
      "Достижения",
      "Друзья и заявки",
      "Сообщения в чате",
      "Покупки и инвентарь",
      "Прогресс расследований",
      "Дуэли",
      "Активность",
    ],
    warning: "Это действие необратимо!",
  });
}

