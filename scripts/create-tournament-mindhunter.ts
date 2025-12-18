/**
 * Создание турнира "Mindhunter Challenge" с новыми квизами
 * 
 * Этапы:
 * 1. Квалификация — Джек Потрошитель (×1.0)
 * 2. Полуфинал — Профайлинг ФБР (×1.5)
 * 3. Финал — (нужен третий квиз или используем существующий) (×2.0)
 * 
 * Run: npx tsx scripts/create-tournament-mindhunter.ts
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

  console.log("🎮 Создание турнира Mindhunter Challenge...\n");

  // Ищем наши новые квизы
  const jackTheRipper = await prisma.quiz.findFirst({
    where: { title: { contains: "Джек Потрошитель" } },
  });

  const fbiProfiling = await prisma.quiz.findFirst({
    where: { title: { contains: "Профайлинг ФБР" } },
  });

  // Для финала используем существующий квиз (криминалистика или известные дела)
  const finalQuiz = await prisma.quiz.findFirst({
    where: { 
      OR: [
        { title: { contains: "Криминалистика" } },
        { title: { contains: "Знаменитые дела" } },
      ]
    },
  });

  console.log("📚 Найденные квизы:");
  console.log(`   1. Квалификация: ${jackTheRipper?.title ?? "❌ НЕ НАЙДЕН"} (ID: ${jackTheRipper?.id ?? "?"})`);
  console.log(`   2. Полуфинал: ${fbiProfiling?.title ?? "❌ НЕ НАЙДЕН"} (ID: ${fbiProfiling?.id ?? "?"})`);
  console.log(`   3. Финал: ${finalQuiz?.title ?? "❌ НЕ НАЙДЕН"} (ID: ${finalQuiz?.id ?? "?"})\n`);

  if (!jackTheRipper || !fbiProfiling) {
    console.error("❌ Не найдены необходимые квизы. Сначала импортируйте их.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Проверяем, нет ли уже такого турнира
  const existing = await prisma.tournament.findFirst({
    where: { 
      OR: [
        { slug: "mindhunter-challenge-2025" },
        { slug: "ohota-na-psihov-2025" },
      ]
    },
  });

  if (existing) {
    console.log(`⚠️  Турнир уже существует (ID: ${existing.id}). Удаляем...`);
    await prisma.tournament.delete({ where: { id: existing.id } });
    console.log("   ✅ Удалён\n");
  }

  // Даты турнира
  const now = new Date();
  const startsAt = new Date(now.getTime() + 1000 * 60 * 5); // Начнётся через 5 минут
  const stage1End = new Date(startsAt.getTime() + 1000 * 60 * 60 * 24); // 1 день
  const stage2End = new Date(stage1End.getTime() + 1000 * 60 * 60 * 24); // +1 день
  const endsAt = new Date(stage2End.getTime() + 1000 * 60 * 60 * 24); // +1 день (всего 3 дня)

  // Создаём турнир
  const tournament = await prisma.tournament.create({
    data: {
      slug: "ohota-na-psihov-2025",
      title: "Охота на психов",
      description: "Джек Потрошитель, методы ФБР, психология убийц — погрузись, если хватит яиц. Слабакам тут не место.",
      icon: "🔪",
      coverImage: null,
      gradientFrom: "#0f0f0f",
      gradientTo: "#dc2626",
      startsAt,
      endsAt,
      status: "UPCOMING",
      minPlayers: 5,
      maxPlayers: 1000,
      entryFee: 0, // Бесплатный вход
      type: "QUIZ",

      // Этапы турнира
      stages: {
        create: [
          {
            order: 1,
            title: "Отсев лохов",
            description: "Джек Потрошитель — базовый уровень. Не осилишь — вали.",
            type: "QUIZ",
            quizId: jackTheRipper.id,
            startsAt: startsAt,
            endsAt: stage1End,
            topN: 100, // Топ-100 проходят дальше
            minScore: 50, // Минимум 50 очков
            scoreMultiplier: 1.0,
          },
          {
            order: 2,
            title: "Мясорубка",
            description: "Залезь в башку психу. Только топы пройдут дальше.",
            type: "QUIZ",
            quizId: fbiProfiling.id,
            startsAt: stage1End,
            endsAt: stage2End,
            topN: 20, // Топ-20 в финал
            minScore: 100, // Минимум 100 очков
            scoreMultiplier: 1.5,
          },
          {
            order: 3,
            title: "Кровавый финал",
            description: "Последний рубеж. Кто выживет — тот и легенда.",
            type: "QUIZ",
            quizId: finalQuiz?.id ?? jackTheRipper.id,
            startsAt: stage2End,
            endsAt: endsAt,
            topN: null, // Финал — все участники
            minScore: null,
            scoreMultiplier: 2.0,
          },
        ],
      },

      // Призы
      prizes: {
        create: [
          {
            place: 1,
            title: "5000 XP + Титул Душегуб",
            description: "Ты порвал всех. Заслужил.",
            type: "XP",
            value: 5000,
            icon: "💀",
          },
          {
            place: 2,
            title: "2500 XP",
            description: "Почти топ, но не хватило яиц.",
            type: "XP",
            value: 2500,
            icon: "🩸",
          },
          {
            place: 3,
            title: "1000 XP",
            description: "Бронза. Могло быть хуже.",
            type: "XP",
            value: 1000,
            icon: "🔪",
          },
          {
            place: 4,
            title: "500 XP",
            description: "Топ-5. Неплохо для мяса.",
            type: "XP",
            value: 500,
            icon: "⚰️",
          },
          {
            place: 5,
            title: "500 XP",
            description: "Топ-5. Неплохо для мяса.",
            type: "XP",
            value: 500,
            icon: "⚰️",
          },
          {
            place: 6,
            title: "250 XP",
            description: "Хоть что-то получил.",
            type: "XP",
            value: 250,
            icon: "🦴",
          },
          {
            place: 7,
            title: "250 XP",
            description: "Хоть что-то получил.",
            type: "XP",
            value: 250,
            icon: "🦴",
          },
          {
            place: 8,
            title: "250 XP",
            description: "Хоть что-то получил.",
            type: "XP",
            value: 250,
            icon: "✨",
          },
          {
            place: 9,
            title: "250 XP",
            description: "Топ-10 участников",
            type: "XP",
            value: 250,
            icon: "✨",
          },
          {
            place: 10,
            title: "250 XP",
            description: "Топ-10 участников",
            type: "XP",
            value: 250,
            icon: "✨",
          },
        ],
      },
    },
    include: {
      stages: {
        include: { quiz: { select: { id: true, title: true } } },
        orderBy: { order: "asc" },
      },
      prizes: { orderBy: { place: "asc" } },
    },
  });

  console.log("═".repeat(60));
  console.log(`✅ Турнир создан: "${tournament.title}"`);
  console.log("═".repeat(60));
  console.log(`   🆔 ID: ${tournament.id}`);
  console.log(`   🔗 Slug: ${tournament.slug}`);
  console.log(`   📅 Статус: ${tournament.status}`);
  console.log(`   🕐 Начало: ${tournament.startsAt.toLocaleString("ru-RU")}`);
  console.log(`   🏁 Конец: ${tournament.endsAt.toLocaleString("ru-RU")}`);
  console.log("");
  console.log("📊 Этапы:");
  for (const stage of tournament.stages) {
    console.log(`   ${stage.order}. ${stage.title} (×${stage.scoreMultiplier})`);
    console.log(`      Quiz: ${stage.quiz?.title ?? "N/A"}`);
    console.log(`      TopN: ${stage.topN ?? "∞"} | MinScore: ${stage.minScore ?? "—"}`);
  }
  console.log("");
  console.log("🏆 Призы:");
  for (const prize of tournament.prizes.slice(0, 5)) {
    console.log(`   ${prize.icon} ${prize.place} место: ${prize.title}`);
  }
  if (tournament.prizes.length > 5) {
    console.log(`   ... и ещё ${tournament.prizes.length - 5} призов`);
  }

  await prisma.$disconnect();
  console.log("\n🎉 Турнир готов к запуску!");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
