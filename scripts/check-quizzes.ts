import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function main() {
  console.log("📊 Проверка квизов в базе...\n");

  // Все квизы
  const all = await sql`SELECT id, title, "isActive" FROM "Quiz" ORDER BY id DESC LIMIT 30`;
  
  console.log("Последние 30 квизов:");
  console.log("─".repeat(80));
  
  for (const q of all) {
    const status = q.isActive ? "✅" : "❌";
    console.log(`${status} #${q.id} ${q.title}`);
  }

  // Статистика
  const activeCount = await sql`SELECT COUNT(*) as count FROM "Quiz" WHERE "isActive" = true`;
  const totalCount = await sql`SELECT COUNT(*) as count FROM "Quiz"`;
  
  console.log("\n" + "─".repeat(80));
  console.log(`📈 Всего квизов: ${(totalCount[0] as any).count}`);
  console.log(`✅ Активных: ${(activeCount[0] as any).count}`);

  // Проверим новые квизы конкретно
  console.log("\n🔪 Каннибальские квизы:");
  const cannibal = await sql`
    SELECT id, title, "isActive", 
           (SELECT COUNT(*) FROM "Question" WHERE "quizId" = "Quiz".id) as questions
    FROM "Quiz" 
    WHERE title ILIKE '%дамер%' 
       OR title ILIKE '%чикатило%' 
       OR title ILIKE '%сагава%'
       OR title ILIKE '%гейн%'
       OR title ILIKE '%каннибал%'
    ORDER BY id
  `;
  
  for (const q of cannibal) {
    const status = q.isActive ? "✅ ACTIVE" : "❌ INACTIVE";
    console.log(`  #${q.id} "${q.title}" — ${status}, ${q.questions} вопросов`);
  }
}

main().catch(console.error);

