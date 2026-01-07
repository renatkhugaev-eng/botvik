import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function main() {
  console.log("📊 Проверка недельных очков...\n");

  // Текущая неделя (понедельник 00:00 UTC)
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  console.log(`📅 Текущая неделя: ${weekStart.toISOString()}\n`);

  // Топ-10 за эту неделю
  const topWeekly = await sql`
    SELECT 
      ws."userId",
      u.username,
      u."firstName",
      ws."bestScore",
      ws.quizzes,
      ws."updatedAt"
    FROM "WeeklyScore" ws
    JOIN "User" u ON u.id = ws."userId"
    WHERE ws."weekStart" = ${weekStart}
    ORDER BY ws."bestScore" DESC
    LIMIT 10
  `;

  console.log("🏆 Топ-10 недельного лидерборда:");
  console.log("─".repeat(70));
  
  let rank = 1;
  for (const row of topWeekly) {
    const name = row.username || row.firstName || `User #${row.userId}`;
    const activityBonus = Math.min((row.quizzes as number) * 50, 500);
    const totalScore = (row.bestScore as number) + activityBonus;
    console.log(`#${rank} ${name}: ${totalScore} очков (best: ${row.bestScore}, games: ${row.quizzes}, bonus: +${activityBonus})`);
    rank++;
  }

  // Последние сессии
  console.log("\n📝 Последние 10 завершённых квиз-сессий:");
  console.log("─".repeat(70));
  
  const recentSessions = await sql`
    SELECT 
      qs.id,
      qs."userId",
      u.username,
      q.title as "quizTitle",
      qs."totalScore",
      qs."finishedAt"
    FROM "QuizSession" qs
    JOIN "User" u ON u.id = qs."userId"
    JOIN "Quiz" q ON q.id = qs."quizId"
    WHERE qs."finishedAt" IS NOT NULL
    ORDER BY qs."finishedAt" DESC
    LIMIT 10
  `;

  for (const s of recentSessions) {
    const name = s.username || `User #${s.userId}`;
    const time = new Date(s.finishedAt as string).toLocaleString("ru-RU");
    console.log(`  [${time}] ${name}: "${s.quizTitle}" — ${s.totalScore} очков`);
  }

  // Проверяем сессии новых квизов
  console.log("\n🔪 Сессии каннибальских квизов:");
  console.log("─".repeat(70));
  
  const cannibalSessions = await sql`
    SELECT 
      qs.id,
      qs."userId",
      u.username,
      q.title as "quizTitle",
      qs."totalScore",
      qs."finishedAt"
    FROM "QuizSession" qs
    JOIN "User" u ON u.id = qs."userId"
    JOIN "Quiz" q ON q.id = qs."quizId"
    WHERE q.id >= 32 AND q.id <= 36
    ORDER BY qs."finishedAt" DESC
    LIMIT 20
  `;

  if (cannibalSessions.length === 0) {
    console.log("  (пока никто не играл)");
  } else {
    for (const s of cannibalSessions) {
      const name = s.username || `User #${s.userId}`;
      const time = s.finishedAt ? new Date(s.finishedAt as string).toLocaleString("ru-RU") : "не завершён";
      console.log(`  [${time}] ${name}: "${s.quizTitle}" — ${s.totalScore} очков`);
    }
  }
}

main().catch(console.error);

