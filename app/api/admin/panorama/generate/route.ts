/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR API v3.1.0
 * POST /api/admin/panorama/generate
 * 
 * Генерирует панорамную миссию на основе координат и темы
 * 
 * Best Practices 2025:
 * - Zod валидация входных данных
 * - Сохранение в БД (Prisma)
 * - Seed для воспроизводимости
 * - Rate limiting с auto-cleanup
 * - Структурированное логирование
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
// RATE LIMITING (с автоматической очисткой)
// ═══════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

class RateLimiter {
  private map = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // Очистка каждую минуту
  
  constructor(maxRequests: number = 10, windowMs: number = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  /**
   * Проверить rate limit для ключа
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    total: number;
  } {
    this.maybeCleanup();
    
    const now = Date.now();
    const entry = this.map.get(key);
    
    // Новый ключ или истёкший window
    if (!entry || entry.resetAt <= now) {
      this.map.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
        firstRequestAt: now,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetIn: Math.ceil(this.windowMs / 1000),
        total: this.maxRequests,
      };
    }
    
    // Проверяем лимит
    if (entry.count >= this.maxRequests) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        total: this.maxRequests,
      };
    }
    
    // Инкрементируем счётчик
    entry.count++;
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);
    
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetIn,
      total: this.maxRequests,
    };
  }
  
  /**
   * Периодическая очистка просроченных записей
   */
  private maybeCleanup(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }
    
    this.lastCleanup = now;
    let cleaned = 0;
    
    for (const [key, entry] of this.map) {
      if (entry.resetAt <= now) {
        this.map.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }
  
  /**
   * Получить статистику
   */
  getStats(): { activeKeys: number; totalRequests: number } {
    this.maybeCleanup();
    
    let totalRequests = 0;
    for (const entry of this.map.values()) {
      totalRequests += entry.count;
    }
    
    return {
      activeKeys: this.map.size,
      totalRequests,
    };
  }
}

// Глобальный rate limiter
const rateLimiter = new RateLimiter(10, 60 * 1000); // 10 запросов в минуту

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

interface LogContext {
  adminId?: string;
  action: string;
  duration?: number;
  [key: string]: unknown;
}

function log(level: "info" | "warn" | "error", message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const prefix = `[Admin Panorama ${level.toUpperCase()}]`;
  
  const contextStr = context 
    ? ` | ${Object.entries(context).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`
    : "";
    
  console[level](`${timestamp} ${prefix} ${message}${contextStr}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Получить список доступных тем
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const startTime = Date.now();
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
    
    // Получаем статистику сохранённых миссий (опционально)
    let statsMap: Record<string, number> = {};
    try {
      const missionStats = await prisma.panoramaMission.groupBy({
        by: ["theme"],
        _count: { id: true },
        where: { isPublished: true },
      });
      statsMap = Object.fromEntries(
        missionStats.map(s => [s.theme, s._count.id])
      );
    } catch {
      // Таблица может не существовать — игнорируем
    }
    
    const duration = Date.now() - startTime;
    
    log("info", "Themes fetched", {
      adminId: auth.user.telegramId,
      action: "GET_THEMES",
      duration,
      themesCount: themes.length,
    });
    
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
    log("error", "Failed to fetch themes", {
      action: "GET_THEMES",
      error: error instanceof Error ? error.message : "Unknown",
    });
    
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
  const startTime = Date.now();
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const adminId = auth.user.telegramId;
  
  // ═══════════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════
  
  const rateLimit = rateLimiter.check(adminId);
  
  if (!rateLimit.allowed) {
    log("warn", "Rate limit exceeded", {
      adminId,
      action: "RATE_LIMIT",
      resetIn: rateLimit.resetIn,
    });
    
    return NextResponse.json(
      { 
        ok: false, 
        error: `Слишком много запросов. Подождите ${rateLimit.resetIn} сек.`,
        retryAfter: rateLimit.resetIn,
      },
      { 
        status: 429,
        headers: { 
          "Retry-After": String(rateLimit.resetIn),
          "X-RateLimit-Limit": String(rateLimit.total),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimit.resetIn),
        },
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
      log("warn", "Validation failed", {
        adminId,
        action: "VALIDATION_ERROR",
        error: validation.error,
      });
      
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
    
    log("info", "Generating mission", {
      adminId,
      action: "GENERATE_START",
      theme: body.theme,
      clueCount: body.clueCount,
      location: body.locationName || "unknown",
      difficulty: body.difficulty,
      seed: body.seed || "auto",
      graphNodes: body.graph.nodes.length,
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ВАЛИДАЦИЯ ГРАФА
    // ═══════════════════════════════════════════════════════════════════════
    
    if (body.graph.nodes.length < 10) {
      return NextResponse.json(
        { 
          ok: false,
          error: `Граф слишком маленький (${body.graph.nodes.length} узлов). Минимум 10 узлов требуется для генерации.`,
        },
        { status: 400 }
      );
    }
    
    if (body.graph.maxDepth < 3) {
      return NextResponse.json(
        { 
          ok: false,
          error: `Граф слишком мелкий (глубина ${body.graph.maxDepth}). Минимальная глубина 3 шага.`,
        },
        { status: 400 }
      );
    }
    
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
      body.seed
    );
    
    if (!result.success || !result.mission) {
      log("warn", "Generation failed", {
        adminId,
        action: "GENERATE_FAIL",
        error: result.error,
        timeMs: result.generationTimeMs,
      });
      
      return NextResponse.json(
        { 
          ok: false,
          error: result.error || "Не удалось сгенерировать миссию",
          generationTimeMs: result.generationTimeMs,
        },
        { status: 400 }
      );
    }
    
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
            seed: result.mission.seed,
            isPublished: false,
            createdById: auth.user.id,
          },
        });
        
        log("info", "Mission saved to DB", {
          adminId,
          action: "SAVE_MISSION",
          missionId: savedMission.id,
        });
      } catch (dbError) {
        log("error", "Failed to save mission", {
          adminId,
          action: "SAVE_ERROR",
          error: dbError instanceof Error ? dbError.message : "Unknown",
        });
        // Не прерываем — миссия сгенерирована, просто не сохранена
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    log("info", "Mission generated successfully", {
      adminId,
      action: "GENERATE_SUCCESS",
      missionId: result.mission.id,
      clues: result.mission.clues.length,
      generationTimeMs: result.generationTimeMs,
      totalTimeMs: totalDuration,
      saved: savedMission !== null,
    });
    
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
        totalTimeMs: totalDuration,
      },
      saved: savedMission !== null,
      savedId: savedMission?.id,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: rateLimit.resetIn,
        total: rateLimit.total,
      },
      generatorVersion: GENERATOR_VERSION,
    }, {
      headers: {
        "X-RateLimit-Limit": String(rateLimit.total),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetIn),
      },
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    log("error", "Generation error", {
      adminId,
      action: "GENERATE_ERROR",
      duration,
      error: error instanceof Error ? error.message : "Unknown",
    });
    
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
