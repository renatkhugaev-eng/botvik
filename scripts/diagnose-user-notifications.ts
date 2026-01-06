/**
 * Диагностика уведомлений для конкретного пользователя
 * 
 * Использование:
 *   npx tsx scripts/diagnose-user-notifications.ts <telegramId>
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Загружаем .env и .env.local
const envPath = path.resolve(process.cwd(), ".env");
const envLocalPath = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL не найден!");
  console.log("\nПроверь файлы:");
  console.log(`   .env: ${fs.existsSync(envPath) ? "✅ существует" : "❌ нет"}`);
  console.log(`   .env.local: ${fs.existsSync(envLocalPath) ? "✅ существует" : "❌ нет"}`);
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.log("❌ Укажи Telegram ID:");
    console.log("   npx tsx scripts/diagnose-user-notifications.ts <telegramId>");
    process.exit(1);
  }

  console.log("\n🔍 Диагностика уведомлений");
  console.log("═".repeat(50));

  // 1. Проверяем переменные окружения
  console.log("\n📋 Переменные окружения:");
  console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? "✅ настроен" : "❌ НЕ НАСТРОЕН"}`);
  console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? "✅ настроен" : "❌ НЕ НАСТРОЕН"}`);
  console.log(`   DATABASE_URL: ${connectionString ? "✅ настроен" : "❌ НЕ НАСТРОЕН"}`);

  // 2. Ищем пользователя
  console.log(`\n👤 Поиск пользователя с Telegram ID: ${telegramId}...`);
  
  const user = await prisma.user.findFirst({
    where: { telegramId },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      username: true,
      lastNotifiedAt: true,
      lastQuizAt: true,
      notifyLevelUp: true,
      notifyEnergyFull: true,
      notifyDailyReminder: true,
      notifyLeaderboard: true,
      notifyFriends: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь НЕ НАЙДЕН в базе данных!");
    console.log("   Возможно он ещё не открывал приложение.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ Пользователь найден:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Имя: ${user.firstName} (@${user.username || "нет"})`);
  console.log(`   Telegram ID: ${user.telegramId}`);

  // 3. Настройки уведомлений
  console.log("\n📢 Настройки уведомлений:");
  console.log(`   Level Up:       ${user.notifyLevelUp ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Energy Full:    ${user.notifyEnergyFull ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Daily Reminder: ${user.notifyDailyReminder ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Leaderboard:    ${user.notifyLeaderboard ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
  console.log(`   Friends/Duels:  ${user.notifyFriends ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);

  const allEnabled = user.notifyLevelUp && user.notifyEnergyFull && 
                     user.notifyDailyReminder && user.notifyLeaderboard && user.notifyFriends;
  
  if (!allEnabled) {
    console.log("\n⚠️  ПРОБЛЕМА: Некоторые уведомления ВЫКЛЮЧЕНЫ!");
    console.log("   Включи их в настройках приложения.");
  }

  // 4. Rate limit
  console.log("\n⏰ Rate Limit:");
  if (user.lastNotifiedAt) {
    const lastNotified = new Date(user.lastNotifiedAt);
    const timeSince = Date.now() - lastNotified.getTime();
    const minutesAgo = Math.floor(timeSince / 60000);
    const hoursAgo = Math.floor(timeSince / 3600000);
    
    console.log(`   Последнее уведомление: ${lastNotified.toLocaleString()}`);
    console.log(`   Прошло: ${hoursAgo > 0 ? `${hoursAgo} ч ` : ""}${minutesAgo % 60} мин`);
    
    if (timeSince < 3600000) {
      console.log(`   ⚠️  Rate limit активен! Ждать ещё ${60 - minutesAgo} мин`);
      console.log(`   (Это влияет ТОЛЬКО на friend_activity, не на дуэли и daily)"`);
    } else {
      console.log(`   ✅ Rate limit не активен`);
    }
  } else {
    console.log(`   ✅ Уведомления ещё не отправлялись (нет rate limit)`);
  }

  // 5. Daily reminder eligibility
  console.log("\n📅 Daily Reminder:");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (user.lastQuizAt) {
    const lastQuiz = new Date(user.lastQuizAt);
    const playedToday = lastQuiz >= today;
    
    console.log(`   Последний квиз: ${lastQuiz.toLocaleString()}`);
    console.log(`   Играл сегодня: ${playedToday ? "✅ Да" : "❌ Нет"}`);
    
    if (playedToday) {
      console.log(`   → Daily reminder НЕ отправится (уже играл сегодня)`);
    } else if (!user.notifyDailyReminder) {
      console.log(`   → Daily reminder НЕ отправится (ВЫКЛЮЧЕН в настройках)`);
    } else {
      console.log(`   → Daily reminder ДОЛЖЕН отправиться в 18:00 UTC`);
    }
  } else {
    console.log(`   Квизы ещё не проходились`);
    if (user.notifyDailyReminder) {
      console.log(`   → Daily reminder ДОЛЖЕН отправиться в 18:00 UTC`);
    }
  }

  // 6. Pending scheduled notifications
  console.log("\n📬 Запланированные уведомления:");
  const pending = await prisma.scheduledNotification.findMany({
    where: { userId: user.id, sentAt: null },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  if (pending.length === 0) {
    console.log(`   Нет запланированных уведомлений`);
  } else {
    for (const n of pending) {
      console.log(`   - ${n.type} → ${new Date(n.scheduledAt).toLocaleString()}`);
    }
  }

  // 7. Recent sent notifications
  console.log("\n📤 Последние отправленные уведомления:");
  const recent = await prisma.scheduledNotification.findMany({
    where: { userId: user.id, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    take: 5,
  });

  if (recent.length === 0) {
    console.log(`   Нет отправленных уведомлений (через scheduler)`);
  } else {
    for (const n of recent) {
      console.log(`   - ${n.type} → ${new Date(n.sentAt!).toLocaleString()}`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 ИТОГ:");
  
  const issues: string[] = [];
  
  if (!user.notifyDailyReminder) issues.push("Daily Reminder ВЫКЛЮЧЕН");
  if (!user.notifyLevelUp) issues.push("Level Up ВЫКЛЮЧЕН");
  if (!user.notifyEnergyFull) issues.push("Energy Full ВЫКЛЮЧЕН");
  if (!user.notifyLeaderboard) issues.push("Leaderboard ВЫКЛЮЧЕН");
  if (!process.env.CRON_SECRET) issues.push("CRON_SECRET не настроен");
  
  if (issues.length === 0) {
    console.log("   ✅ Всё настроено правильно!");
    console.log("   Уведомления должны приходить.");
    console.log("\n   Если не приходят — проверь Vercel Cron Logs.");
  } else {
    console.log("   ⚠️  Найдены проблемы:");
    for (const issue of issues) {
      console.log(`   - ${issue}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);

