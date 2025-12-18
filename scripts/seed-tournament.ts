/**
 * Seed script for creating a test tournament
 * Run: npx tsx scripts/seed-tournament.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  console.log("🎮 Creating test tournament...");

  // Находим существующие квизы для привязки к этапам
  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true },
    take: 3,
    orderBy: { id: "asc" },
  });

  if (quizzes.length === 0) {
    console.error("❌ No active quizzes found. Please seed quizzes first.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`📚 Found ${quizzes.length} quizzes for tournament stages`);

  // Даты турнира
  const now = new Date();
  const startsAt = new Date(now.getTime() - 1000 * 60 * 60); // Начался час назад
  const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3); // Закончится через 3 дня

  // Создаём турнир
  const tournament = await prisma.tournament.create({
    data: {
      slug: "truecrime-masters-2025",
      title: "True Crime Masters 2025",
      description: "Главный турнир года для истинных знатоков криминалистики! Проверь свои знания в захватывающем соревновании.",
      icon: "🔍",
      coverImage: null,
      gradientFrom: "#1a1a2e",
      gradientTo: "#4a1942",
      startsAt,
      endsAt,
      status: "ACTIVE",
      minPlayers: 3,
      maxPlayers: 1000,
      entryFee: 0,
      type: "QUIZ",

      // Создаём этапы
      stages: {
        create: [
          {
            order: 1,
            title: "Квалификация",
            description: "Покажи базовые знания и пройди в следующий этап",
            type: "QUIZ",
            quizId: quizzes[0]?.id,
            startsAt: startsAt,
            endsAt: new Date(startsAt.getTime() + 1000 * 60 * 60 * 24), // 1 день
            topN: 100,
            minScore: 50,
            scoreMultiplier: 1.0,
          },
          {
            order: 2,
            title: "Полуфинал",
            description: "Только лучшие продолжат борьбу",
            type: "QUIZ",
            quizId: quizzes[1]?.id ?? quizzes[0]?.id,
            startsAt: new Date(startsAt.getTime() + 1000 * 60 * 60 * 24),
            endsAt: new Date(startsAt.getTime() + 1000 * 60 * 60 * 48),
            topN: 20,
            minScore: 70,
            scoreMultiplier: 1.5,
          },
          {
            order: 3,
            title: "Финал",
            description: "Решающий этап! Кто станет чемпионом?",
            type: "QUIZ",
            quizId: quizzes[2]?.id ?? quizzes[0]?.id,
            startsAt: new Date(startsAt.getTime() + 1000 * 60 * 60 * 48),
            endsAt: endsAt,
            topN: null,
            minScore: null,
            scoreMultiplier: 2.0,
          },
        ],
      },

      // Создаём призы
      prizes: {
        create: [
          {
            place: 1,
            title: "5000 XP",
            description: "Главный приз для победителя!",
            type: "XP",
            value: 5000,
            icon: "🥇",
          },
          {
            place: 2,
            title: "2500 XP",
            description: "Достойная награда для серебра",
            type: "XP",
            value: 2500,
            icon: "🥈",
          },
          {
            place: 3,
            title: "1000 XP",
            description: "Бронзовый призёр",
            type: "XP",
            value: 1000,
            icon: "🥉",
          },
          {
            place: 4,
            title: "500 XP",
            description: "Топ-10 участников",
            type: "XP",
            value: 500,
            icon: "⭐",
          },
          {
            place: 5,
            title: "500 XP",
            description: "Топ-10 участников",
            type: "XP",
            value: 500,
            icon: "⭐",
          },
        ],
      },
    },
    include: {
      stages: true,
      prizes: true,
    },
  });

  console.log(`✅ Created tournament: "${tournament.title}" (ID: ${tournament.id})`);
  console.log(`   📅 Status: ${tournament.status}`);
  console.log(`   📊 Stages: ${tournament.stages.length}`);
  console.log(`   🏆 Prizes: ${tournament.prizes.length}`);

  // Создаём ещё один турнир (UPCOMING)
  const upcomingTournament = await prisma.tournament.create({
    data: {
      slug: "winter-investigation-2025",
      title: "Зимнее Расследование",
      description: "Новый формат: комбинация квизов и расследований! Готовы ли вы раскрыть холодное дело?",
      icon: "❄️",
      gradientFrom: "#0f2027",
      gradientTo: "#2c5364",
      startsAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5), // Через 5 дней
      endsAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 12), // Через 12 дней
      status: "UPCOMING",
      minPlayers: 10,
      maxPlayers: 500,
      entryFee: 100, // 100 XP за вход
      type: "MIXED",

      stages: {
        create: [
          {
            order: 1,
            title: "Сбор улик",
            type: "QUIZ",
            quizId: quizzes[0]?.id,
            scoreMultiplier: 1.0,
          },
          {
            order: 2,
            title: "Анализ",
            type: "INVESTIGATION",
            scoreMultiplier: 1.5,
          },
          {
            order: 3,
            title: "Вердикт",
            type: "QUIZ",
            quizId: quizzes[1]?.id ?? quizzes[0]?.id,
            scoreMultiplier: 2.0,
          },
        ],
      },

      prizes: {
        create: [
          {
            place: 1,
            title: "10000 XP + Бейдж",
            type: "XP",
            value: 10000,
            icon: "👑",
          },
          {
            place: 2,
            title: "5000 XP",
            type: "XP",
            value: 5000,
            icon: "🥈",
          },
          {
            place: 3,
            title: "2000 XP",
            type: "XP",
            value: 2000,
            icon: "🥉",
          },
        ],
      },
    },
  });

  console.log(`✅ Created upcoming tournament: "${upcomingTournament.title}"`);

  await prisma.$disconnect();
  console.log("\n🎉 Tournament seeding completed!");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
