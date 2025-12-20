/**
 * Диагностика турнира "Охота на психов"
 * Запуск: npx ts-node scripts/diagnose-tournament.ts
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Create .env file with DATABASE_URL.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = parseInt(process.argv[2] || "0");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 ДИАГНОСТИКА ТУРНИРА 'ОХОТА НА ПСИХОВ'");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Находим турнир
  const tournament = await prisma.tournament.findFirst({
    where: { 
      OR: [
        { slug: "ohota-na-psihov-2025" },
        { title: { contains: "Охота на психов" } },
      ]
    },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          quiz: { select: { id: true, title: true } },
        },
      },
      participants: userId ? {
        where: { userId },
      } : {
        take: 5,
      },
      _count: { select: { participants: true } },
    },
  });

  if (!tournament) {
    console.log("❌ Турнир не найден!");
    return;
  }

  console.log("📋 ТУРНИР:");
  console.log(`   ID: ${tournament.id}`);
  console.log(`   Название: ${tournament.title}`);
  console.log(`   Slug: ${tournament.slug}`);
  console.log(`   Статус: ${tournament.status}`);
  console.log(`   Начало: ${tournament.startsAt.toISOString()}`);
  console.log(`   Конец: ${tournament.endsAt.toISOString()}`);
  console.log(`   Сейчас: ${new Date().toISOString()}`);
  console.log(`   Участников: ${tournament._count.participants}`);
  console.log("");

  // Проверяем время
  const now = new Date();
  const isBeforeStart = now < tournament.startsAt;
  const isAfterEnd = now > tournament.endsAt;
  const isWithinTime = !isBeforeStart && !isAfterEnd;
  
  console.log("⏰ ВРЕМЯ:");
  console.log(`   До начала: ${isBeforeStart ? "ДА ⚠️" : "НЕТ ✅"}`);
  console.log(`   После конца: ${isAfterEnd ? "ДА ⚠️" : "НЕТ ✅"}`);
  console.log(`   В пределах времени: ${isWithinTime ? "ДА ✅" : "НЕТ ⚠️"}`);
  console.log("");

  // 2. Этапы
  console.log("📊 ЭТАПЫ:");
  for (const stage of tournament.stages) {
    console.log(`\n   [Этап ${stage.order}] ${stage.title}`);
    console.log(`      ID: ${stage.id}`);
    console.log(`      Quiz ID: ${stage.quizId} (${stage.quiz?.title ?? "—"})`);
    console.log(`      Множитель: ×${stage.scoreMultiplier}`);
    console.log(`      topN: ${stage.topN ?? "все"}`);
    console.log(`      minScore: ${stage.minScore ?? "нет"}`);
    console.log(`      Начало этапа: ${stage.startsAt?.toISOString() ?? "как турнир"}`);
    console.log(`      Конец этапа: ${stage.endsAt?.toISOString() ?? "как турнир"}`);
  }
  console.log("");

  // 3. Участие пользователя
  if (userId) {
    console.log(`👤 УЧАСТИЕ ПОЛЬЗОВАТЕЛЯ ${userId}:`);
    
    const participant = tournament.participants[0];
    if (participant) {
      console.log(`   Статус: ${participant.status}`);
      console.log(`   Очки: ${participant.totalScore}`);
      console.log(`   Текущий этап: ${participant.currentStage}`);
      console.log(`   Ранг: ${participant.rank ?? "—"}`);
      console.log(`   Присоединился: ${participant.joinedAt.toISOString()}`);
    } else {
      console.log(`   ❌ Пользователь НЕ участвует в турнире!`);
    }
    console.log("");

    // Результаты этапов
    console.log("📈 РЕЗУЛЬТАТЫ ЭТАПОВ:");
    const stageResults = await prisma.tournamentStageResult.findMany({
      where: {
        userId,
        stageId: { in: tournament.stages.map(s => s.id) },
      },
      orderBy: { stage: { order: "asc" } },
      include: {
        stage: { select: { order: true, title: true } },
      },
    });

    for (const stage of tournament.stages) {
      const result = stageResults.find(r => r.stageId === stage.id);
      console.log(`\n   [Этап ${stage.order}] ${stage.title}:`);
      if (result) {
        console.log(`      Score: ${result.score}`);
        console.log(`      Rank: ${result.rank ?? "—"}`);
        console.log(`      Passed: ${result.passed ? "✅ ДА" : "❌ НЕТ"}`);
        console.log(`      CompletedAt: ${result.completedAt?.toISOString() ?? "❌ НЕ ЗАВЕРШЁН"}`);
      } else {
        console.log(`      ❌ Нет результата!`);
      }
    }
  } else {
    console.log("👤 Для проверки участия добавьте userId:");
    console.log("   npx ts-node scripts/diagnose-tournament.ts <userId>");
    console.log("\n   Участники:");
    for (const p of tournament.participants) {
      console.log(`   - User ${p.userId}: ${p.status}, score=${p.totalScore}, stage=${p.currentStage}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
