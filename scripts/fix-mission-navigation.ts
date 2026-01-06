#!/usr/bin/env npx tsx
/**
 * FIX: Set allowNavigation = true for all published missions
 * 
 * Проблема: Zod схема отбрасывала allowNavigation при сохранении
 * Решение: Обновить missionJson для всех миссий
 */

import "dotenv/config";

async function main() {
  console.log("\n🔧 FIX: allowNavigation for all missions");
  console.log("═".repeat(50));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString });

  try {
    // Get all missions
    const result = await pool.query(`
      SELECT id, title, "missionJson"::text as mission_json
      FROM "PanoramaMission"
    `);

    console.log(`📊 Found ${result.rows.length} missions to fix\n`);

    let fixed = 0;
    let alreadyOk = 0;

    for (const row of result.rows) {
      const mission = JSON.parse(row.mission_json);
      
      if (mission.allowNavigation === true) {
        console.log(`   ✓ ${row.title} - already OK`);
        alreadyOk++;
        continue;
      }

      // Fix the mission
      mission.allowNavigation = true;
      
      // Update in DB
      await pool.query(`
        UPDATE "PanoramaMission"
        SET "missionJson" = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(mission), row.id]);

      console.log(`   ✅ ${row.title} - FIXED`);
      fixed++;
    }

    console.log("\n" + "═".repeat(50));
    console.log(`📈 RESULT:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Already OK: ${alreadyOk}`);
    console.log(`   Total: ${result.rows.length}`);

    if (fixed > 0) {
      console.log(`\n✅ Navigation enabled for ${fixed} missions!`);
      console.log(`   Users can now move around in panoramas.`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

