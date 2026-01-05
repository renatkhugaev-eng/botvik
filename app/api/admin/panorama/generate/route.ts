/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR API
 * POST /api/admin/panorama/generate
 * 
 * Генерирует панорамную миссию на основе координат и темы
 * 
 * v2.0.0 - Добавлены:
 * - Валидация темы
 * - Rate limiting
 * - Улучшенное логирование
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { generateMission, toHiddenClueMission, getAllThemes } from "@/lib/mission-generator";
import { graphFromSerializable } from "@/lib/panorama-graph-builder";
import type { MissionGenerationRequest, MissionThemeType, PanoNode, GraphStats } from "@/types/panorama-graph";

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
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const VALID_THEMES = new Set<MissionThemeType>([
  "yakuza", "spy", "heist", "murder", "smuggling", 
  "art_theft", "kidnapping", "corruption", "custom"
]);

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "extreme"]);

function validateCoordinates(coords: unknown): coords is [number, number] {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number" &&
    coords[0] >= -90 && coords[0] <= 90 &&
    coords[1] >= -180 && coords[1] <= 180
  );
}

function validateTheme(theme: unknown): theme is MissionThemeType {
  return typeof theme === "string" && VALID_THEMES.has(theme as MissionThemeType);
}

function validateDifficulty(diff: unknown): diff is "easy" | "medium" | "hard" | "extreme" {
  return typeof diff === "string" && VALID_DIFFICULTIES.has(diff);
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
    
    return NextResponse.json({
      ok: true,
      themes,
      validDifficulties: Array.from(VALID_DIFFICULTIES),
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

interface GenerateRequestBody {
  /** Координаты [lat, lng] */
  coordinates: [number, number];
  /** Тема миссии */
  theme: string;
  /** Количество улик */
  clueCount: number;
  /** Название локации */
  locationName?: string;
  /** Сложность */
  difficulty?: "easy" | "medium" | "hard" | "extreme";
  /** Граф панорам (сериализованный) — от клиента */
  graph: {
    nodes: [string, PanoNode][];
    startPanoId: string;
    startCoordinates: [number, number];
    maxDepth: number;
    stats: GraphStats;
  };
  /** Сохранить в БД? */
  save?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  // Rate limiting (используем telegramId админа)
  const adminId = auth.ok ? auth.user.telegramId : "default";
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
    const body: GenerateRequestBody = await req.json();
    
    // ═══════════════════════════════════════════════════════════════════════
    // ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    // ═══════════════════════════════════════════════════════════════════════
    
    // Координаты
    if (!validateCoordinates(body.coordinates)) {
      return NextResponse.json(
        { ok: false, error: "Некорректные координаты. Ожидается [lat, lng] где lat: -90..90, lng: -180..180" },
        { status: 400 }
      );
    }
    
    // Тема
    if (!validateTheme(body.theme)) {
      return NextResponse.json(
        { ok: false, error: `Некорректная тема: "${body.theme}". Доступные: ${Array.from(VALID_THEMES).join(", ")}` },
        { status: 400 }
      );
    }
    
    // Сложность (опционально)
    if (body.difficulty && !validateDifficulty(body.difficulty)) {
      return NextResponse.json(
        { ok: false, error: `Некорректная сложность: "${body.difficulty}". Доступные: ${Array.from(VALID_DIFFICULTIES).join(", ")}` },
        { status: 400 }
      );
    }
    
    // Количество улик
    const clueCount = Number(body.clueCount);
    if (isNaN(clueCount) || clueCount < 3 || clueCount > 7) {
      return NextResponse.json(
        { ok: false, error: "Количество улик должно быть от 3 до 7" },
        { status: 400 }
      );
    }
    
    // Граф
    if (!body.graph || !body.graph.nodes || body.graph.nodes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Граф панорам не передан или пуст. Сначала выполните сканирование." },
        { status: 400 }
      );
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ГЕНЕРАЦИЯ
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log(`[Admin Panorama] Generating mission: theme=${body.theme}, clues=${clueCount}, location=${body.locationName || "unknown"}`);
    
    // Восстанавливаем граф из сериализованного формата
    const graph = graphFromSerializable(body.graph);
    
    // Формируем запрос
    const request: MissionGenerationRequest = {
      coordinates: body.coordinates,
      theme: body.theme as MissionThemeType,
      clueCount,
      locationName: body.locationName,
      difficulty: body.difficulty || "hard",
    };
    
    // Генерируем миссию
    const result = generateMission(graph, request);
    
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
    
    console.log(`[Admin Panorama] Mission generated: id=${result.mission.id}, clues=${result.mission.clues.length}, time=${result.generationTimeMs}ms`);
    
    // Если нужно сохранить в БД
    if (body.save) {
      // TODO: Сохраняем в таблицу PanoramaMission
      // После добавления модели в Prisma:
      // await prisma.panoramaMission.create({
      //   data: {
      //     id: result.mission.id,
      //     title: result.mission.title,
      //     location: result.mission.location,
      //     difficulty: result.mission.difficulty,
      //     missionJson: result.mission,
      //     isPublished: false,
      //   }
      // });
      console.log(`[Admin Panorama] Saving mission to database: ${result.mission.id} (TODO: implement)`);
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
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: RATE_LIMIT_WINDOW_MS / 1000,
      },
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
