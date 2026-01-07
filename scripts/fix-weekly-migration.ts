/**
 * Фикс миграции: обновляем WeeklyScore.totalBestScore напрямую через SUM
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔧 Фикс миграции WeeklyScore.totalBestScore...\n");

  // Проверяем что есть в WeeklyQuizBest
  const quizBests = await sql`
    SELECT 
      "userId",
      "weekStart",
      SUM("bestScore") as total,
      COUNT(*) as quiz_count
    FROM "WeeklyQuizBest"
    GROUP BY "userId", "weekStart"
    ORDER BY "weekStart" DESC
    LIMIT 20
  `;

  console.log("📊 WeeklyQuizBest суммы:");
  for (const row of quizBests) {
    console.log(`   User ${row.userId} | Week ${row.weekStart} | Total: ${row.total} | Quizzes: ${row.quiz_count}`);
  }

  // Проверяем WeeklyScore
  console.log("\n📊 WeeklyScore записи:");
  const weeklyScores = await sql`
    SELECT 
      "userId",
      "weekStart",
      "totalBestScore",
      "quizzes"
    FROM "WeeklyScore"
    ORDER BY "updatedAt" DESC
    LIMIT 10
  `;

  for (const row of weeklyScores) {
    console.log(`   User ${row.userId} | Week ${row.weekStart} | totalBestScore: ${row.totalBestScore} | quizzes: ${row.quizzes}`);
  }

  // Обновляем через субзапрос с приведением типов дат
  console.log("\n💾 Обновление totalBestScore через субзапрос...");
  
  const result = await sql`
    UPDATE "WeeklyScore" ws
    SET 
      "totalBestScore" = COALESCE((
        SELECT SUM(wqb."bestScore")
        FROM "WeeklyQuizBest" wqb
        WHERE wqb."userId" = ws."userId" 
          AND DATE(wqb."weekStart") = DATE(ws."weekStart")
      ), 0),
      "quizzes" = COALESCE((
        SELECT COUNT(*)
        FROM "WeeklyQuizBest" wqb
        WHERE wqb."userId" = ws."userId" 
          AND DATE(wqb."weekStart") = DATE(ws."weekStart")
      ), 0)
    RETURNING "userId", "weekStart", "totalBestScore", "quizzes"
  `;

  console.log(`   ✅ Обновлено ${result.length} записей`);

  // Проверяем результат
  console.log("\n📋 Результат:");
  for (const row of result) {
    console.log(`   User ${row.userId} | totalBestScore: ${row.totalBestScore} | quizzes: ${row.quizzes}`);
  }
}

main().catch(console.error);

