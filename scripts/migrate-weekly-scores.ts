/**
 * Миграция данных: заполнение WeeklyQuizBest из существующих QuizSession
 * И обновление WeeklyScore.totalBestScore
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

// Получить начало недели (понедельник 00:00 UTC)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🔄 Миграция недельных очков на новую систему...\n");

  // 1. Получаем все завершённые сессии
  console.log("📊 Получение всех завершённых сессий...");
  const sessions = await sql`
    SELECT 
      qs."userId",
      qs."quizId",
      qs."totalScore",
      qs."finishedAt"
    FROM "QuizSession" qs
    WHERE qs."finishedAt" IS NOT NULL
    ORDER BY qs."finishedAt" ASC
  `;

  console.log(`   Найдено ${sessions.length} сессий\n`);

  // 2. Группируем по (userId, weekStart, quizId) и находим лучший результат
  type WeeklyQuizKey = string; // `${userId}_${weekStartISO}_${quizId}`
  const weeklyQuizBests: Map<WeeklyQuizKey, {
    userId: number;
    weekStart: Date;
    quizId: number;
    bestScore: number;
    attempts: number;
  }> = new Map();

  for (const session of sessions) {
    const weekStart = getWeekStart(new Date(session.finishedAt as string));
    const key = `${session.userId}_${weekStart.toISOString()}_${session.quizId}`;
    
    const existing = weeklyQuizBests.get(key);
    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, session.totalScore as number);
      existing.attempts += 1;
    } else {
      weeklyQuizBests.set(key, {
        userId: session.userId as number,
        weekStart,
        quizId: session.quizId as number,
        bestScore: session.totalScore as number,
        attempts: 1,
      });
    }
  }

  console.log(`📈 Вычислено ${weeklyQuizBests.size} записей WeeklyQuizBest\n`);

  // 3. Вставляем в WeeklyQuizBest
  console.log("💾 Вставка WeeklyQuizBest...");
  let insertedQuizBests = 0;
  
  for (const entry of weeklyQuizBests.values()) {
    try {
      await sql`
        INSERT INTO "WeeklyQuizBest" ("userId", "weekStart", "quizId", "bestScore", "attempts", "updatedAt")
        VALUES (${entry.userId}, ${entry.weekStart}, ${entry.quizId}, ${entry.bestScore}, ${entry.attempts}, NOW())
        ON CONFLICT ("userId", "weekStart", "quizId") 
        DO UPDATE SET 
          "bestScore" = GREATEST("WeeklyQuizBest"."bestScore", ${entry.bestScore}),
          "attempts" = "WeeklyQuizBest"."attempts" + ${entry.attempts},
          "updatedAt" = NOW()
      `;
      insertedQuizBests++;
    } catch (e) {
      console.error(`   Ошибка для userId=${entry.userId}, quizId=${entry.quizId}:`, e);
    }
  }
  
  console.log(`   ✅ Вставлено ${insertedQuizBests} записей\n`);

  // 4. Обновляем WeeklyScore.totalBestScore на основе WeeklyQuizBest
  console.log("📊 Обновление WeeklyScore.totalBestScore...");
  
  // Получаем суммы по (userId, weekStart)
  const totals = await sql`
    SELECT 
      "userId",
      "weekStart",
      SUM("bestScore") as "totalBest",
      COUNT(*) as "quizCount"
    FROM "WeeklyQuizBest"
    GROUP BY "userId", "weekStart"
  `;

  let updatedScores = 0;
  for (const row of totals) {
    try {
      await sql`
        UPDATE "WeeklyScore"
        SET 
          "totalBestScore" = ${row.totalBest},
          "quizzes" = ${row.quizCount},
          "updatedAt" = NOW()
        WHERE "userId" = ${row.userId} AND "weekStart" = ${row.weekStart}
      `;
      updatedScores++;
    } catch (e) {
      // WeeklyScore может не существовать для некоторых комбинаций
      // Это нормально
    }
  }

  console.log(`   ✅ Обновлено ${updatedScores} записей WeeklyScore\n`);

  // 5. Проверка результатов
  console.log("🔍 Проверка результатов...");
  
  const sampleUsers = await sql`
    SELECT 
      ws."userId",
      u.username,
      ws."weekStart",
      ws."totalBestScore",
      ws."quizzes",
      ws."bestScore" as "oldBestScore"
    FROM "WeeklyScore" ws
    JOIN "User" u ON u.id = ws."userId"
    ORDER BY ws."updatedAt" DESC
    LIMIT 5
  `;

  console.log("\n📋 Примеры обновлённых записей:");
  console.log("─".repeat(80));
  for (const row of sampleUsers) {
    const weekStr = new Date(row.weekStart as string).toISOString().split("T")[0];
    console.log(`   ${row.username || `User #${row.userId}`} | Неделя ${weekStr}`);
    console.log(`   └─ totalBestScore: ${row.totalBestScore} (было bestScore: ${row.oldBestScore})`);
    console.log(`   └─ quizzes: ${row.quizzes}`);
    console.log();
  }

  console.log("✅ Миграция завершена!");
}

main().catch(console.error);

