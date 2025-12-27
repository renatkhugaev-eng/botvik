/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETECTIVE INSTINCT TYPES
 * Система "Детективное чутьё" — интуитивные подсказки для поиска улик
 * 
 * Три компонента:
 * 1. Instinct Meter — полоска чутья, заполняется при приближении к улике
 * 2. Detective Vision — режим видения с направляющими стрелками
 * 3. Flashback — вспышки памяти при входе в зону улики
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HiddenClue } from "./hidden-clue";

// ═══════════════════════════════════════════════════════════════════════════
// INSTINCT METER
// ═══════════════════════════════════════════════════════════════════════════

export type InstinctLevel = 
  | "cold"      // 0-20% — ничего не чувствует
  | "cool"      // 20-40% — слабое ощущение
  | "warm"      // 40-60% — что-то есть
  | "hot"       // 60-80% — очень близко
  | "burning";  // 80-100% — улика прямо здесь!

export interface InstinctMeterState {
  /** Текущий уровень (0-1) */
  level: number;
  
  /** Категория уровня */
  category: InstinctLevel;
  
  /** Ближайшая улика (если есть) */
  nearestClue: HiddenClue | null;
  
  /** Угол к ближайшей улике (для стрелки) */
  angleToClue: number | null;
  
  /** Расстояние в градусах до улики */
  distanceToClue: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTIVE VISION
// ═══════════════════════════════════════════════════════════════════════════

export interface DetectiveVisionState {
  /** Активен ли режим видения */
  isActive: boolean;
  
  /** Оставшееся время (сек) */
  remainingTime: number;
  
  /** Время до следующего использования (сек) */
  cooldownRemaining: number;
  
  /** Можно ли активировать */
  canActivate: boolean;
  
  /** Направления к скрытым уликам */
  clueDirections: ClueDirection[];
}

export interface ClueDirection {
  clueId: string;
  clueName: string;
  clueIcon: string;
  
  /** Угол к улике относительно текущего heading (для стрелки) */
  angle: number;
  
  /** Насколько далеко (0-1, где 0 = в конусе обнаружения) */
  distance: number;
  
  /** Показывать ли (только скрытые улики) */
  visible: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHBACK
// ═══════════════════════════════════════════════════════════════════════════

export interface FlashbackState {
  /** Показывается ли сейчас flashback */
  isActive: boolean;
  
  /** Текущий flashback контент */
  content: FlashbackContent | null;
  
  /** ID улик, для которых уже показывали flashback */
  shownForClues: Set<string>;
}

export interface FlashbackContent {
  /** ID связанной улики */
  clueId: string;
  
  /** Заголовок (короткий) */
  title: string;
  
  /** Текст видения */
  text: string;
  
  /** Иконка/эмодзи */
  icon: string;
  
  /** Тип атмосферы */
  mood: "mysterious" | "dangerous" | "sad" | "tense" | "revealing";
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTINCT CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export interface DetectiveInstinctConfig {
  /** Включен ли Instinct Meter */
  meterEnabled: boolean;
  
  /** Включен ли Detective Vision */
  visionEnabled: boolean;
  
  /** Включены ли Flashbacks */
  flashbackEnabled: boolean;
  
  /** Длительность Detective Vision (сек) */
  visionDuration: number;
  
  /** Cooldown Detective Vision (сек) */
  visionCooldown: number;
  
  /** Радиус обнаружения для Instinct Meter (градусы) */
  meterDetectionRadius: number;
  
  /** Радиус для показа flashback (градусы) */
  flashbackRadius: number;
  
  /** Длительность flashback (мс) */
  flashbackDuration: number;
}

export const DEFAULT_INSTINCT_CONFIG: DetectiveInstinctConfig = {
  meterEnabled: true,
  visionEnabled: true,
  flashbackEnabled: true,
  visionDuration: 5,
  visionCooldown: 30,
  meterDetectionRadius: 90, // 90 градусов для чутья
  flashbackRadius: 60, // 60 градусов для flashback
  flashbackDuration: 3000, // 3 секунды
};

// ═══════════════════════════════════════════════════════════════════════════
// CLUE FLASHBACK DATA
// Связь улики с её flashback контентом
// ═══════════════════════════════════════════════════════════════════════════

export interface ClueFlashback {
  /** ID улики */
  clueId: string;
  
  /** Flashback контент */
  flashback: FlashbackContent;
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTINCT EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export type InstinctEventType = 
  | "meter_cold"      // Чутьё остыло
  | "meter_warming"   // Чутьё нагревается
  | "meter_hot"       // Чутьё горячее
  | "meter_burning"   // Чутьё на максимуме
  | "vision_start"    // Начало Detective Vision
  | "vision_end"      // Конец Detective Vision
  | "flashback_start" // Начало Flashback
  | "flashback_end";  // Конец Flashback

export interface InstinctEvent {
  type: InstinctEventType;
  clue?: HiddenClue;
  timestamp: Date;
}

