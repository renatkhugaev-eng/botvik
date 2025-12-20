/**
 * Проверка турнирного статуса для конкретного пользователя
 * Запуск: npx ts-node scripts/check-my-tournament.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = parseInt(process.argv[2] || "0");
  
  if (!userId) {
    // Показываем всех пользователей с бонусной энергией
    console.log("\n🔍 Поиск пользователей с бонусной энергией...\n");
    
    const users = await prisma.user.findMany({
      where: { bonusEnergy: { gt: 0 } },
      select: { id: true, username: true, firstName: true, bonusEnergy: true },
      take: 20,
    });
    
    if (users.length === 0) {
      console.log("Нет пользователей с бонусной энергией.");
    } else {
      for (const u of users) {
        console.log(`  User ${u.id}: ${u.firstName ?? u.username ?? "?"} — bonusEnergy: ${u.bonusEnergy}`);
      }
    }
    
    console.log("\n📋 Использование: npx ts-node scripts/check-my-tournament.ts <userId>");
    console.log("   Пример: npx ts-node scripts/check-my-tournament.ts 197\n");
    return;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`🔍 ПРОВЕРКА ТУРНИРНОГО СТАТУСА USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Информация о пользователе
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      username: true, 
      firstName: true,
      bonusEnergy: true,
      dailyRewardStreak: true,
      lastDailyRewardAt: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  console.log("👤 ПОЛЬЗОВАТЕЛЬ:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Имя: ${user.firstName ?? user.username ?? "—"}`);
  console.log(`   Бонусная энергия: ${user.bonusEnergy}`);
  console.log(`   Daily Streak: ${user.dailyRewardStreak}`);
  console.log(`   Last Daily: ${user.lastDailyRewardAt?.toISOString() ?? "—"}`);

  // 2. Участие в турнире
  console.log("\n🏆 ТУРНИР 'ОХОТА НА ПСИХОВ':");
  
  const tournament = await prisma.tournament.findFirst({
    where: { slug: "ohota-na-psihov-2025" },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          quiz: { select: { id: true, title: true } },
        },
      },
      participants: {
        where: { userId },
      },
    },
  });

  if (!tournament) {
    console.log("   ❌ Турнир не найден!");
    return;
  }

  console.log(`   ID: ${tournament.id}, Статус: ${tournament.status}`);

  const participant = tournament.participants[0];
  if (participant) {
    console.log(`\n   ✅ Участвует!`);
    console.log(`      Статус: ${participant.status}`);
    console.log(`      Очки: ${participant.totalScore}`);
    console.log(`      Текущий этап: ${participant.currentStage}`);
  } else {
    console.log(`\n   ❌ НЕ УЧАСТВУЕТ в турнире!`);
    console.log(`   Это причина почему тратится энергия — нужно зарегистрироваться.`);
    return;
  }

  // 3. Результаты этапов
  console.log("\n📊 ЭТАПЫ И РЕЗУЛЬТАТЫ:");
  
  for (const stage of tournament.stages) {
    const result = await prisma.tournamentStageResult.findUnique({
      where: { stageId_userId: { stageId: stage.id, userId } },
    });

    console.log(`\n   [Этап ${stage.order}] ${stage.title}`);
    console.log(`      Stage ID: ${stage.id}, Quiz ID: ${stage.quizId}`);
    console.log(`      Quiz: ${stage.quiz?.title ?? "НЕТ"}`);
    
    if (result) {
      console.log(`      Результат: Score=${result.score}, Passed=${result.passed ? "✅" : "❌"}`);
      console.log(`      CompletedAt: ${result.completedAt?.toISOString() ?? "❌ НЕ ЗАВЕРШЁН"}`);
    } else {
      console.log(`      ❌ Результат отсутствует`);
    }
  }

  // 4. Симуляция проверки для этапа 3
  console.log("\n🧪 СИМУЛЯЦИЯ isTournamentQuiz для Quiz 19 (этап 3):");
  
  const stage3 = tournament.stages.find(s => s.order === 3);
  if (!stage3) {
    console.log("   ❌ Этап 3 не найден!");
    return;
  }

  // Условие 1: isValidParticipant
  const isValidParticipant = ["REGISTERED", "ACTIVE", "FINISHED"].includes(participant.status);
  console.log(`\n   1. isValidParticipant: ${isValidParticipant ? "✅" : "❌"} (status=${participant.status})`);

  // Условие 2: isWithinTimeWindow
  const now = new Date();
  const isWithinTimeWindow = tournament.status === "ACTIVE" || 
    (tournament.status === "FINISHED" && tournament.endsAt && now <= tournament.endsAt);
  console.log(`   2. isWithinTimeWindow: ${isWithinTimeWindow ? "✅" : "❌"} (tournament.status=${tournament.status})`);

  // Условие 3: previousStagesPassed
  const previousStages = tournament.stages.filter(s => s.order < stage3.order);
  const previousResults = await prisma.tournamentStageResult.findMany({
    where: {
      userId,
      stageId: { in: previousStages.map(s => s.id) },
      completedAt: { not: null },
    },
  });
  
  const completedIds = new Set(previousResults.map(r => r.stageId));
  const previousStagesPassed = previousStages.every(s => completedIds.has(s.id));
  
  console.log(`   3. previousStagesPassed: ${previousStagesPassed ? "✅" : "❌"}`);
  console.log(`      Нужно завершить: ${previousStages.map(s => `Stage ${s.id}`).join(", ")}`);
  console.log(`      Завершено: ${[...completedIds].join(", ") || "ничего"}`);
  
  if (!previousStagesPassed) {
    const missing = previousStages.filter(s => !completedIds.has(s.id));
    console.log(`      ⚠️ ОТСУТСТВУЮТ: ${missing.map(s => `[Этап ${s.order}] ${s.title}`).join(", ")}`);
  }

  // Финальный результат
  const isTournamentQuiz = isValidParticipant && isWithinTimeWindow && previousStagesPassed;
  
  console.log(`\n   📌 ИТОГ: isTournamentQuiz = ${isTournamentQuiz ? "✅ TRUE" : "❌ FALSE"}`);
  
  if (!isTournamentQuiz) {
    console.log("\n   ⚠️ ПРИЧИНА ТРАТЫ ЭНЕРГИИ:");
    if (!isValidParticipant) console.log("      - Неверный статус участника");
    if (!isWithinTimeWindow) console.log("      - Турнир завершён или время вышло");
    if (!previousStagesPassed) console.log("      - Не пройдены предыдущие этапы");
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
