/**
 * Seed Test Duel — создаёт тестового друга и дуэль для тестирования
 * 
 * Использование:
 * npx ts-node --project tsconfig.seed.json prisma/seed-test-duel.ts
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🎮 Создаём тестовые данные для дуэлей...\n");

  // 1. Найти или создать dev-mock пользователя (используется в dev режиме)
  let me = await prisma.user.findUnique({
    where: { telegramId: "dev-mock" },
  });

  if (!me) {
    me = await prisma.user.create({
      data: {
        telegramId: "dev-mock",
        username: "devuser",
        firstName: "Dev",
        lastName: "User",
        xp: 100,
      },
    });
    console.log(`✅ Создан dev-mock пользователь (ID: ${me.id})`);
  } else {
    console.log(`✅ Найден dev-mock пользователь (ID: ${me.id})`);
  }

  console.log(`✅ Твой аккаунт: ${me.firstName || me.username} (ID: ${me.id})`);

  // 2. Создать или найти тестового друга
  const testFriendTelegramId = "TEST_FRIEND_" + Date.now();
  
  let testFriend = await prisma.user.findFirst({
    where: { 
      username: "TestDuelFriend",
      id: { not: me.id },
    },
  });

  if (!testFriend) {
    testFriend = await prisma.user.create({
      data: {
        telegramId: testFriendTelegramId,
        username: "TestDuelFriend",
        firstName: "Тестовый",
        lastName: "Соперник",
        xp: 500,
      },
    });
    console.log(`✅ Создан тестовый друг: ${testFriend.firstName} (ID: ${testFriend.id})`);
  } else {
    console.log(`✅ Найден существующий тестовый друг: ${testFriend.firstName} (ID: ${testFriend.id})`);
  }

  // 3. Создать дружбу (если не существует)
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: me.id, friendId: testFriend.id },
        { userId: testFriend.id, friendId: me.id },
      ],
    },
  });

  if (!existingFriendship) {
    await prisma.friendship.create({
      data: {
        userId: me.id,
        friendId: testFriend.id,
        status: "ACCEPTED",
      },
    });
    console.log("✅ Дружба создана (статус: ACCEPTED)");
  } else {
    console.log(`✅ Дружба уже существует (статус: ${existingFriendship.status})`);
    
    // Обновим статус на ACCEPTED если нужно
    if (existingFriendship.status !== "ACCEPTED") {
      await prisma.friendship.update({
        where: { id: existingFriendship.id },
        data: { status: "ACCEPTED" },
      });
      console.log("✅ Статус дружбы обновлён на ACCEPTED");
    }
  }

  // 4. Найти активный квиз
  const quiz = await prisma.quiz.findFirst({
    where: { isActive: true },
    include: {
      questions: {
        take: 5,
        include: { answers: true },
      },
    },
  });

  if (!quiz) {
    console.error("❌ Нет активных квизов! Создай квиз в админке.");
    process.exit(1);
  }

  console.log(`✅ Найден активный квиз: "${quiz.title}" (ID: ${quiz.id})`);

  // 5. Создать тестовую дуэль (входящий вызов от друга)
  const existingDuel = await prisma.duel.findFirst({
    where: {
      OR: [
        { challengerId: me.id, opponentId: testFriend.id, status: "PENDING" },
        { challengerId: testFriend.id, opponentId: me.id, status: "PENDING" },
      ],
    },
  });

  if (existingDuel) {
    console.log(`\n⚔️ Уже есть активная дуэль (ID: ${existingDuel.id})`);
  } else {
    // Друг вызывает тебя на дуэль
    const duel = await prisma.duel.create({
      data: {
        challengerId: testFriend.id,
        opponentId: me.id,
        quizId: quiz.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 часа
        xpReward: 50,
        xpLoser: 10,
      },
    });

    console.log(`\n⚔️ Создана тестовая дуэль!`);
    console.log(`   ID: ${duel.id}`);
    console.log(`   От: ${testFriend.firstName} → Тебе`);
    console.log(`   Квиз: ${quiz.title}`);
  }

  console.log("\n" + "═".repeat(50));
  console.log("🎮 Готово! Теперь открой:");
  console.log("   http://localhost:3000/miniapp/duels");
  console.log("\nТы увидишь входящий вызов от тестового друга!");
  console.log("═".repeat(50) + "\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
