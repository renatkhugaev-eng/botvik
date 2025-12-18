/**
 * Обновление названий квизов и турниров на агрессивные/жёсткие
 * Run: npx tsx scripts/update-titles-aggressive.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const QUIZ_UPDATES: Record<string, { title: string; description: string }> = {
  // Базовые квизы
  "Трукрайм-викторина №1": {
    title: "Думаешь, шаришь в маньяках?",
    description: "Базовый тест. Спойлер: ты лох.",
  },
  "Знаменитые дела": {
    title: "Дела, от которых ты охренеешь",
    description: "Банди, Дамер, Гейси — угадай, пока жив.",
  },
  "Методы расследования": {
    title: "Как менты ловят психов",
    description: "Профайлинг, улики, методы — знай это.",
  },
  "Российские криминальные дела": {
    title: "Наши маньяки пожёстче будут",
    description: "Чикатило, Попков — русский ад.",
  },
  "Криминалистика и улики": {
    title: "ДНК не соврёт, а ты?",
    description: "Улики, кровь, отпечатки — докажи.",
  },
  // Турнирные квизы
  "Джек Потрошитель: Тайны Уайтчепела": {
    title: "Джек: кто кромсал шлюх?",
    description: "1888, Лондон, трущобы — угадай.",
  },
  "Психология преступника: Профайлинг ФБР": {
    title: "Залезь в башку психу",
    description: "Методы ФБР, Mindhunter-стайл.",
  },
};

const TOURNAMENT_UPDATES: Record<string, { title: string; description: string; icon: string; gradientFrom: string; gradientTo: string }> = {
  "True Crime Masters 2025": {
    title: "Мясорубка 2025",
    description: "Думал, ты эксперт? Докажи или вали. 3 этапа, никакой жалости, только хардкор.",
    icon: "🩸",
    gradientFrom: "#0f0f0f",
    gradientTo: "#7f1d1d",
  },
  "truecrime-masters-2025": {
    title: "Мясорубка 2025",
    description: "Думал, ты эксперт? Докажи или вали. 3 этапа, никакой жалости, только хардкор.",
    icon: "🩸",
    gradientFrom: "#0f0f0f",
    gradientTo: "#7f1d1d",
  },
  "Mindhunter Challenge 2025": {
    title: "Охота на психов",
    description: "Джек Потрошитель, методы ФБР, психология убийц — погрузись, если хватит яиц. Слабакам тут не место.",
    icon: "🔪",
    gradientFrom: "#0f0f0f",
    gradientTo: "#dc2626",
  },
  "mindhunter-challenge-2025": {
    title: "Охота на психов",
    description: "Джек Потрошитель, методы ФБР, психология убийц — погрузись, если хватит яиц. Слабакам тут не место.",
    icon: "🔪",
    gradientFrom: "#0f0f0f",
    gradientTo: "#dc2626",
  },
};

const STAGE_UPDATES: Record<string, { title: string; description: string }> = {
  "Квалификация": {
    title: "Отсев лохов",
    description: "Базовый уровень. Не осилишь — вали.",
  },
  "Полуфинал": {
    title: "Мясорубка",
    description: "Залезь в башку психу. Только топы пройдут дальше.",
  },
  "Финал": {
    title: "Кровавый финал",
    description: "Последний рубеж. Кто выживет — тот и легенда.",
  },
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  console.log("🔥 Обновление названий на агрессивные...\n");

  // 1. Обновляем квизы
  console.log("📝 Квизы:");
  const quizzes = await prisma.quiz.findMany();
  
  for (const quiz of quizzes) {
    const update = QUIZ_UPDATES[quiz.title];
    if (update) {
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: { title: update.title, description: update.description },
      });
      console.log(`   ✅ "${quiz.title}" → "${update.title}"`);
    }
  }

  // 2. Обновляем турниры
  console.log("\n🏆 Турниры:");
  const tournaments = await prisma.tournament.findMany({
    include: { stages: true },
  });

  for (const tournament of tournaments) {
    // Проверяем по title или slug
    const update = TOURNAMENT_UPDATES[tournament.title] || TOURNAMENT_UPDATES[tournament.slug];
    if (update) {
      const newSlug = update.title === "Мясорубка 2025" 
        ? "myasorubka-2025" 
        : update.title === "Охота на психов"
          ? "ohota-na-psihov-2025"
          : tournament.slug;

      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          title: update.title,
          description: update.description,
          icon: update.icon,
          gradientFrom: update.gradientFrom,
          gradientTo: update.gradientTo,
          slug: newSlug,
        },
      });
      console.log(`   ✅ "${tournament.title}" → "${update.title}"`);

      // Обновляем этапы
      for (const stage of tournament.stages) {
        const stageUpdate = STAGE_UPDATES[stage.title];
        if (stageUpdate) {
          await prisma.tournamentStage.update({
            where: { id: stage.id },
            data: { title: stageUpdate.title, description: stageUpdate.description },
          });
          console.log(`      📌 Этап: "${stage.title}" → "${stageUpdate.title}"`);
        }
      }
    }
  }

  // 3. Обновляем призы
  console.log("\n🎁 Призы:");
  const prizes = await prisma.tournamentPrize.findMany();
  
  for (const prize of prizes) {
    if (prize.title.includes("Mindhunter")) {
      await prisma.tournamentPrize.update({
        where: { id: prize.id },
        data: { 
          title: prize.title.replace("Mindhunter", "Душегуб"),
          icon: "💀",
        },
      });
      console.log(`   ✅ Приз обновлён: "${prize.title.replace("Mindhunter", "Душегуб")}"`);
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log("🔥 Готово! Все названия обновлены на агрессивные.");
  console.log("═".repeat(50));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});
