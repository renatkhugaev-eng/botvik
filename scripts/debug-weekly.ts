import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🔍 Диагностика WeeklyScore...\n");

  // Все записи WeeklyScore
  const allWeekly = await sql`
    SELECT 
      ws.id,
      ws."userId",
      ws."weekStart",
      ws."bestScore",
      ws.quizzes,
      ws."updatedAt"
    FROM "WeeklyScore" ws
    ORDER BY ws."updatedAt" DESC
    LIMIT 20
  `;

  console.log("📊 Все записи WeeklyScore (последние 20):");
  console.log("─".repeat(80));
  
  if (allWeekly.length === 0) {
    console.log("  ❌ ТАБЛИЦА ПУСТАЯ!");
  } else {
    for (const row of allWeekly) {
      const weekStart = new Date(row.weekStart as string).toISOString().split("T")[0];
      const updated = new Date(row.updatedAt as string).toLocaleString("ru-RU");
      console.log(`  ID ${row.id} | User ${row.userId} | Week ${weekStart} | Best: ${row.bestScore} | Games: ${row.quizzes} | Updated: ${updated}`);
    }
  }

  // Проверяем getWeekStart логику
  console.log("\n📅 Проверка расчёта weekStart:");
  
  const now = new Date();
  console.log(`  Сейчас UTC: ${now.toISOString()}`);
  
  // Логика из lib/week.ts
  const dayOfWeek = now.getUTCDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  console.log(`  День недели UTC: ${dayOfWeek} (0=Вс, 1=Пн...)`);
  console.log(`  Смещение: ${diff} дней назад`);
  console.log(`  weekStart: ${weekStart.toISOString()}`);

  // Проверяем есть ли записи с этим weekStart
  const thisWeek = await sql`
    SELECT COUNT(*) as count FROM "WeeklyScore" 
    WHERE "weekStart" = ${weekStart}
  `;
  console.log(`  Записей за эту неделю: ${(thisWeek[0] as any).count}`);

  // Проверяем формат weekStart в базе
  const sampleWeek = await sql`
    SELECT DISTINCT "weekStart" FROM "WeeklyScore" LIMIT 5
  `;
  console.log("\n📆 Уникальные weekStart в базе:");
  for (const row of sampleWeek) {
    console.log(`  ${row.weekStart}`);
  }
}

main().catch(console.error);

