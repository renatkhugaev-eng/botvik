/**
 * Investigation Save/Load System
 * 
 * Обеспечивает сохранение и загрузку прогресса расследования.
 * Использует localStorage для быстрых сохранений с опциональной 
 * синхронизацией с сервером.
 */

import type { BoardState } from "@/lib/evidence-system";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export interface InvestigationSave {
  /** Уникальный ID сохранения */
  id: string;
  /** ID расследования (например, "lesopolosa") */
  investigationId: string;
  /** Номер эпизода */
  episodeId: number;
  /** Сериализованное состояние Ink (JSON строка) */
  inkState: string;
  /** Состояние доски улик */
  boardState: BoardState;
  /** Разблокированные достижения */
  achievements: string[];
  /** Время игры в секундах */
  playtime: number;
  /** Текущая глава */
  currentChapter: number;
  /** Счёт истории */
  storyScore: number;
  /** Дата сохранения */
  savedAt: string;
  /** Версия формата сохранения (для миграций) */
  version: number;
}

export interface SaveMetadata {
  id: string;
  investigationId: string;
  episodeId: number;
  currentChapter: number;
  storyScore: number;
  evidenceCount: number;
  connectionsCount: number;
  playtime: number;
  savedAt: string;
}

export type SaveResult = 
  | { success: true; saveId: string }
  | { success: false; error: string };

export type LoadResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// ══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ══════════════════════════════════════════════════════════════════════════════

const SAVE_VERSION = 1;
const STORAGE_PREFIX = "botvik_investigation_";
const AUTOSAVE_KEY = "autosave";
const MAX_MANUAL_SAVES = 5;

// ══════════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════════════════════

