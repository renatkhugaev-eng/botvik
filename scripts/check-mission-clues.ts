#!/usr/bin/env npx tsx
/**
 * Проверяем улики в сохранённых миссиях через прямой API запрос
 * 
 * Использование:
 *   npx tsx scripts/check-mission-clues.ts
 */

import "dotenv/config";

// Для локального запуска требуется DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.log("❌ DATABASE_URL не настроен");
  console.log("\nАльтернативный способ проверки:");
  console.log("1. Открой /admin/panorama/missions в браузере");
  console.log("2. Посмотри clueCount для каждой миссии");
  console.log("3. Или проверь в приложении — если при нажатии на миссию улики не появляются, их нет");
  console.log("\nИли проверь через Vercel Dashboard → Data → PanoramaMission table");
  process.exit(0);
}

// Динамический импорт после проверки env
import("@neondatabase/serverless").then(async ({ Pool }) => {
  const pool = new Pool({ connectionString });
  
  try {
    console.log("\n🔍 Проверка улик в панорамных миссиях...\n");
    
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        location,
        "clueCount",
        "missionJson"::text as mission_json_str
      FROM "PanoramaMission"
      WHERE "isPublished" = true
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log("⚠️ Нет опубликованных миссий в БД");
      return;
    }
    
    console.log(`📊 Найдено ${result.rows.length} миссий:\n`);
    
    for (const row of result.rows) {
      const missionJson = JSON.parse(row.mission_json_str);
      const cluesInJson = missionJson.clues || [];
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🗺️  ${row.title}`);
      console.log(`   📍 ${row.location}`);
      console.log(`   📊 clueCount в таблице: ${row.clueCount}`);
      console.log(`   🔎 Улик в missionJson: ${cluesInJson.length}`);
      
      if (cluesInJson.length > 0) {
        console.log(`   ✅ Улики есть:`);
        for (const clue of cluesInJson.slice(0, 3)) {
          console.log(`      - ${clue.name} (${clue.icon || "?"}) @ pano ${clue.panoId?.slice(0, 15)}...`);
        }
        if (cluesInJson.length > 3) {
          console.log(`      ... и ещё ${cluesInJson.length - 3}`);
        }
      } else {
        console.log(`   ❌ УЛИК НЕТ! Миссия пустая.`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Статистика
    const missionsWithClues = result.rows.filter(r => {
      const mj = JSON.parse(r.mission_json_str);
      return (mj.clues || []).length > 0;
    }).length;
    
    console.log(`\n📈 Итог: ${missionsWithClues}/${result.rows.length} миссий с улики`);
    
    if (missionsWithClues < result.rows.length) {
      console.log(`\n⚠️  Некоторые миссии без улик!`);
      console.log(`   Возможные причины:`);
      console.log(`   - Граф был слишком маленький при генерации`);
      console.log(`   - Ошибка при сохранении missionJson`);
      console.log(`\n💡 Решение: пересгенерируй эти миссии с большим maxDepth/maxNodes`);
    }
    
  } catch (error) {
    console.error("❌ Ошибка:", error);
  } finally {
    await pool.end();
  }
});
