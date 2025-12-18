import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== ПОСЛЕДНИЕ 10 СЕССИЙ ===\n');
  
  const sessions = await prisma.quizSession.findMany({
    take: 10,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      userId: true,
      quizId: true,
      totalScore: true,
      currentStreak: true,
      maxStreak: true,
      finishedAt: true,
    }
  });
  
  console.table(sessions);
  
  console.log('\n=== СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ (топ 5 по XP) ===\n');
  
  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { xp: 'desc' },
    select: {
      id: true,
      username: true,
      xp: true,
      dailyRewardStreak: true,
      bonusEnergy: true,
      bonusEnergyEarned: true,
      bonusEnergyUsed: true,
    }
  });
  
  console.table(users);
  
  console.log('\n=== ДОСТИЖЕНИЯ (последние 10) ===\n');
  
  const achievements = await prisma.userAchievement.findMany({
    take: 10,
    orderBy: { unlockedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      achievementId: true,
      progress: true,
      unlockedAt: true,
    }
  });
  
  console.table(achievements);
  
  await prisma.$disconnect();
}

main().catch(console.error);
