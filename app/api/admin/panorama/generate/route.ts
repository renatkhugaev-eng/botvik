/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION GENERATOR API
 * POST /api/admin/panorama/generate
 * 
 * Генерирует панорамную миссию на основе координат и темы
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { generateMission, toHiddenClueMission, getAllThemes } from "@/lib/mission-generator";
import { graphFromSerializable } from "@/lib/panorama-graph-builder";
import type { MissionGenerationRequest, PanoNode, GraphStats } from "@/types/panorama-graph";

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
    });
  } catch (error) {
    console.error("[Admin Panorama] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch themes" },
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
  
  try {
    const body: GenerateRequestBody = await req.json();
    
    // Валидация
    if (!body.coordinates || body.coordinates.length !== 2) {
      return NextResponse.json(
        { error: "Некорректные координаты" },
        { status: 400 }
      );
    }
    
    if (!body.theme) {
      return NextResponse.json(
        { error: "Тема не указана" },
        { status: 400 }
      );
    }
    
    if (!body.graph || !body.graph.nodes || body.graph.nodes.length === 0) {
      return NextResponse.json(
        { error: "Граф панорам не передан" },
        { status: 400 }
      );
    }
    
    // Восстанавливаем граф из сериализованного формата
    const graph = graphFromSerializable(body.graph);
    
    // Формируем запрос
    const request: MissionGenerationRequest = {
      coordinates: body.coordinates,
      theme: body.theme as MissionGenerationRequest["theme"],
      clueCount: body.clueCount || 5,
      locationName: body.locationName,
      difficulty: body.difficulty || "hard",
    };
    
    // Генерируем миссию
    const result = generateMission(graph, request);
    
    if (!result.success || !result.mission) {
      return NextResponse.json(
        { 
          ok: false,
          error: result.error || "Не удалось сгенерировать миссию",
          generationTimeMs: result.generationTimeMs,
        },
        { status: 400 }
      );
    }
    
    // Если нужно сохранить в БД
    if (body.save) {
      // Сохраняем как JSON в таблицу PanoramaMission
      // (создадим миграцию позже если нужно)
      console.log("[Admin Panorama] Saving mission to database:", result.mission.id);
      
      // Пока сохраняем в существующую структуру или логируем
      // TODO: Добавить модель PanoramaMission в Prisma
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
    });
    
  } catch (error) {
    console.error("[Admin Panorama] Generation error:", error);
    return NextResponse.json(
      { 
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка генерации"
      },
      { status: 500 }
    );
  }
}