function generateSaveId(): string {
  return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getStorageKey(investigationId: string, saveId: string): string {
  return `${STORAGE_PREFIX}${investigationId}_${saveId}`;
}

function getAutosaveKey(investigationId: string): string {
  return `${STORAGE_PREFIX}${investigationId}_${AUTOSAVE_KEY}`;
}

function getManualSavesIndexKey(investigationId: string): string {
  return `${STORAGE_PREFIX}${investigationId}_saves_index`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ЛОКАЛЬНОЕ СОХРАНЕНИЕ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Сохранить прогресс в localStorage
 */
export function saveToLocalStorage(save: InvestigationSave): SaveResult {
  if (typeof window === "undefined") {
    return { success: false, error: "localStorage недоступен на сервере" };
  }

  try {
    const key = getStorageKey(save.investigationId, save.id);
    const data = JSON.stringify(save);
    
    // Проверяем размер (localStorage обычно ограничен ~5MB)
    if (data.length > 1024 * 1024) { // 1MB лимит на сохранение
      return { success: false, error: "Сохранение слишком большое" };
    }
    
    localStorage.setItem(key, data);
    return { success: true, saveId: save.id };
  } catch (error) {
    console.error("[investigation-save] Failed to save:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Неизвестная ошибка" 
    };
  }
}

/**
 * Загрузить сохранение из localStorage
 */
export function loadFromLocalStorage(
  investigationId: string, 
  saveId: string
): LoadResult<InvestigationSave> {
  if (typeof window === "undefined") {
    return { success: false, error: "localStorage недоступен на сервере" };
  }

  try {
    const key = getStorageKey(investigationId, saveId);
    const data = localStorage.getItem(key);
    
    if (!data) {
      return { success: false, error: "Сохранение не найдено" };
    }
    
    const save = JSON.parse(data) as InvestigationSave;
    
    // Проверяем версию и мигрируем если нужно
    if (save.version !== SAVE_VERSION) {
      const migrated = migrateSave(save);
      if (!migrated) {
        return { success: false, error: "Несовместимая версия сохранения" };
      }
      return { success: true, data: migrated };
    }
    
    return { success: true, data: save };
  } catch (error) {
    console.error("[investigation-save] Failed to load:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ошибка загрузки" 
    };
  }
}

/**
 * Удалить сохранение из localStorage
 */
export function deleteFromLocalStorage(
  investigationId: string, 
  saveId: string
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const key = getStorageKey(investigationId, saveId);
    localStorage.removeItem(key);
    
    // Обновляем индекс manual saves
    updateManualSavesIndex(investigationId, (saves) => 
      saves.filter((s) => s.id !== saveId)
    );
    
    return true;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// АВТОСОХРАНЕНИЕ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Автосохранение (перезаписывает предыдущее)
 */
export function autosave(
  investigationId: string,
  episodeId: number,
  inkState: string,
  boardState: BoardState,
  currentChapter: number,
  storyScore: number,
  playtime: number,
  achievements: string[] = []
): SaveResult {
  const save: InvestigationSave = {
    id: AUTOSAVE_KEY,
    investigationId,
    episodeId,
    inkState,
    boardState,
    achievements,
    playtime,
    currentChapter,
    storyScore,
    savedAt: new Date().toISOString(),
    version: SAVE_VERSION,
  };

  if (typeof window === "undefined") {
    return { success: false, error: "localStorage недоступен" };
  }

  try {
    const key = getAutosaveKey(investigationId);
    localStorage.setItem(key, JSON.stringify(save));
    return { success: true, saveId: AUTOSAVE_KEY };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ошибка автосохранения" 
    };
  }
}

/**
 * Загрузить автосохранение
 */
export function loadAutosave(investigationId: string): LoadResult<InvestigationSave> {
  if (typeof window === "undefined") {
    return { success: false, error: "localStorage недоступен" };
  }

  try {
    const key = getAutosaveKey(investigationId);
    const data = localStorage.getItem(key);
    
    if (!data) {
      return { success: false, error: "Автосохранение не найдено" };
    }
    
    const save = JSON.parse(data) as InvestigationSave;
    return { success: true, data: save };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ошибка загрузки" 
    };
  }
}

/**
 * Проверить наличие автосохранения
 */
export function hasAutosave(investigationId: string): boolean {
  if (typeof window === "undefined") return false;
  
  const key = getAutosaveKey(investigationId);
  return localStorage.getItem(key) !== null;
}

/**
 * Удалить автосохранение
 */
export function clearAutosave(investigationId: string): void {
  if (typeof window === "undefined") return;
  
  const key = getAutosaveKey(investigationId);
  localStorage.removeItem(key);
}

// ══════════════════════════════════════════════════════════════════════════════
// РУЧНЫЕ СОХРАНЕНИЯ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Создать ручное сохранение
 */
export function createManualSave(
  investigationId: string,
  episodeId: number,
  inkState: string,
  boardState: BoardState,
  currentChapter: number,
  storyScore: number,
  playtime: number,
  achievements: string[] = []
): SaveResult {
  const saveId = generateSaveId();
  
  const save: InvestigationSave = {
    id: saveId,
    investigationId,
    episodeId,
    inkState,
    boardState,
    achievements,
    playtime,
    currentChapter,
    storyScore,
    savedAt: new Date().toISOString(),
    version: SAVE_VERSION,
  };

  const result = saveToLocalStorage(save);
  
  if (result.success) {
    // Добавляем в индекс manual saves
    const metadata: SaveMetadata = {
      id: saveId,
      investigationId,
      episodeId,
      currentChapter,
      storyScore,
      evidenceCount: boardState.evidence.length,
      connectionsCount: boardState.correctConnections,
      playtime,
      savedAt: save.savedAt,
    };
    
    updateManualSavesIndex(investigationId, (saves) => {
      const updated = [metadata, ...saves];
      // Ограничиваем количество сохранений
      if (updated.length > MAX_MANUAL_SAVES) {
        // Удаляем самое старое
        const oldest = updated.pop();
        if (oldest) {
          deleteFromLocalStorage(investigationId, oldest.id);
        }
      }
      return updated;
    });
  }
  
  return result;
}

/**
 * Получить список ручных сохранений
 */
export function getManualSaves(investigationId: string): SaveMetadata[] {
  if (typeof window === "undefined") return [];

  try {
    const key = getManualSavesIndexKey(investigationId);
    const data = localStorage.getItem(key);
    
    if (!data) return [];
    
    return JSON.parse(data) as SaveMetadata[];
  } catch {
    return [];
  }
}

/**
 * Обновить индекс ручных сохранений
 */
function updateManualSavesIndex(
  investigationId: string,
  updater: (saves: SaveMetadata[]) => SaveMetadata[]
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getManualSavesIndexKey(investigationId);
    const current = getManualSaves(investigationId);
    const updated = updater(current);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// МИГРАЦИИ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Мигрировать старое сохранение к текущей версии
 */
function migrateSave(save: InvestigationSave): InvestigationSave | null {
  // Пока нет миграций, просто обновляем версию
  // В будущем здесь будут миграции между версиями
  
  if (save.version < 1) {
    // Миграция с версии 0 (если будет)
    save.version = 1;
  }
  
  return save;
}

// ══════════════════════════════════════════════════════════════════════════════
// СЕРВЕРНАЯ СИНХРОНИЗАЦИЯ (опционально)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Синхронизировать сохранение с сервером
 * Вызывается опционально для бэкапа на сервере
 */
export async function syncToServer(
  userId: number,
  save: InvestigationSave
): Promise<SaveResult> {
  try {
    const response = await fetch("/api/investigation/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        save,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Ошибка сервера" };
    }

    const data = await response.json();
    return { success: true, saveId: data.saveId };
  } catch (error) {
    console.error("[investigation-save] Sync failed:", error);
    return { 
      success: false, 
      error: "Ошибка подключения к серверу" 
    };
  }
}

/**
 * Загрузить сохранение с сервера
 */
export async function loadFromServer(
  userId: number,
  investigationId: string
): Promise<LoadResult<InvestigationSave>> {
  try {
    const response = await fetch(
      `/api/investigation/save?userId=${userId}&investigationId=${investigationId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "Сохранение не найдено" };
      }
      const error = await response.json();
      return { success: false, error: error.message || "Ошибка сервера" };
    }

    const data = await response.json();
    return { success: true, data: data.save };
  } catch (error) {
    console.error("[investigation-save] Load from server failed:", error);
    return { 
      success: false, 
      error: "Ошибка подключения к серверу" 
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ ДЛЯ UI
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Форматировать время игры
 */
export function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}

/**
 * Форматировать дату сохранения
 */
export function formatSaveDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Получить краткую информацию о сохранении для отображения
 */
export function getSaveDisplayInfo(metadata: SaveMetadata): {
  title: string;
  subtitle: string;
  progress: string;
} {
  return {
    title: `Глава ${metadata.currentChapter}`,
    subtitle: formatSaveDate(metadata.savedAt),
    progress: `${metadata.evidenceCount} улик • ${metadata.connectionsCount} связей • ${metadata.storyScore} очков`,
  };
}
