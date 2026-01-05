/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MISSION THEMES INDEX
 * Центральный экспорт всех тем миссий
 * 
 * Архитектура:
 * - Каждая тема в отдельном файле для масштабируемости
 * - Легко добавлять новые темы без изменения основного кода
 * - Типизация через Zod схемы
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { MissionThemeType, ClueTemplate } from "@/lib/schemas/panorama-mission";
import { yakuzaTheme, yakuzaClueTemplates } from "./yakuza";
import { spyTheme, spyClueTemplates } from "./spy";
import { heistTheme, heistClueTemplates } from "./heist";
import { murderTheme, murderClueTemplates } from "./murder";
import { smugglingTheme, smugglingClueTemplates } from "./smuggling";
import { artTheftTheme, artTheftClueTemplates } from "./art-theft";
import { kidnappingTheme, kidnappingClueTemplates } from "./kidnapping";
import { corruptionTheme, corruptionClueTemplates } from "./corruption";
import { customTheme, customClueTemplates } from "./custom";

// ═══════════════════════════════════════════════════════════════════════════
// THEME CONFIGURATION TYPE
// ═══════════════════════════════════════════════════════════════════════════

export interface ThemeConfig {
  type: MissionThemeType;
  title: string;
  description: string;
  briefing: string;
  icon: string;
  color: string;
}

export interface MissionTheme extends ThemeConfig {
  clueTemplates: ClueTemplate[];
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const THEME_CONFIGS: Record<MissionThemeType, ThemeConfig> = {
  yakuza: yakuzaTheme,
  spy: spyTheme,
  heist: heistTheme,
  murder: murderTheme,
  smuggling: smugglingTheme,
  art_theft: artTheftTheme,
  kidnapping: kidnappingTheme,
  corruption: corruptionTheme,
  custom: customTheme,
};

const CLUE_TEMPLATES: Record<MissionThemeType, ClueTemplate[]> = {
  yakuza: yakuzaClueTemplates,
  spy: spyClueTemplates,
  heist: heistClueTemplates,
  murder: murderClueTemplates,
  smuggling: smugglingClueTemplates,
  art_theft: artTheftClueTemplates,
  kidnapping: kidnappingClueTemplates,
  corruption: corruptionClueTemplates,
  custom: customClueTemplates,
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить полную тему миссии с шаблонами улик
 */
export function getMissionTheme(type: MissionThemeType): MissionTheme {
  const config = THEME_CONFIGS[type];
  const templates = CLUE_TEMPLATES[type];
  
  if (!config || !templates) {
    throw new Error(`Unknown theme: ${type}`);
  }
  
  return {
    ...config,
    clueTemplates: templates,
  };
}

/**
 * Получить все доступные темы
 */
export function getAllThemes(): MissionTheme[] {
  return Object.keys(THEME_CONFIGS).map(type => 
    getMissionTheme(type as MissionThemeType)
  );
}

/**
 * Получить только конфигурацию темы (без шаблонов улик)
 */
export function getThemeConfig(type: MissionThemeType): ThemeConfig {
  const config = THEME_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown theme: ${type}`);
  }
  return config;
}

/**
 * Получить шаблоны улик для темы
 */
export function getClueTemplates(type: MissionThemeType): ClueTemplate[] {
  const templates = CLUE_TEMPLATES[type];
  if (!templates) {
    throw new Error(`Unknown theme: ${type}`);
  }
  return templates;
}

/**
 * Проверить существование темы
 */
export function isValidTheme(type: string): type is MissionThemeType {
  return type in THEME_CONFIGS;
}

/**
 * Получить список типов тем
 */
export function getThemeTypes(): MissionThemeType[] {
  return Object.keys(THEME_CONFIGS) as MissionThemeType[];
}

/**
 * Получить максимальное количество улик для темы
 */
export function getMaxClueCount(type: MissionThemeType): number {
  return CLUE_TEMPLATES[type]?.length || 0;
}

