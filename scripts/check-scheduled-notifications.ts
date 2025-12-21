/**
 * Проверка запланированных уведомлений
 * Запуск: npx ts-node scripts/check-scheduled-notifications.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`📬 ПРОВЕРКА УВЕДОМЛЕНИЙ ДЛЯ USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Пользователь и его настройки
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      notifyEnergyFull: true,
      notifyLevelUp: true,
      notifyDailyReminder: true,
      lastNotifiedAt: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  console.log("👤 ПОЛЬЗОВАТЕЛЬ:");
  console.log(`   ID: ${user.id}`);
  console.log(`   TelegramID: ${user.telegramId}`);
  console.log(`   Имя: ${user.firstName}`);
  console.log(`   Последнее уведомление: ${user.lastNotifiedAt?.toISOString() || "никогда"}\n`);

  console.log("🔔 НАСТРОЙКИ УВЕДОМЛЕНИЙ:");
  console.log(`   notifyEnergyFull: ${user.notifyEnergyFull ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   notifyLevelUp: ${user.notifyLevelUp ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   notifyDailyReminder: ${user.notifyDailyReminder ? "✅ ВКЛ" : "❌ ВЫКЛ"}\n`);

  // 2. Запланированные уведомления пользователя
  const pendingNotifications = await prisma.scheduledNotification.findMany({
    where: { userId: userId, sentAt: null },
    orderBy: { scheduledAt: "asc" },
  });

  const sentNotifications = await prisma.scheduledNotification.findMany({
    where: { userId: userId, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    take: 5,
  });

  console.log(`📅 ЗАПЛАНИРОВАННЫЕ УВЕДОМЛЕНИЯ (ожидают): ${pendingNotifications.length}`);
  for (const n of pendingNotifications) {
    const scheduledAt = n.scheduledAt;
    const now = new Date();
    const diffMs = scheduledAt.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    console.log(`   [${n.id}] ${n.type}`);
    console.log(`       Запланировано: ${scheduledAt.toISOString()}`);
    if (diffMins > 0) {
      console.log(`       Через: ${diffMins} мин`);
    } else {
      console.log(`       ⚠️ ПРОСРОЧЕНО на ${Math.abs(diffMins)} мин!`);
    }
  }

  console.log(`\n📨 ОТПРАВЛЕННЫЕ УВЕДОМЛЕНИЯ (последние 5):`);
  if (sentNotifications.length === 0) {
    console.log("   Нет отправленных уведомлений");
  }
  for (const n of sentNotifications) {
    console.log(`   [${n.id}] ${n.type}`);
    console.log(`       Отправлено: ${n.sentAt?.toISOString()}`);
  }

  // 3. Общая статистика
  console.log("\n📊 ОБЩАЯ СТАТИСТИКА:");
  
  const totalPending = await prisma.scheduledNotification.count({
    where: { sentAt: null },
  });
  
  const totalSent = await prisma.scheduledNotification.count({
    where: { sentAt: { not: null } },
  });

  const overdue = await prisma.scheduledNotification.count({
    where: { 
      sentAt: null,
      scheduledAt: { lt: new Date() },
    },
  });

  console.log(`   Всего ожидают: ${totalPending}`);
  console.log(`   Просрочены: ${overdue}`);
  console.log(`   Всего отправлено: ${totalSent}`);

  // 4. Последние сессии квизов (чтобы понять когда энергия восстановится)
  const recentSessions = await prisma.quizSession.findMany({
    where: { userId: userId },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      quizId: true,
      startedAt: true,
    },
  });

  console.log("\n🎮 ПОСЛЕДНИЕ СЕССИИ (для расчёта энергии):");
  const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 часа
  
  for (const s of recentSessions) {
    const restoreAt = new Date(s.startedAt.getTime() + COOLDOWN_MS);
    const now = new Date();
    const isRestored = restoreAt < now;
    
    console.log(`   [Session ${s.id}] Quiz ${s.quizId}`);
    console.log(`       Начата: ${s.startedAt.toISOString()}`);
    console.log(`       Энергия восстановится: ${restoreAt.toISOString()} ${isRestored ? "✅ УЖЕ" : "⏳"}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("✅ ПРОВЕРКА ЗАВЕРШЕНА");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
