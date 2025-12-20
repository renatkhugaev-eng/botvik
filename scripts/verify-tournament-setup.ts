/**
 * Проверка настройки турнира "Охота на психов"
 * Запуск: npx ts-node scripts/verify-tournament-setup.ts
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = 197; // Test user
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 ПРОВЕРКА НАСТРОЙКИ ТУРНИРА");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Находим турнир
  const tournament = await prisma.tournament.findFirst({
    where: { slug: "ohota-na-psihov-2025" },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          quiz: { 
            select: { 
              id: true, 
              title: true,
              isActive: true,
              questions: { select: { id: true } },
            } 
          },
        },
      },
      participants: {
        where: { userId },
        select: { status: true, currentStage: true, totalScore: true },
      },
    },
  });

  if (!tournament) {
    console.log("❌ Турнир не найден!");
    return;
  }

  console.log("📋 ТУРНИР:", tournament.title);
  console.log("   Статус:", tournament.status);
  console.log("   ID:", tournament.id);
  console.log("");

  // 2. Проверяем этапы
  console.log("📊 ЭТАПЫ:");
  for (const stage of tournament.stages) {
    const questionCount = stage.quiz?.questions.length ?? 0;
    const isActive = stage.quiz?.isActive ?? false;
    
    console.log(`\n   [Этап ${stage.order}] ${stage.title}`);
    console.log(`      Stage ID: ${stage.id}`);
    console.log(`      Quiz ID: ${stage.quizId}`);
    console.log(`      Quiz Title: ${stage.quiz?.title ?? "НЕ НАЙДЕН!"}`);
    console.log(`      Quiz Active: ${isActive ? "✅" : "❌"}`);
    console.log(`      Вопросов: ${questionCount}`);
    console.log(`      Множитель: ×${stage.scoreMultiplier}`);
  }

  // 3. Проверяем участие пользователя
  console.log("\n👤 УЧАСТИЕ USER 197:");
  const participant = tournament.participants[0];
  if (participant) {
    console.log(`   Статус: ${participant.status}`);
    console.log(`   Текущий этап: ${participant.currentStage}`);
    console.log(`   Очки: ${participant.totalScore}`);
  } else {
    console.log("   ❌ Не участвует!");
  }

  // 4. Проверяем результаты этапов
  console.log("\n📈 РЕЗУЛЬТАТЫ ЭТАПОВ USER 197:");
  const stageResults = await prisma.tournamentStageResult.findMany({
    where: {
      userId,
      stageId: { in: tournament.stages.map(s => s.id) },
    },
    include: {
      stage: { select: { order: true, title: true } },
    },
  });

  for (const stage of tournament.stages) {
    const result = stageResults.find(r => r.stageId === stage.id);
    console.log(`\n   [Этап ${stage.order}] ${stage.title}:`);
    if (result) {
      console.log(`      Score: ${result.score}`);
      console.log(`      Passed: ${result.passed ? "✅" : "❌"}`);
      console.log(`      CompletedAt: ${result.completedAt ? "✅ " + result.completedAt.toISOString() : "❌"}`);
    } else {
      console.log(`      ❌ Нет результата`);
    }
  }

  // 5. Симулируем запрос processTournamentStage
  console.log("\n🧪 СИМУЛЯЦИЯ processTournamentStage для Quiz 19:");
  
  const stage3 = tournament.stages.find(s => s.order === 3);
  if (!stage3) {
    console.log("   ❌ Этап 3 не найден!");
    return;
  }

  const now = new Date();
  
  // Проверяем что найдёт activeStage query
  const activeStage = await prisma.tournamentStage.findFirst({
    where: {
      AND: [
        { quizId: stage3.quizId },
        {
          tournament: {
            status: { in: ["ACTIVE", "FINISHED"] },
            participants: {
              some: {
                userId,
                status: { in: ["REGISTERED", "ACTIVE", "FINISHED"] },
              },
            },
          },
        },
        {
          OR: [
            { startsAt: null },
            { startsAt: { lte: now } },
          ],
        },
      ],
    },
    include: {
      tournament: {
        select: {
          id: true,
          status: true,
          stages: { orderBy: { order: "asc" }, select: { id: true, order: true } },
        },
      },
    },
  });

  if (activeStage) {
    console.log(`   ✅ activeStage найден: Stage ${activeStage.id} (order ${activeStage.order})`);
    console.log(`      Tournament ID: ${activeStage.tournament.id}`);
    console.log(`      Tournament Status: ${activeStage.tournament.status}`);
    
    // Проверяем предыдущие этапы
    const previousStages = activeStage.tournament.stages.filter(s => s.order < activeStage.order);
    console.log(`      Предыдущих этапов: ${previousStages.length}`);
    
    if (previousStages.length > 0) {
      const previousResults = await prisma.tournamentStageResult.findMany({
        where: {
          userId,
          stageId: { in: previousStages.map(s => s.id) },
          completedAt: { not: null },
        },
        select: { stageId: true, passed: true },
      });
      
      const completedIds = new Set(previousResults.map(r => r.stageId));
      const allCompleted = previousStages.every(s => completedIds.has(s.id));
      
      console.log(`      Завершено предыдущих: ${previousResults.length}/${previousStages.length}`);
      console.log(`      Все предыдущие завершены: ${allCompleted ? "✅" : "❌"}`);
      
      if (!allCompleted) {
        const missing = previousStages.filter(s => !completedIds.has(s.id));
        console.log(`      ⚠️ Не завершены: ${missing.map(s => `Stage ${s.id}`).join(", ")}`);
      }
    }
  } else {
    console.log("   ❌ activeStage НЕ НАЙДЕН!");
    console.log("      Это означает что processTournamentStage вернёт null!");
    
    // Диагностика почему не найден
    const rawStage = await prisma.tournamentStage.findFirst({
      where: { quizId: stage3.quizId },
      include: {
        tournament: {
          select: {
            status: true,
            participants: { where: { userId }, select: { status: true } },
          },
        },
      },
    });
    
    if (rawStage) {
      console.log(`\n   📋 Диагностика:`);
      console.log(`      Stage exists: ✅ (ID ${rawStage.id})`);
      console.log(`      Tournament status: ${rawStage.tournament.status}`);
      console.log(`      Participant: ${rawStage.tournament.participants[0]?.status ?? "НЕТ"}`);
      console.log(`      startsAt: ${rawStage.startsAt?.toISOString() ?? "null"}`);
      console.log(`      Now: ${now.toISOString()}`);
      
      if (rawStage.startsAt && rawStage.startsAt > now) {
        console.log(`      ⚠️ Этап ещё не начался!`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
