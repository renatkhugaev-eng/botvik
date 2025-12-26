/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION TYPES
 * Типы для панорамных расследований с Yandex Maps
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// COORDINATES & POSITIONING
// ═══════════════════════════════════════════════════════════════════════════

/** Географические координаты [широта, долгота] */
export type GeoCoordinates = [number, number];

/** Направление камеры на панораме [yaw (градусы 0-360), pitch (градусы -90 до 90)] */
export type CameraDirection = [number, number];

/** Позиция улики на панораме (углы относительно камеры) */
export type CluePosition = {
  /** Горизонтальный угол (градусы, 0 = север, 90 = восток) */
  yaw: number;
  /** Вертикальный угол (градусы, 0 = горизонт, положительные = вверх) */
  pitch: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// CLUE (УЛИКА)
// ═══════════════════════════════════════════════════════════════════════════

export type ClueType = 
  | "visual"        // Просто найти и кликнуть
  | "text"          // Найти и ответить на вопрос
  | "count"         // Посчитать количество объектов
  | "identify";     // Определить объект (выбор из вариантов)

export type PanoramaClue = {
  id: string;
  type: ClueType;
  
  /** Позиция на панораме */
  position: CluePosition;
  
  /** Радиус кликабельной области (в градусах) */
  hitRadius?: number;
  
  /** Подсказка при наведении */
  hint?: string;
  
  /** Название улики (показывается после нахождения) */
  name: string;
  
  /** Описание улики */
  description?: string;
  
  /** Иконка улики */
  icon?: string;
  
  /** XP за нахождение */
  xpReward?: number;
  
  // ─── Для type: "text" ───
  /** Вопрос */
  question?: string;
  /** Правильный ответ (или массив вариантов) */
  answer?: string | string[];
  
  // ─── Для type: "count" ───
  /** Правильное количество */
  correctCount?: number;
  
  // ─── Для type: "identify" ───
  /** Варианты ответов */
  options?: string[];
  /** Индекс правильного ответа */
  correctOptionIndex?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// PANORAMA MISSION
// ═══════════════════════════════════════════════════════════════════════════

export type PanoramaMission = {
  id: string;
  
  /** Название миссии */
  title: string;
  
  /** Описание/легенда */
  description: string;
  
  /** Вступительный текст (показывается перед началом) */
  briefing?: string;
  
  /** Город/локация */
  location: string;
  
  /** Иконка миссии */
  icon?: string;
  
  /** Цвет темы */
  color?: string;
  
  /** Сложность */
  difficulty: "easy" | "medium" | "hard" | "extreme";
  
  // ─── Панорама ───
  /** Начальные координаты */
  startPoint: GeoCoordinates;
  
  /** Начальное направление камеры */
  startDirection?: CameraDirection;
  
  /** Разрешено ли перемещение по панораме */
  allowNavigation?: boolean;
  
  /** Ограничить область перемещения (радиус в метрах) */
  navigationRadius?: number;
  
  // ─── Улики ───
  /** Список улик для поиска */
  clues: PanoramaClue[];
  
  /** Минимум улик для прохождения */
  requiredClues?: number;
  
  // ─── Время и награды ───
  /** Лимит времени (секунды, 0 = без лимита) */
  timeLimit?: number;
  
  /** XP за полное прохождение */
  xpReward: number;
  
  /** Бонус за скорость (XP за каждую оставшуюся секунду) */
  speedBonusPerSecond?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// MISSION PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

export type ClueProgress = {
  clueId: string;
  found: boolean;
  foundAt?: Date;
  
  /** Для text/count/identify — ответ пользователя */
  userAnswer?: string | number;
  
  /** Правильно ли ответил */
  isCorrect?: boolean;
};

export type PanoramaMissionProgress = {
  missionId: string;
  
  /** Статус прохождения */
  status: "not_started" | "in_progress" | "completed" | "failed";
  
  /** Прогресс по уликам */
  cluesProgress: ClueProgress[];
  
  /** Найдено улик */
  cluesFound: number;
  
  /** Всего улик */
  cluesTotal: number;
  
  /** Время начала */
  startedAt?: Date;
  
  /** Время завершения */
  completedAt?: Date;
  
  /** Потрачено секунд */
  timeSpent?: number;
  
  /** Заработано XP */
  earnedXp?: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// YANDEX PANORAMA PLAYER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Интерфейс Yandex Panorama Player (упрощённый) */
export interface YandexPanoramaPlayer {
  /** Получить текущее направление камеры [yaw, pitch] */
  getDirection(): CameraDirection;
  
  /** Установить направление камеры */
  setDirection(direction: CameraDirection): void;
  
  /** Получить текущий уровень зума */
  getSpan(): number;
  
  /** Установить уровень зума */
  setSpan(span: number): void;
  
  /** Получить текущую панораму */
  getPanorama(): unknown;
  
  /** Переключиться на другую панораму */
  setPanorama(panorama: unknown): void;
  
  /** Уничтожить плеер */
  destroy(): void;
  
  /** События */
  events: {
    add(event: string, callback: () => void): void;
    remove(event: string, callback: () => void): void;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EPISODE CONTENT TYPE (для интеграции с Investigation)
// ═══════════════════════════════════════════════════════════════════════════

/** Контент эпизода типа PANORAMA */
export type PanoramaEpisodeContent = {
  mission: PanoramaMission;
};

