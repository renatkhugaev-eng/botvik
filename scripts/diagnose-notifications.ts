/**
 * Диагностика почему уведомления не приходят
 * Запуск: npx ts-node scripts/diagnose-notifications.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const MAX_ENERGY = 5;
const HOURS_PER_ENERGY = 4;
const ENERGY_COOLDOWN_MS = HOURS_PER_ENERGY * 60 * 60 * 1000;

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`🔍 ДИАГНОСТИКА УВЕДОМЛЕНИЙ USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Check user XP history for level ups
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      xp: true,
      lastQuizAt: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  // Calculate current and previous level
  const currentXp = user.xp;
  const currentLevel = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (4 * currentXp) / 50)) / 2));
  
  // XP needed for current level and next
  const xpForCurrentLevel = 50 * currentLevel * (currentLevel + 1) / 2;
  const xpForNextLevel = 50 * (currentLevel + 1) * (currentLevel + 2) / 2;
  const xpToNextLevel = xpForNextLevel - currentXp;

  console.log("📊 LEVEL UP АНАЛИЗ:");
  console.log(`   Текущий XP: ${currentXp}`);
  console.log(`   Текущий уровень: ${currentLevel}`);
  console.log(`   XP до следующего уровня: ${xpToNextLevel}`);
  console.log(`   Последний квиз: ${user.lastQuizAt?.toISOString() ?? "никогда"}`);
  console.log("");

  // Get last 5 quiz sessions to see XP earned
  const recentSessions = await prisma.quizSession.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: 5,
    select: {
      id: true,
      quizId: true,
      totalScore: true,
      finishedAt: true,
    },
  });

  console.log("📝 ПОСЛЕДНИЕ 5 КВИЗОВ:");
  for (const session of recentSessions) {
    const timeAgo = session.finishedAt 
      ? Math.round((Date.now() - session.finishedAt.getTime()) / 60000)
      : 0;
    console.log(`   Quiz ${session.quizId}: ${session.totalScore} очков (${timeAgo} мин назад)`);
  }
  console.log("");

  // 2. Energy notification analysis
  console.log("⚡ ENERGY NOTIFICATION АНАЛИЗ:");
  
  const fourHoursAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS);
  const fiveHoursAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS - 60 * 60 * 1000);
  
  // Sessions that would trigger energy notification
  const sessionsInWindow = await prisma.quizSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: fiveHoursAgo,
        lte: fourHoursAgo,
      },
    },
    select: { id: true, startedAt: true },
  });

  console.log(`   Окно проверки: ${fiveHoursAgo.toISOString()} - ${fourHoursAgo.toISOString()}`);
  console.log(`   Сессий в окне: ${sessionsInWindow.length}`);
  
  if (sessionsInWindow.length === 0) {
    console.log("   ⚠️  НЕТ сессий в окне 4-5 часов назад!");
    console.log("   → Cron не будет отправлять уведомление");
  } else {
    console.log("   ✅ Есть сессии в окне — cron ДОЛЖЕН был отправить уведомление");
  }
  console.log("");

  // Check when next energy slot restores
  const cooldownAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS);
  const activeSessions = await prisma.quizSession.findMany({
    where: {
      userId,
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  console.log("🔋 СЛЕДУЮЩЕЕ ВОССТАНОВЛЕНИЕ:");
  if (activeSessions.length > 0) {
    const oldestSession = activeSessions[0];
    const restoredAt = new Date(oldestSession.startedAt.getTime() + ENERGY_COOLDOWN_MS);
    const inMinutes = Math.ceil((restoredAt.getTime() - Date.now()) / 60000);
    
    if (inMinutes > 0) {
      console.log(`   Следующая энергия через: ${Math.floor(inMinutes / 60)}ч ${inMinutes % 60}м`);
      console.log(`   Время: ${restoredAt.toISOString()}`);
      
      // Calculate when cron will run after that
      const cronMinute = 30;
      const restoreMinute = restoredAt.getMinutes();
      const restoreHour = restoredAt.getHours();
      
      let cronHour = restoreHour;
      if (restoreMinute > cronMinute) {
        cronHour = (cronHour + 1) % 24;
      }
      
      console.log(`   Cron запустится примерно в: ${cronHour}:30`);
      console.log(`   → Уведомление придёт примерно через ${inMinutes + (60 - (inMinutes % 60))} мин`);
    } else {
      console.log(`   ✅ Энергия уже восстановлена!`);
    }
  } else {
    console.log(`   ✅ Все 5 энергий доступны!`);
  }
  console.log("");

  // 3. Check if bot token is in production env
  console.log("🔧 РЕКОМЕНДАЦИИ:");
  console.log("   1. Проверь логи Vercel на /api/cron/energy-notifications");
  console.log("   2. Убедись что TELEGRAM_BOT_TOKEN есть в Vercel Environment Variables");
  console.log("   3. Level Up уведомления приходят ТОЛЬКО при повышении уровня");
  console.log("   4. Energy уведомления приходят через Vercel Cron (каждый час в :30)");
  
  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
