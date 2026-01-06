/**
 * TEST: Send All Notification Types
 * 
 * POST /api/notifications/test
 * Отправляет все типы уведомлений для тестирования
 * 
 * Только для админов!
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import {
  notifyLevelUp,
  notifyEnergyFull,
  notifyDailyReminder,
  notifyLeaderboardChange,
  notifyWeeklyWinner,
  notifyDuelChallenge,
  notifyDuelResult,
  notifyTournamentWinner,
  notifyTournamentFinished,
  notifyTournamentStarting,
} from "@/lib/notifications";

export const runtime = "nodejs";

// Типы уведомлений для теста
const TEST_NOTIFICATIONS = [
  {
    id: "level_up",
    name: "Level Up",
    description: "Повышение уровня",
  },
  {
    id: "energy_full",
    name: "Energy Full",
    description: "Энергия восстановлена",
  },
  {
    id: "daily_reminder",
    name: "Daily Reminder",
    description: "Ежедневное напоминание",
  },
  {
    id: "leaderboard_change",
    name: "Leaderboard Change",
    description: "Изменение в рейтинге",
  },
  {
    id: "weekly_winner",
    name: "Weekly Winner",
    description: "Победитель недели",
  },
  {
    id: "duel_challenge",
    name: "Duel Challenge",
    description: "Вызов на дуэль",
  },
  {
    id: "duel_result",
    name: "Duel Result",
    description: "Результат дуэли",
  },
  {
    id: "tournament_winner",
    name: "Tournament Winner",
    description: "Победитель турнира",
  },
  {
    id: "tournament_finished",
    name: "Tournament Finished",
    description: "Турнир завершён",
  },
  {
    id: "tournament_starting",
    name: "Tournament Starting",
    description: "Турнир начинается",
  },
];

export async function GET(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    usage: "POST /api/notifications/test с телом { types: ['level_up', 'energy_full', ...] }",
    available_types: TEST_NOTIFICATIONS,
    example: {
      types: ["level_up", "energy_full", "daily_reminder"],
    },
    note: "Отправит тестовые уведомления ТЕБЕ (админу)",
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;
  
  try {
    const body = await req.json();
    const types: string[] = body.types || ["all"];
    
    const results: Record<string, { success: boolean; error?: string }> = {};
    
    // Определяем какие типы отправлять
    const typesToSend = types.includes("all") 
      ? TEST_NOTIFICATIONS.map(t => t.id)
      : types;

    for (const type of typesToSend) {
      try {
        let success = false;

        switch (type) {
          case "level_up":
            success = await notifyLevelUp(userId, 10, "Детектив", 150);
            break;

          case "energy_full":
            success = await notifyEnergyFull(userId, 5, 5);
            break;

          case "daily_reminder":
            success = await notifyDailyReminder(userId, 5, 1000);
            break;

          case "leaderboard_change":
            success = await notifyLeaderboardChange(userId, "up", 3, "TestPlayer", 500);
            break;

          case "weekly_winner":
            success = await notifyWeeklyWinner(
              userId,
              1,
              1500,
              10,
              500,
              "+100 XP бонус!"
            );
            break;

          case "duel_challenge":
            await notifyDuelChallenge(userId, {
              duelId: "test-duel-123",
              challengerName: "TestChallenger",
              quizTitle: "Тестовый квиз",
              xpReward: 50,
            });
            success = true;
            break;

          case "duel_result":
            await notifyDuelResult(userId, {
              duelId: "test-duel-123",
              opponentName: "TestOpponent",
              isWinner: true,
              isDraw: false,
              myScore: 500,
              opponentScore: 400,
              xpEarned: 50,
            });
            success = true;
            break;

          case "tournament_winner":
            await notifyTournamentWinner(userId, {
              tournamentTitle: "Тестовый турнир",
              tournamentSlug: "test-tournament",
              place: 1,
              score: 2000,
              totalParticipants: 100,
              xpAwarded: 500,
              prizeTitle: "Золотая рамка",
            });
            success = true;
            break;

          case "tournament_finished":
            await notifyTournamentFinished(userId, {
              tournamentTitle: "Тестовый турнир",
              tournamentSlug: "test-tournament",
              rank: 5,
              score: 1500,
              totalParticipants: 100,
              stagesCompleted: 3,
              totalStages: 3,
            });
            success = true;
            break;

          case "tournament_starting":
            await notifyTournamentStarting(userId, {
              tournamentTitle: "Новый турнир",
              tournamentSlug: "new-tournament",
              startsIn: "через 30 минут",
              isRegistered: true,
              participantsCount: 50,
              prizePool: "500 XP + уникальная рамка",
            });
            success = true;
            break;

          default:
            results[type] = { success: false, error: "Unknown type" };
            continue;
        }

        results[type] = { success };
        
        // Небольшая задержка между уведомлениями
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        results[type] = { 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        };
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    const failCount = Object.values(results).filter(r => !r.success).length;

    return NextResponse.json({
      ok: true,
      summary: {
        total: Object.keys(results).length,
        success: successCount,
        failed: failCount,
      },
      results,
      note: failCount > 0 
        ? "Некоторые уведомления не отправлены. Проверьте настройки или rate limit."
        : "Все уведомления отправлены!",
    });

  } catch (error) {
    console.error("[notifications/test] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send test notifications" },
      { status: 500 }
    );
  }
}

