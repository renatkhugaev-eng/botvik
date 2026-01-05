/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR API v3.0.0
 * POST /api/admin/panorama/generate
 * 
 * Генерирует панорамную миссию на основе координат и темы
 * 
 * Улучшения v3.0.0:
 * - Zod валидация входных данных
 * - Сохранение в БД (Prisma)
 * - Seed для воспроизводимости
 * - Улучшенное логирование
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { generateMission, toHiddenClueMission, getAllThemes, GENERATOR_VERSION } from "@/lib/mission-generator";
import { graphFromSerializable } from "@/lib/panorama-graph-builder";
import { 
  safeValidateGenerateRequest, 
  MissionThemeTypeSchema,
  DifficultySchema,
} from "@/lib/schemas/panorama-mission";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING (простой in-memory для админки)
// ═══════════════════════════════════════════════════════════════════════════

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // Максимум запросов
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // За 1 минуту

function checkRateLimit(adminId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(adminId);
  
  if (!record || record.resetAt < now) {
    rateLimitMap.set(adminId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Получить список доступных тем
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  try {
    const themes = getAllThemes().map(theme => ({
      type: theme.type,
      title: theme.title,
      description: theme.description,
      icon: theme.icon,
      color: theme.color,
      clueCount: theme.clueTemplates.length,
    }));
    
    // Получаем статистику сохранённых миссий
    const missionStats = await prisma.panoramaMission.groupBy({
      by: ["theme"],
      _count: { id: true },
      where: { isPublished: true },
    });
    
    const statsMap = Object.fromEntries(
      missionStats.map(s => [s.theme, s._count.id])
    );
    
    return NextResponse.json({
      ok: true,
      themes: themes.map(t => ({
        ...t,
        publishedMissions: statsMap[t.type] || 0,
      })),
      validDifficulties: DifficultySchema.options,
      validThemes: MissionThemeTypeSchema.options,
      generatorVersion: GENERATOR_VERSION,
    });
  } catch (error) {
    console.error("[Admin Panorama] Error fetching themes:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch themes" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST - Сгенерировать миссию
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  // Rate limiting (используем telegramId админа)
  const adminId = auth.user.telegramId;
  const rateLimit = checkRateLimit(adminId);
  
  if (!rateLimit.allowed) {
    console.warn(`[Admin Panorama] Rate limit exceeded for admin ${adminId}`);
    return NextResponse.json(
      { 
        ok: false, 
        error: "Слишком много запросов. Подождите минуту.",
        retryAfter: 60,
      },
      { 
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }
  
  try {
    const rawBody = await req.json();
    
    // ═══════════════════════════════════════════════════════════════════════
    // ZOD ВАЛИДАЦИЯ
    // ═══════════════════════════════════════════════════════════════════════
    
    const validation = safeValidateGenerateRequest(rawBody);
    
    if (!validation.success) {
      console.warn(`[Admin Panorama] Validation failed: ${validation.error}`);
      return NextResponse.json(
        { 
          ok: false, 
          error: `Ошибка валидации: ${validation.error}`,
          validationError: true,
        },
        { status: 400 }
      );
    }
    
    const body = validation.data;
    
    console.log(
      `[Admin Panorama] Generating mission: ` +
      `theme=${body.theme}, clues=${body.clueCount}, ` +
      `location=${body.locationName || "unknown"}, ` +
      `seed=${body.seed || "auto"}`
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // ГЕНЕРАЦИЯ
    // ═══════════════════════════════════════════════════════════════════════
    
    // Восстанавливаем граф из сериализованного формата
    const graph = graphFromSerializable(body.graph);
    
    // Генерируем миссию с опциональным seed
    const result = generateMission(
      graph,
      {
        coordinates: body.coordinates,
        theme: body.theme,
        clueCount: body.clueCount,
        locationName: body.locationName,
        difficulty: body.difficulty,
      },
      body.seed // Передаём seed для воспроизводимости
    );
    
    if (!result.success || !result.mission) {
      console.warn(`[Admin Panorama] Generation failed: ${result.error}`);
      return NextResponse.json(
        { 
          ok: false,
          error: result.error || "Не удалось сгенерировать миссию",
          generationTimeMs: result.generationTimeMs,
        },
        { status: 400 }
      );
    }
    
    console.log(
      `[Admin Panorama] Mission generated: ` +
      `id=${result.mission.id}, clues=${result.mission.clues.length}, ` +
      `time=${result.generationTimeMs}ms`
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // СОХРАНЕНИЕ В БД
    // ═══════════════════════════════════════════════════════════════════════
    
    let savedMission = null;
    
    if (body.save) {
      try {
        savedMission = await prisma.panoramaMission.create({
          data: {
            id: result.mission.id,
            title: result.mission.title,
            description: result.mission.description,
            location: result.mission.location,
            difficulty: result.mission.difficulty,
            theme: body.theme,
            startLat: result.mission.startCoordinates[0],
            startLng: result.mission.startCoordinates[1],
            startPanoId: result.mission.startPanoId,
            missionJson: JSON.parse(JSON.stringify(result.mission)),
            clueCount: result.mission.clues.length,
            requiredClues: result.mission.requiredClues,
            timeLimit: result.mission.timeLimit,
            xpReward: result.mission.xpReward,
            generatorVersion: GENERATOR_VERSION,
            seed: result.mission.seed,
            isPublished: false, // По умолчанию не опубликована
            createdById: auth.user.id,
          },
        });
        
        console.log(`[Admin Panorama] Mission saved to DB: ${savedMission.id}`);
      } catch (dbError) {
        console.error("[Admin Panorama] Failed to save mission:", dbError);
        // Не прерываем — миссия сгенерирована, просто не сохранена
      }
    }
    
    // Конвертируем в формат HiddenClueMission для совместимости
    const hiddenClueMission = toHiddenClueMission(result.mission);
    
    return NextResponse.json({
      ok: true,
      mission: result.mission,
      hiddenClueMission,
      spots: result.spots,
      stats: {
        nodesScanned: graph.nodes.size,
        spotsFound: result.spots?.length || 0,
        cluesGenerated: result.mission.clues.length,
        generationTimeMs: result.generationTimeMs,
      },
      saved: savedMission !== null,
      savedId: savedMission?.id,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: RATE_LIMIT_WINDOW_MS / 1000,
      },
      generatorVersion: GENERATOR_VERSION,
    });
    
  } catch (error) {
    console.error("[Admin Panorama] Generation error:", error);
    
    // Определяем тип ошибки
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "Некорректный JSON в теле запроса" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        ok: false,
        error: error instanceof Error ? error.message : "Внутренняя ошибка генерации"
      },
      { status: 500 }
    );
  }
}
