/**
 * Проверка настроек уведомлений пользователя
 * Запуск: npx ts-node scripts/check-notifications.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`🔔 НАСТРОЙКИ УВЕДОМЛЕНИЙ USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      username: true, 
      firstName: true,
      telegramId: true,
      // Notification preferences
      notifyLevelUp: true,
      notifyEnergyFull: true,
      notifyDailyReminder: true,
      notifyLeaderboard: true,
      notifyFriends: true,
      // Last notification
      lastNotifiedAt: true,
      // XP for level check
      xp: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  console.log("👤 ПОЛЬЗОВАТЕЛЬ:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Имя: ${user.firstName ?? user.username ?? "—"}`);
  console.log(`   Telegram ID: ${user.telegramId}`);
  console.log(`   XP: ${user.xp}`);
  console.log("");

  console.log("🔔 НАСТРОЙКИ УВЕДОМЛЕНИЙ:");
  console.log(`   Level Up:       ${user.notifyLevelUp ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Energy Full:    ${user.notifyEnergyFull ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Daily Reminder: ${user.notifyDailyReminder ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Leaderboard:    ${user.notifyLeaderboard ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Friends:        ${user.notifyFriends ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log("");

  console.log("📬 ПОСЛЕДНЕЕ УВЕДОМЛЕНИЕ:");
  if (user.lastNotifiedAt) {
    const ago = Math.round((Date.now() - user.lastNotifiedAt.getTime()) / 60000);
    console.log(`   ${user.lastNotifiedAt.toISOString()} (${ago} мин назад)`);
  } else {
    console.log("   Никогда");
  }
  console.log("");

  // Calculate level from XP
  const level = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (4 * user.xp) / 50)) / 2));
  console.log(`📊 ТЕКУЩИЙ УРОВЕНЬ: ${level}`);
  console.log("");

  console.log("═══════════════════════════════════════════════════════════════");
  
  if (!user.notifyLevelUp || !user.notifyEnergyFull) {
    console.log("⚠️  ПРОБЛЕМА: Некоторые уведомления ВЫКЛЮЧЕНЫ!");
    console.log("   Включи их в настройках приложения.");
  } else {
    console.log("✅ Все важные уведомления включены.");
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
