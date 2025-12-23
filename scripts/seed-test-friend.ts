/**
 * Скрипт для создания тестового друга с активностями
 * Запуск: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-friend.ts <YOUR_USER_ID>
 */

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Make sure .env file exists.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const input = process.argv[2];
  let myUserId: number;
  
  if (!input) {
    // Если ничего не передано, найдём первого реального пользователя
    console.log("ID не передан, ищу первого пользователя в БД...\n");
    
    const firstUser = await prisma.user.findFirst({
      where: { 
        username: { not: "test_friend_dev" } 
      },
      orderBy: { id: "asc" },
      select: { id: true, username: true, firstName: true, telegramId: true },
    });
    
    if (!firstUser) {
      console.log("❌ В базе нет пользователей. Сначала войди в приложение.");
      process.exit(1);
    }
    
    myUserId = firstUser.id;
    console.log(`📌 Найден пользователь: #${myUserId} (${firstUser.firstName || firstUser.username}), telegramId: ${firstUser.telegramId}`);
  } else if (input.length > 9) {
    // Если передан длинный ID — это скорее всего telegramId
    console.log(`Ищу пользователя по telegramId: ${input}...\n`);
    
    const user = await prisma.user.findUnique({
      where: { telegramId: input },
      select: { id: true, username: true, firstName: true },
    });
    
    if (!user) {
      console.log(`❌ Пользователь с telegramId ${input} не найден.`);
      console.log("   Сначала войди в приложение через Telegram.");
      process.exit(1);
    }
    
    myUserId = user.id;
    console.log(`📌 Найден пользователь: #${myUserId} (${user.firstName || user.username})`);
  } else {
    // Короткий ID — это database userId
    myUserId = parseInt(input, 10);
    if (isNaN(myUserId)) {
      console.log("❌ Некорректный ID.");
      process.exit(1);
    }
  }

  console.log(`\n🔧 Создаю тестового друга для пользователя #${myUserId}...\n`);

  // 1. Создаём или находим тестового пользователя
  let testUser = await prisma.user.findFirst({
    where: { username: "test_friend_dev" },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        telegramId: "999999999",
        username: "test_friend_dev",
        firstName: "Тестовый Друг",
        photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=TestFriend",
        xp: 1500,
      },
    });
    console.log("✅ Создан тестовый пользователь:", testUser.username);
  } else {
    console.log("📌 Найден существующий тестовый пользователь:", testUser.username);
  }

  // 2. Создаём дружбу (если ещё нет)
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: myUserId, friendId: testUser.id },
        { userId: testUser.id, friendId: myUserId },
      ],
    },
  });

  if (!existingFriendship) {
    await prisma.friendship.create({
      data: {
        userId: testUser.id,
        friendId: myUserId,
        status: "ACCEPTED",
      },
    });
    console.log("✅ Дружба создана");
  } else {
    console.log("📌 Дружба уже существует");
  }

  // 3. Удаляем старые активности тестового пользователя
  await prisma.userActivity.deleteMany({
    where: { userId: testUser.id },
  });

  // 4. Создаём тестовые активности
  const now = new Date();
  
  const activities = [
    {
      userId: testUser.id,
      type: "QUIZ_COMPLETED" as const,
      title: "Прошёл квиз «Серийные убийцы США»",
      icon: "🎯",
      data: { quizId: 1, quizTitle: "Серийные убийцы США", score: 850 },
      createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 минут назад
    },
    {
      userId: testUser.id,
      type: "QUIZ_HIGH_SCORE" as const,
      title: "Новый рекорд: 850 очков!",
      icon: "🏆",
      data: { quizId: 1, quizTitle: "Серийные убийцы США", score: 850 },
      createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 минут назад
    },
    {
      userId: testUser.id,
      type: "ACHIEVEMENT_UNLOCKED" as const,
      title: "Получил достижение «Первые шаги»",
      icon: "⭐",
      data: { achievementId: "first_quiz", achievementTitle: "Первые шаги" },
      createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 минут назад
    },
    {
      userId: testUser.id,
      type: "LEVEL_UP" as const,
      title: "Достиг 5 уровня!",
      icon: "🚀",
      data: { level: 5 },
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 часа назад
    },
    {
      userId: testUser.id,
      type: "STREAK_MILESTONE" as const,
      title: "Серия 7 дней подряд! 🔥",
      icon: "🔥",
      data: { streakDays: 7 },
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 день назад
    },
  ];

  await prisma.userActivity.createMany({
    data: activities,
  });

  console.log(`✅ Создано ${activities.length} тестовых активностей\n`);

  console.log("═══════════════════════════════════════════════════");
  console.log("🎉 Готово! Тестовый друг добавлен.");
  console.log("═══════════════════════════════════════════════════");
  console.log(`\n📱 Теперь обнови главную страницу приложения.`);
  console.log(`   В ленте друзей появятся активности от "${testUser.firstName}".\n`);
}

main()
  .catch((e) => {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
