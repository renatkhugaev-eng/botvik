/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION SCHEMAS (Zod)
 * Валидация данных для генератора панорамных миссий
 * 
 * Best Practices 2025:
 * - Type-safe validation
 * - Runtime schema validation
 * - Auto-generated TypeScript types
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export const MissionThemeTypeSchema = z.enum([
  "yakuza",
  "spy", 
  "heist",
  "murder",
  "smuggling",
  "art_theft",
  "kidnapping",
  "corruption",
  "custom",
]);

export const DifficultySchema = z.enum([
  "easy",
  "medium", 
  "hard",
  "extreme",
]);

export const SpotTypeSchema = z.enum([
  "dead_end",
  "intersection",
  "corner",
  "far_point",
  "hidden_alley",
]);

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

/** Координаты [lat, lng] с валидацией диапазонов */
export const CoordinatesSchema = z.tuple([
  z.number().min(-90).max(90),   // Широта
  z.number().min(-180).max(180), // Долгота
]);

/** Heading в градусах (0-360) */
export const HeadingSchema = z.number().min(0).max(360);

/** Положительное целое число */
export const PositiveIntSchema = z.number().int().positive();

/** panoId — непустая строка */
export const PanoIdSchema = z.string().min(1).max(100);

// ═══════════════════════════════════════════════════════════════════════════
// CLUE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** Шаблон улики */
export const ClueTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10), // Emoji
  nameTemplates: z.array(z.string()).min(1).max(10),
  storyContextTemplates: z.array(z.string()).min(1).max(10),
  hintTemplates: z.array(z.string()).min(1).max(10),
  baseXp: z.number().int().min(10).max(200),
});

/** Сгенерированная улика */
export const GeneratedClueSchema = z.object({
  id: z.string().min(1),
  panoId: PanoIdSchema,
  revealHeading: HeadingSchema,
  coneDegrees: z.number().min(10).max(45),
  dwellTime: z.number().min(1).max(10),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().min(1).max(10),
  storyContext: z.string().min(1).max(500),
  xpReward: z.number().int().min(10).max(500),
  hintText: z.string().min(1).max(200),
  scannerHint: z.string().min(1).max(200),
  spotType: SpotTypeSchema,
  distanceFromStart: z.number().int().min(0),
});

// ═══════════════════════════════════════════════════════════════════════════
// MISSION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** Сгенерированная миссия — полная валидация */
export const GeneratedMissionSchema = z.object({
  id: z.string().min(1).max(50),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  briefing: z.string().min(1).max(2000),
  startCoordinates: CoordinatesSchema,
  startPanoId: PanoIdSchema,
  startHeading: HeadingSchema,
  allowNavigation: z.boolean(),
  clues: z.array(GeneratedClueSchema).min(3).max(7),
  requiredClues: z.number().int().min(1).max(7),
  timeLimit: z.number().int().min(60).max(3600), // 1 мин - 1 час
  xpReward: z.number().int().min(50).max(2000),
  speedBonusPerSecond: z.number().min(0).max(5),
  location: z.string().min(1).max(200),
  difficulty: DifficultySchema,
  icon: z.string().min(1).max(10),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be hex color"),
  generatedAt: z.string().datetime(),
  generatorVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver"),
  seed: z.string().optional(), // Для воспроизводимости
});

// ═══════════════════════════════════════════════════════════════════════════
// API REQUEST SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** PanoNode для сериализации графа */
export const PanoNodeSchema = z.object({
  panoId: PanoIdSchema,
  lat: z.number(),
  lng: z.number(),
  links: z.array(z.object({
    targetPanoId: PanoIdSchema,
    heading: HeadingSchema,
    description: z.string().optional(),
  })),
  distanceFromStart: z.number().int().min(0),
  isDeadEnd: z.boolean(),
  isIntersection: z.boolean(),
  isCorner: z.boolean(),
  description: z.string().optional(),
});

/** Сериализованный граф панорам */
export const SerializedGraphSchema = z.object({
  nodes: z.array(z.tuple([z.string(), PanoNodeSchema])).min(1),
  startPanoId: PanoIdSchema,
  startCoordinates: CoordinatesSchema,
  maxDepth: z.number().int().min(1),
  stats: z.object({
    totalNodes: z.number().int().min(1),
    deadEnds: z.number().int().min(0),
    intersections: z.number().int().min(0),
    corners: z.number().int().min(0),
    maxDepth: z.number().int().min(0),
    avgLinks: z.number().min(0),
  }),
});

/** Запрос на генерацию миссии */
export const GenerateMissionRequestSchema = z.object({
  coordinates: CoordinatesSchema,
  theme: MissionThemeTypeSchema,
  clueCount: z.number().int().min(3).max(7),
  locationName: z.string().min(1).max(200).optional(),
  difficulty: DifficultySchema.default("hard"),
  graph: SerializedGraphSchema,
  save: z.boolean().default(false),
  seed: z.string().max(50).optional(), // Для воспроизводимости
});

// ═══════════════════════════════════════════════════════════════════════════
// INFERRED TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type MissionThemeType = z.infer<typeof MissionThemeTypeSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type SpotType = z.infer<typeof SpotTypeSchema>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type ClueTemplate = z.infer<typeof ClueTemplateSchema>;
export type GeneratedClue = z.infer<typeof GeneratedClueSchema>;
export type GeneratedMission = z.infer<typeof GeneratedMissionSchema>;
export type SerializedGraph = z.infer<typeof SerializedGraphSchema>;
export type GenerateMissionRequest = z.infer<typeof GenerateMissionRequestSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Валидировать запрос на генерацию миссии
 * @throws ZodError при невалидных данных
 */
export function validateGenerateRequest(data: unknown): GenerateMissionRequest {
  return GenerateMissionRequestSchema.parse(data);
}

/**
 * Безопасная валидация (без throw)
 */
export function safeValidateGenerateRequest(data: unknown): {
  success: true;
  data: GenerateMissionRequest;
} | {
  success: false;
  error: string;
} {
  const result = GenerateMissionRequestSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Форматируем ошибки для пользователя
  const errors = result.error.issues.map(e => {
    const path = e.path.join(".");
    return `${path}: ${e.message}`;
  });
  
  return { 
    success: false, 
    error: errors.join("; "),
  };
}

/**
 * Валидировать сгенерированную миссию
 */
export function validateGeneratedMission(data: unknown): GeneratedMission {
  return GeneratedMissionSchema.parse(data);
}

/**
 * Безопасная валидация миссии
 */
export function safeValidateGeneratedMission(data: unknown): {
  success: true;
  data: GeneratedMission;
} | {
  success: false;
  error: string;
} {
  const result = GeneratedMissionSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(e => {
    const path = e.path.join(".");
    return `${path}: ${e.message}`;
  });
  
  return { 
    success: false, 
    error: errors.join("; "),
  };
}

