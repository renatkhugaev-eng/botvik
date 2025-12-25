/**
 * Скрипт для проверки данных пользователя в БД
 * Запуск: npx tsx scripts/check-user.ts 5731136459
 */

import { prisma } from "../lib/prisma";

async function main() {
  const telegramId = process.argv[2];
  
  if (!telegramId) {
    console.error("Usage: npx tsx scripts/check-user.ts <telegramId>");
    process.exit(1);
  }

  console.log(`\n🔍 Ищу пользователя с telegramId: ${telegramId}\n`);

  const user = await prisma.user.findFirst({
    where: { telegramId },
    include: {
      chatMessages: { take: 5, orderBy: { createdAt: "desc" } },
      messageReactions: { take: 5 },
      achievements: { take: 5 },
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден");
    return;
  }

  console.log("✅ Пользователь найден:");
  console.log("─".repeat(50));
  console.log(`ID: ${user.id}`);
  console.log(`Telegram ID: ${user.telegramId}`);
  console.log(`Username: ${user.username}`);
  console.log(`First Name: ${user.firstName}`);
  console.log(`Status: ${user.status}`);
  console.log(`XP: ${user.xp}`);
  console.log(`Created: ${user.createdAt}`);
  console.log(`Last Seen: ${user.lastSeenAt}`);
  console.log("─".repeat(50));
  console.log(`Chat Messages: ${user.chatMessages.length}`);
  console.log(`Reactions: ${user.messageReactions.length}`);
  console.log(`Achievements: ${user.achievements.length}`);
  console.log("─".repeat(50));

  // Проверяем есть ли проблемы с данными
  const issues: string[] = [];
  
  if (!user.firstName && !user.username) {
    issues.push("⚠️ Нет firstName и username");
  }
  if (user.status === null) {
    issues.push("⚠️ Status = null");
  }

  if (issues.length > 0) {
    console.log("\n⚠️ Возможные проблемы:");
    issues.forEach(i => console.log(`  ${i}`));
  } else {
    console.log("\n✅ Проблем с данными не обнаружено");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

