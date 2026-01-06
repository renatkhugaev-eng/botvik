#!/usr/bin/env npx tsx
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSIONS VALIDATOR
 * Проверяет корректность данных миссий:
 * - Валидность panoId (через Google API)
 * - Наличие улик с корректными данными
 * - Корректность координат
 * ═══════════════════════════════════════════════════════════════════════════
 */

import "dotenv/config";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

interface Clue {
  id: string;
  panoId: string;
  revealHeading: number;
  coneDegrees: number;
  dwellTime: number;
  name: string;
  icon: string;
  xpReward: number;
  hintText?: string;
  scannerHint?: string;
}

interface Mission {
  id: string;
  title: string;
  location: string;
  startPanoId: string;
  startCoordinates: [number, number];
  clues: Clue[];
  allowNavigation: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE STREET VIEW API CHECK
// ═══════════════════════════════════════════════════════════════════════════

async function checkPanorama(panoId: string): Promise<{
  exists: boolean;
  hasLinks: boolean;
  linksCount: number;
  error?: string;
}> {
  if (!GOOGLE_MAPS_KEY) {
    return { exists: true, hasLinks: true, linksCount: 0, error: "No API key - skipped" };
  }

  try {
    // Street View Metadata API
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?pano=${panoId}&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return { 
        exists: true, 
        hasLinks: true, // Metadata API doesn't return links, assume true
        linksCount: -1 
      };
    } else if (data.status === "ZERO_RESULTS") {
      return { exists: false, hasLinks: false, linksCount: 0, error: "Panorama not found" };
    } else {
      return { exists: false, hasLinks: false, linksCount: 0, error: data.status };
    }
  } catch (error) {
    return { 
      exists: false, 
      hasLinks: false, 
      linksCount: 0, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function validateCoordinates(coords: [number, number]): string[] {
  const errors: string[] = [];
  const [lat, lng] = coords;

  if (lat < -90 || lat > 90) {
    errors.push(`Latitude ${lat} out of range [-90, 90]`);
  }
  if (lng < -180 || lng > 180) {
    errors.push(`Longitude ${lng} out of range [-180, 180]`);
  }

  return errors;
}

function validateClue(clue: Clue, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Clue #${index + 1} "${clue.name}"`;

  if (!clue.id) errors.push(`${prefix}: missing id`);
  if (!clue.panoId) errors.push(`${prefix}: missing panoId`);
  if (!clue.name) errors.push(`${prefix}: missing name`);
  if (!clue.icon) errors.push(`${prefix}: missing icon`);

  if (clue.revealHeading < 0 || clue.revealHeading > 360) {
    errors.push(`${prefix}: revealHeading ${clue.revealHeading} out of range [0, 360]`);
  }

  if (clue.coneDegrees < 5 || clue.coneDegrees > 180) {
    errors.push(`${prefix}: coneDegrees ${clue.coneDegrees} out of range [5, 180]`);
  }

  if (clue.dwellTime < 0.5 || clue.dwellTime > 10) {
    errors.push(`${prefix}: dwellTime ${clue.dwellTime} out of range [0.5, 10]`);
  }

  if (clue.xpReward < 1 || clue.xpReward > 500) {
    errors.push(`${prefix}: xpReward ${clue.xpReward} out of range [1, 500]`);
  }

  return errors;
}

async function validateMission(mission: Mission): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  panoChecks: { panoId: string; exists: boolean; error?: string }[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const panoChecks: { panoId: string; exists: boolean; error?: string }[] = [];

  // Basic validation
  if (!mission.id) errors.push("Missing mission id");
  if (!mission.title) errors.push("Missing mission title");
  if (!mission.startPanoId) errors.push("Missing startPanoId");

  // Coordinates
  if (mission.startCoordinates) {
    errors.push(...validateCoordinates(mission.startCoordinates));
  } else {
    errors.push("Missing startCoordinates");
  }

  // Navigation
  if (!mission.allowNavigation) {
    warnings.push("allowNavigation is false - user cannot move");
  }

  // Clues
  if (!mission.clues || mission.clues.length === 0) {
    errors.push("No clues in mission");
  } else {
    for (let i = 0; i < mission.clues.length; i++) {
      errors.push(...validateClue(mission.clues[i], i));
    }

    // Check for duplicate panoIds in clues (might be intentional)
    const panoIds = mission.clues.map(c => c.panoId);
    const uniquePanoIds = new Set(panoIds);
    if (uniquePanoIds.size < panoIds.length) {
      warnings.push(`Multiple clues on same panorama (${panoIds.length - uniquePanoIds.size} duplicates)`);
    }
  }

  // Check panoramas via API
  console.log(`   Checking ${mission.clues?.length || 0 + 1} panoramas...`);
  
  // Start pano
  const startCheck = await checkPanorama(mission.startPanoId);
  panoChecks.push({ panoId: mission.startPanoId, exists: startCheck.exists, error: startCheck.error });
  if (!startCheck.exists) {
    errors.push(`Start panorama not found: ${mission.startPanoId}`);
  }

  // Clue panos (unique only)
  if (mission.clues) {
    const uniqueCluePanos = [...new Set(mission.clues.map(c => c.panoId))];
    for (const panoId of uniqueCluePanos) {
      if (panoId === mission.startPanoId) continue; // Already checked
      
      const check = await checkPanorama(panoId);
      panoChecks.push({ panoId, exists: check.exists, error: check.error });
      if (!check.exists) {
        errors.push(`Clue panorama not found: ${panoId}`);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    panoChecks,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n🔍 PANORAMA MISSIONS VALIDATOR");
  console.log("═".repeat(60));

  if (!GOOGLE_MAPS_KEY) {
    console.log("⚠️  NEXT_PUBLIC_GOOGLE_MAPS_KEY not set - panorama checks will be skipped\n");
  }

  // Connect to DB
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString });

  try {
    // Fetch missions
    const result = await pool.query(`
      SELECT id, title, location, "missionJson"::text as mission_json
      FROM "PanoramaMission"
      WHERE "isPublished" = true
      ORDER BY "createdAt" DESC
    `);

    if (result.rows.length === 0) {
      console.log("⚠️  No published missions found");
      return;
    }

    console.log(`📊 Found ${result.rows.length} published missions\n`);

    let totalErrors = 0;
    let totalWarnings = 0;
    let validMissions = 0;

    for (const row of result.rows) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🗺️  ${row.title}`);
      console.log(`   📍 ${row.location}`);
      console.log(`   🆔 ${row.id}`);

      const mission = JSON.parse(row.mission_json) as Mission;
      const validation = await validateMission(mission);

      if (validation.valid) {
        console.log(`   ✅ VALID`);
        validMissions++;
      } else {
        console.log(`   ❌ INVALID`);
      }

      if (validation.errors.length > 0) {
        console.log(`   🚫 Errors (${validation.errors.length}):`);
        for (const err of validation.errors) {
          console.log(`      - ${err}`);
        }
        totalErrors += validation.errors.length;
      }

      if (validation.warnings.length > 0) {
        console.log(`   ⚠️  Warnings (${validation.warnings.length}):`);
        for (const warn of validation.warnings) {
          console.log(`      - ${warn}`);
        }
        totalWarnings += validation.warnings.length;
      }

      // Clue summary
      console.log(`   📦 Clues: ${mission.clues?.length || 0}`);
      if (mission.clues && mission.clues.length > 0) {
        for (const clue of mission.clues.slice(0, 3)) {
          console.log(`      ${clue.icon} ${clue.name} (+${clue.xpReward} XP)`);
        }
        if (mission.clues.length > 3) {
          console.log(`      ... and ${mission.clues.length - 3} more`);
        }
      }

      // Pano checks summary
      const failedPanos = validation.panoChecks.filter(p => !p.exists);
      if (failedPanos.length > 0) {
        console.log(`   🌐 Panorama issues: ${failedPanos.length}`);
      } else if (GOOGLE_MAPS_KEY) {
        console.log(`   🌐 All panoramas valid ✓`);
      }

      console.log("");
    }

    // Summary
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📈 SUMMARY`);
    console.log(`   Missions: ${validMissions}/${result.rows.length} valid`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Warnings: ${totalWarnings}`);

    if (totalErrors === 0) {
      console.log(`\n✅ All missions passed validation!`);
    } else {
      console.log(`\n❌ Some missions have issues - fix before deploying`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

