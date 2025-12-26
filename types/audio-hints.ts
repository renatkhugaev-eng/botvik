/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIO HINTS TYPES
 * Типы для системы аудио-подсказок в детективных миссиях
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// SOUND TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SoundType = 
  | "heartbeat"     // Пульс — чем ближе, тем быстрее
  | "static"        // Помехи радио
  | "whisper"       // Шёпот
  | "ambient"       // Атмосферный звук
  | "discovery"     // Обнаружение улики
  | "collect"       // Сбор улики
  | "hint"          // Мягкая подсказка
  | "tension"       // Напряжение
  | "scanner";      // Звук сканера

// ═══════════════════════════════════════════════════════════════════════════
// INTENSITY LEVELS
// ═══════════════════════════════════════════════════════════════════════════

export type IntensityLevel = 
  | "cold"      // Далеко от улики
  | "warm"      // Приближаемся
  | "hot"       // Близко
  | "burning";  // Очень близко / в конусе

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioConfig {
  /** Общая громкость (0-1) */
  masterVolume: number;
  
  /** Включены ли звуки */
  enabled: boolean;
  
  /** Громкость heartbeat */
  heartbeatVolume: number;
  
  /** Громкость static */
  staticVolume: number;
  
  /** Громкость ambient */
  ambientVolume: number;
  
  /** Громкость эффектов (discovery, collect) */
  effectsVolume: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.7,
  enabled: true,
  heartbeatVolume: 0.6,
  staticVolume: 0.3,
  ambientVolume: 0.4,
  effectsVolume: 0.8,
};

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioState {
  /** Текущий уровень интенсивности */
  intensity: IntensityLevel;
  
  /** Активные звуки */
  activeSounds: Set<SoundType>;
  
  /** Громкость heartbeat (зависит от близости) */
  heartbeatRate: number; // BPM: 60-180
  
  /** Уровень static помех */
  staticLevel: number; // 0-1
  
  /** Идёт ли обнаружение улики */
  isRevealing: boolean;
  
  /** Прогресс обнаружения */
  revealProgress: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioEvent {
  type: SoundType;
  intensity?: IntensityLevel;
  duration?: number;
  volume?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUE AUDIO SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export interface ClueAudioSettings {
  /** Тип звука при приближении к улике */
  proximitySound?: SoundType;
  
  /** Тип звука при обнаружении */
  discoverySound?: SoundType;
  
  /** Кастомная частота для static (Hz) */
  staticFrequency?: number;
  
  /** Использовать whisper эффект */
  useWhisper?: boolean;
}

