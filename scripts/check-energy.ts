/**
 * Проверка энергии и доступных квизов
 * Запуск: npx ts-node scripts/check-energy.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const MAX_ATTEMPTS = 5;
const HOURS_PER_ATTEMPT = 4;
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000;

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`⚡ ПРОВЕРКА ЭНЕРГИИ USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Информация о пользователе
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      username: true, 
      firstName: true,
      bonusEnergy: true,
      bonusEnergyEarned: true,
      bonusEnergyUsed: true,
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
  console.log("");
  
  console.log("⚡ БОНУСНАЯ ЭНЕРГИЯ:");
  console.log(`   Текущий баланс: ${user.bonusEnergy}`);
  console.log(`   Всего заработано: ${user.bonusEnergyEarned ?? 0}`);
  console.log(`   Всего потрачено: ${user.bonusEnergyUsed ?? 0}`);
  console.log("");

  console.log("📅 ЕЖЕДНЕВНЫЙ БОНУС:");
  console.log(`   Streak: День ${user.dailyRewardStreak}`);
  console.log(`   Последний claim: ${user.lastDailyRewardAt?.toISOString() ?? "никогда"}`);
  console.log("");

  // 2. Проверяем использованную энергию (sliding window)
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
  const recentSessions = await prisma.quizSession.findMany({
    where: { 
      userId, 
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { 
      id: true,
      quizId: true,
      startedAt: true,
      finishedAt: true,
      totalScore: true,
    },
  });

  const usedAttempts = recentSessions.length;
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - usedAttempts);
  
  console.log("🔋 ОБЫЧНАЯ ЭНЕРГИЯ (sliding window):");
  console.log(`   Использовано: ${usedAttempts}/${MAX_ATTEMPTS}`);
  console.log(`   Доступно: ${remainingAttempts}`);
  console.log(`   Бонус: +${user.bonusEnergy}`);
  console.log(`   ИТОГО доступно: ${remainingAttempts + user.bonusEnergy}`);
  console.log("");

  if (recentSessions.length > 0) {
    console.log("📋 ПОСЛЕДНИЕ СЕССИИ (за 4 часа):");
    for (const session of recentSessions) {
      const timeAgo = Math.round((Date.now() - session.startedAt.getTime()) / 60000);
      const recoveryIn = Math.max(0, HOURS_PER_ATTEMPT * 60 - timeAgo);
      console.log(`   Quiz ${session.quizId}: ${timeAgo} мин назад (восстановится через ${recoveryIn} мин)`);
    }
    console.log("");
  }

  // 3. Следующее восстановление энергии
  if (usedAttempts >= MAX_ATTEMPTS) {
    const oldestSession = recentSessions[0];
    const nextSlotAt = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
    const waitMs = nextSlotAt.getTime() - Date.now();
    const waitMinutes = Math.ceil(waitMs / 60000);
    const waitHours = Math.floor(waitMinutes / 60);
    const remainingMinutes = waitMinutes % 60;
    
    console.log("⏳ ВОССТАНОВЛЕНИЕ:");
    if (waitMs > 0) {
      console.log(`   Следующий слот через: ${waitHours}ч ${remainingMinutes}м`);
    } else {
      console.log(`   ✅ Слот уже доступен!`);
    }
    console.log("");
  }

  // 4. Доступные квизы для теста
  console.log("🎮 ДОСТУПНЫЕ КВИЗЫ ДЛЯ ТЕСТА:");
  
  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true },
    select: { 
      id: true, 
      title: true,
      questions: { select: { id: true } },
    },
    take: 10,
  });

  // Проверяем какие квизы турнирные
  const tournamentStages = await prisma.tournamentStage.findMany({
    where: {
      quizId: { in: quizzes.map(q => q.id) },
      tournament: {
        status: "ACTIVE",
        participants: {
          some: { userId },
        },
      },
    },
    select: {
      quizId: true,
      order: true,
      tournament: { select: { title: true } },
    },
  });

  const tournamentQuizIds = new Set(tournamentStages.map(s => s.quizId));

  for (const quiz of quizzes) {
    const isTournament = tournamentQuizIds.has(quiz.id);
    const stage = tournamentStages.find(s => s.quizId === quiz.id);
    
    console.log(`\n   [Quiz ${quiz.id}] ${quiz.title}`);
    console.log(`      Вопросов: ${quiz.questions.length}`);
    if (isTournament && stage) {
      console.log(`      🏆 ТУРНИРНЫЙ (${stage.tournament.title}, этап ${stage.order})`);
      console.log(`      ⚡ Энергия НЕ тратится!`);
    } else {
      console.log(`      📊 Обычный квиз`);
      console.log(`      ⚡ Тратит 1 энергию`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("💡 РЕКОМЕНДАЦИЯ:");
  if (remainingAttempts + user.bonusEnergy > 0) {
    console.log(`   У тебя есть ${remainingAttempts + user.bonusEnergy} попыток!`);
    console.log(`   Турнирные квизы НЕ тратят энергию.`);
    console.log(`   Обычные квизы тратят 1 энергию (сначала бонусную).`);
  } else {
    console.log(`   Энергия закончилась! Жди восстановления.`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
