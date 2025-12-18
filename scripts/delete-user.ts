/**
 * Скрипт для полного удаления пользователя и всех связанных данных
 * Запуск: npx tsx scripts/delete-user.ts <username>
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function deleteUser(username: string) {
  console.log(`\n🔍 Поиск пользователя: ${username}\n`);

  const user = await prisma.user.findFirst({
    where: { username },
    select: {
      id: true,
      telegramId: true,
      username: true,
      xp: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.log(`❌ Пользователь "${username}" не найден`);
    return;
  }

  console.log(`✅ Найден пользователь:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Telegram ID: ${user.telegramId}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   XP: ${user.xp}`);
  console.log(`   Создан: ${user.createdAt.toISOString()}\n`);

  // Подсчитываем связанные данные
  const [
    sessionsCount,
    answersCount,
    achievementsCount,
    leaderboardCount,
    weeklyScoresCount,
    tournamentParticipations,
    tournamentResults,
    referralsCount,
  ] = await Promise.all([
    prisma.quizSession.count({ where: { userId: user.id } }),
    prisma.answer.count({ where: { session: { userId: user.id } } }),
    prisma.userAchievement.count({ where: { userId: user.id } }),
    prisma.leaderboardEntry.count({ where: { userId: user.id } }),
    prisma.weeklyScore.count({ where: { userId: user.id } }),
    prisma.tournamentParticipant.count({ where: { userId: user.id } }),
    prisma.tournamentStageResult.count({ where: { userId: user.id } }),
    prisma.user.count({ where: { referredById: user.id } }),
  ]);

  console.log(`📊 Связанные данные:`);
  console.log(`   Quiz Sessions: ${sessionsCount}`);
  console.log(`   Answers: ${answersCount}`);
  console.log(`   Achievements: ${achievementsCount}`);
  console.log(`   Leaderboard Entries: ${leaderboardCount}`);
  console.log(`   Weekly Scores: ${weeklyScoresCount}`);
  console.log(`   Tournament Participations: ${tournamentParticipations}`);
  console.log(`   Tournament Stage Results: ${tournamentResults}`);
  console.log(`   Referrals (пользователи, приглашённые им): ${referralsCount}`);
  console.log();

  // Удаляем все данные в правильном порядке (с учётом foreign keys)
  console.log(`🗑️  Удаление данных...`);

  // 1. Удаляем ответы (зависят от сессий)
  const deletedAnswers = await prisma.answer.deleteMany({
    where: { session: { userId: user.id } },
  });
  console.log(`   ✓ Answers: ${deletedAnswers.count}`);

  // 2. Удаляем quiz sessions
  const deletedSessions = await prisma.quizSession.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Quiz Sessions: ${deletedSessions.count}`);

  // 3. Удаляем достижения
  const deletedAchievements = await prisma.userAchievement.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Achievements: ${deletedAchievements.count}`);

  // 4. Удаляем leaderboard entries
  const deletedLeaderboard = await prisma.leaderboardEntry.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Leaderboard Entries: ${deletedLeaderboard.count}`);

  // 4.5 Удаляем weekly scores
  const deletedWeeklyScores = await prisma.weeklyScore.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Weekly Scores: ${deletedWeeklyScores.count}`);

  // 5. Удаляем tournament stage results
  const deletedTournamentResults = await prisma.tournamentStageResult.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Tournament Stage Results: ${deletedTournamentResults.count}`);

  // 6. Удаляем tournament participations
  const deletedTournamentParts = await prisma.tournamentParticipant.deleteMany({
    where: { userId: user.id },
  });
  console.log(`   ✓ Tournament Participations: ${deletedTournamentParts.count}`);

  // 7. Обнуляем referredById у приглашённых пользователей
  const updatedReferrals = await prisma.user.updateMany({
    where: { referredById: user.id },
    data: { referredById: null },
  });
  console.log(`   ✓ Referrals unlinked: ${updatedReferrals.count}`);

  // 8. Удаляем пользователя
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`   ✓ User deleted`);

  console.log(`\n✅ Пользователь "${username}" полностью удалён!\n`);
}

// Main
const username = process.argv[2];

if (!username) {
  console.log("Usage: npx tsx scripts/delete-user.ts <username>");
  process.exit(1);
}

deleteUser(username)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
