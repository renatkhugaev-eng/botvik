/**
 * Обновление описаний квизов на короткие версии
 * Run: npx tsx scripts/fix-descriptions.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Маппинг: новый title → короткое description
const DESCRIPTIONS: Record<string, string> = {
  "Думаешь, шаришь в маньяках?": "Базовый тест. Спойлер: ты лох.",
  "Дела, от которых ты охренеешь": "Банди, Дамер, Гейси — угадай, пока жив.",
  "Как менты ловят психов": "Профайлинг, улики, методы — знай это.",
  "Наши маньяки пожёстче будут": "Чикатило, Попков — русский ад.",
  "ДНК не соврёт, а ты?": "Улики, кровь, отпечатки — докажи.",
  "Джек: кто кромсал шлюх?": "1888, Лондон, трущобы — угадай.",
  "Залезь в башку психу": "Методы ФБР, Mindhunter-стайл.",
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  console.log("📝 Обновление описаний квизов...\n");

  const quizzes = await prisma.quiz.findMany();
  let updated = 0;

  for (const quiz of quizzes) {
    const newDesc = DESCRIPTIONS[quiz.title];
    if (newDesc && quiz.description !== newDesc) {
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: { description: newDesc },
      });
      console.log(`✅ "${quiz.title}"`);
      console.log(`   Было: ${quiz.description}`);
      console.log(`   Стало: ${newDesc}\n`);
      updated++;
    }
  }

  if (updated === 0) {
    console.log("ℹ️  Все описания уже актуальны.");
  } else {
    console.log(`\n🔥 Обновлено: ${updated} квизов`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});
