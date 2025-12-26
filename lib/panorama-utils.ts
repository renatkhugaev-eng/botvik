/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA UTILITIES
 * Утилиты для работы с секторами и обнаружением улик
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { CameraDirection, PanoramaClue, PanoramaSector } from "@/types/panorama";

// ═══════════════════════════════════════════════════════════════════════════
// SECTOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Нормализует угол в диапазон 0-360
 */
export function normalizeYaw(yaw: number): number {
  let normalized = yaw % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Проверяет находится ли камера в заданном секторе
 */
export function isCameraInSector(
  cameraYaw: number,
  sector: PanoramaSector
): boolean {
  const yaw = normalizeYaw(cameraYaw);
  const from = normalizeYaw(sector.fromYaw);
  const to = normalizeYaw(sector.toYaw);
  
  // Обрабатываем случай когда сектор пересекает 0° (например 350° - 10°)
  if (from <= to) {
    return yaw >= from && yaw <= to;
  } else {
    // Сектор пересекает 0°
    return yaw >= from || yaw <= to;
  }
}

/**
 * Проверяет находится ли камера достаточно близко к позиции улики
 */
export function isCameraNearPosition(
  cameraYaw: number,
  cameraPitch: number,
  clueYaw: number,
  cluePitch: number,
  detectionRadius: number = 45 // по умолчанию 45 градусов
): boolean {
  const yawDiff = Math.abs(normalizeYaw(cameraYaw) - normalizeYaw(clueYaw));
  const adjustedYawDiff = Math.min(yawDiff, 360 - yawDiff);
  const pitchDiff = Math.abs(cameraPitch - cluePitch);
  
  // Считаем расстояние в градусах
  const distance = Math.sqrt(adjustedYawDiff ** 2 + pitchDiff ** 2);
  
  return distance <= detectionRadius;
}

/**
 * Проверяет видна ли улика с текущей позиции камеры
 */
export function isClueVisible(
  clue: PanoramaClue,
  cameraDirection: CameraDirection
): boolean {
  const [cameraYaw, cameraPitch] = cameraDirection;
  
  // Если у улики есть сектор — проверяем сектор
  if (clue.sector) {
    return isCameraInSector(cameraYaw, clue.sector);
  }
  
  // Если у улики есть точная позиция — проверяем расстояние
  if (clue.position) {
    return isCameraNearPosition(
      cameraYaw,
      cameraPitch,
      clue.position.yaw,
      clue.position.pitch,
      clue.detectionRadius ?? 45
    );
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTOR PRESETS
// ═══════════════════════════════════════════════════════════════════════════

/** Стандартные секторы (8 направлений) */
export const SECTORS = {
  NORTH: { fromYaw: 337.5, toYaw: 22.5, name: "Север" },
  NORTH_EAST: { fromYaw: 22.5, toYaw: 67.5, name: "Северо-восток" },
  EAST: { fromYaw: 67.5, toYaw: 112.5, name: "Восток" },
  SOUTH_EAST: { fromYaw: 112.5, toYaw: 157.5, name: "Юго-восток" },
  SOUTH: { fromYaw: 157.5, toYaw: 202.5, name: "Юг" },
  SOUTH_WEST: { fromYaw: 202.5, toYaw: 247.5, name: "Юго-запад" },
  WEST: { fromYaw: 247.5, toYaw: 292.5, name: "Запад" },
  NORTH_WEST: { fromYaw: 292.5, toYaw: 337.5, name: "Северо-запад" },
} as const;

/** Простые секторы (4 направления) */
export const SIMPLE_SECTORS = {
  FRONT: { fromYaw: 315, toYaw: 45, name: "Впереди" },
  RIGHT: { fromYaw: 45, toYaw: 135, name: "Справа" },
  BACK: { fromYaw: 135, toYaw: 225, name: "Позади" },
  LEFT: { fromYaw: 225, toYaw: 315, name: "Слева" },
} as const;

/**
 * Получить название направления по углу
 */
export function getDirectionName(yaw: number): string {
  const normalized = normalizeYaw(yaw);
  
  if (normalized >= 337.5 || normalized < 22.5) return "на север";
  if (normalized >= 22.5 && normalized < 67.5) return "на северо-восток";
  if (normalized >= 67.5 && normalized < 112.5) return "на восток";
  if (normalized >= 112.5 && normalized < 157.5) return "на юго-восток";
  if (normalized >= 157.5 && normalized < 202.5) return "на юг";
  if (normalized >= 202.5 && normalized < 247.5) return "на юго-запад";
  if (normalized >= 247.5 && normalized < 292.5) return "на запад";
  return "на северо-запад";
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить направление к улике относительно текущего направления камеры
 */
export function getClueDirection(
  clue: PanoramaClue,
  cameraYaw: number
): "left" | "right" | "behind" | "ahead" | null {
  let clueYaw: number;
  
  if (clue.sector) {
    // Центр сектора
    const from = normalizeYaw(clue.sector.fromYaw);
    const to = normalizeYaw(clue.sector.toYaw);
    if (from <= to) {
      clueYaw = (from + to) / 2;
    } else {
      clueYaw = normalizeYaw((from + to + 360) / 2);
    }
  } else if (clue.position) {
    clueYaw = clue.position.yaw;
  } else {
    return null;
  }
  
  const normalized = normalizeYaw(cameraYaw);
  let diff = normalizeYaw(clueYaw) - normalized;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  if (Math.abs(diff) <= 45) return "ahead";
  if (Math.abs(diff) >= 135) return "behind";
  if (diff > 0) return "right";
  return "left";
}

/**
 * Получить подсказку направления к улике
 */
export function getClueDirectionHint(
  clue: PanoramaClue,
  cameraYaw: number
): string {
  const direction = getClueDirection(clue, cameraYaw);
  
  switch (direction) {
    case "ahead": return "Смотри внимательнее...";
    case "behind": return "Развернись назад";
    case "left": return "Посмотри левее";
    case "right": return "Посмотри правее";
    default: return "Осмотрись вокруг";
  }
}

