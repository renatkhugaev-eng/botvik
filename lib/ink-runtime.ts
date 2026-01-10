/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INK RUNTIME — Обёртка над inkjs для React
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Обновлено для поддержки:
 * - Продвинутой системы переменных (Red Forest)
 * - observeVariable для реактивных обновлений
 * - External functions для звука, haptic, сохранения
 * - Автосохранения состояния между эпизодами
 */

import { Story } from "inkjs";

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export type InkChoice = {
  index: number;
  text: string;
};

export type InkParagraph = {
  text: string;
  tags: string[];
};

export type InkState = {
  paragraphs: InkParagraph[];
  choices: InkChoice[];
  canContinue: boolean;
  isEnd: boolean;
  variables: Record<string, unknown>;
  tags: string[];
  // Новые поля для Red Forest
  sanity?: number;
  daysRemaining?: number;
  chapter?: number;
};

export type TagValue = {
  key: string;
  value: string | boolean;
};

// Тип для наблюдателя переменных
export type VariableObserver = (variableName: string, newValue: unknown) => void;

// Тип для внешних функций
export type ExternalFunctionHandler = (...args: unknown[]) => unknown;

// ══════════════════════════════════════════════════════════════════════════════
// СПИСОК ПЕРЕМЕННЫХ RED FOREST
// ══════════════════════════════════════════════════════════════════════════════

export const RED_FOREST_VARIABLES = [
  // Основные
  "sanity",
  "days_remaining",
  "current_day",
  "chapter",
  
  // Доверие
  "trust_gromov",
  "trust_vera",
  "trust_serafim",
  "trust_tanya",
  "trust_astahov",
  
  // Прогресс
  "evidence_collected",
  "cult_awareness",
  
  // Улики и знания (LIST переменные)
  "CultLore",
  "KeyEvents",
  "AncientArtifacts",
  "Relationships",
  
  // Флаги встреч
  "met_gromov",
  "met_vera",
  "met_serafim",
  "met_tanya",
  "met_astahov",
  "met_klava",
  "met_chernov",
  
  // Флаги событий
  "saw_symbol",
  "heard_voices",
  "found_notebook",
  "found_photos",
  "entered_caves",
  "witnessed_ritual",
  "confronted_cult",
  
  // Отношения
  "romantic_tanya",
  "betrayed_gromov",
  "trusted_vera",
  
  // Улики
  "clue_missing_list",
  "clue_false_reports",
  "clue_witness_conflict",
  "clue_echo_docs",
  "clue_experiment_records",
  "clue_underground_map",
  "clue_access_pass",
  "clue_cult_symbol",
  "clue_chernov_diary",
  "clue_ritual_photos",
  "clue_insider_testimony",
  "clue_expedition_1890",
  "clue_serafim_legends",
  "clue_church_symbols",
  
  // Концовки
  "ending_truth_unlocked",
  "ending_hero_unlocked",
  "ending_sacrifice_unlocked",
  "ending_rebirth_unlocked",
  "ending_escape_unlocked",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// INK RUNNER CLASS
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// EXTERNAL FUNCTION CALLBACKS — Тип для внешних обработчиков
// ══════════════════════════════════════════════════════════════════════════════

export type ExternalFunctionCallbacks = {
  onPlaySound?: (soundId: string) => void;
  onStopSound?: (soundId: string) => void;
  onTriggerHaptic?: (hapticType: string) => void;
  onShowNotification?: (message: string, type: string) => void;
  onSaveCheckpoint?: (checkpointName: string) => void;
  onTriggerGameOver?: (reason: string) => void;
};

export class InkRunner {
  private story: Story;
  private collectedParagraphs: InkParagraph[] = [];
  private variableObservers: Map<string, Set<VariableObserver>> = new Map();
  private globalObservers: Set<VariableObserver> = new Set();
  private isRedForestStory = false;
  private externalCallbacks: ExternalFunctionCallbacks = {};

  constructor(storyJson: object, externalCallbacks?: ExternalFunctionCallbacks) {
    this.story = new Story(storyJson);
    this.externalCallbacks = externalCallbacks || {};
    this.detectStoryType();
    this.setupExternalFunctions();
    this.setupVariableObserver();
  }

  /**
   * Устанавливает внешние callback-функции после создания runner
   */
  setExternalCallbacks(callbacks: ExternalFunctionCallbacks): void {
    this.externalCallbacks = { ...this.externalCallbacks, ...callbacks };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * EXTERNAL FUNCTIONS — Привязка функций из Ink к JavaScript
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Эти функции вызываются из Ink-скрипта через EXTERNAL декларации.
   * Третий параметр `true` в BindExternalFunction означает, что функция
   * является "lookahead-safe" (не имеет побочных эффектов во время lookahead).
   */
  private setupExternalFunctions(): void {
    // play_sound(sound_id) — воспроизведение звука
    this.story.BindExternalFunction("play_sound", (soundId: string) => {
      if (this.externalCallbacks.onPlaySound) {
        this.externalCallbacks.onPlaySound(soundId);
      }
      return true;
    }, true);

    // stop_sound(sound_id) — остановка звука
    this.story.BindExternalFunction("stop_sound", (soundId: string) => {
      if (this.externalCallbacks.onStopSound) {
        this.externalCallbacks.onStopSound(soundId);
      }
      return true;
    }, true);

    // trigger_haptic(haptic_type) — тактильная обратная связь
    this.story.BindExternalFunction("trigger_haptic", (hapticType: string) => {
      if (this.externalCallbacks.onTriggerHaptic) {
        this.externalCallbacks.onTriggerHaptic(hapticType);
      }
      return true;
    }, true);

    // show_notification(message, type) — показ уведомления
    this.story.BindExternalFunction("show_notification", (message: string, type: string) => {
      if (this.externalCallbacks.onShowNotification) {
        this.externalCallbacks.onShowNotification(message, type);
      }
      return true;
    }, true);

    // save_checkpoint(checkpoint_name) — сохранение контрольной точки
    this.story.BindExternalFunction("save_checkpoint", (checkpointName: string) => {
      if (this.externalCallbacks.onSaveCheckpoint) {
        this.externalCallbacks.onSaveCheckpoint(checkpointName);
      }
      return true;
    }, true);

    // trigger_game_over(reason) — триггер окончания игры
    this.story.BindExternalFunction("trigger_game_over", (reason: string) => {
      if (this.externalCallbacks.onTriggerGameOver) {
        this.externalCallbacks.onTriggerGameOver(reason);
      }
      return true;
    }, false); // НЕ lookahead-safe, т.к. имеет серьёзные побочные эффекты
  }

  /**
   * Определяет тип истории (Red Forest или обычная)
   */
  private detectStoryType(): void {
    try {
      // Проверяем наличие переменной sanity — это индикатор Red Forest
      const sanity = this.story.variablesState.$("sanity");
      this.isRedForestStory = sanity !== undefined;
    } catch {
      this.isRedForestStory = false;
    }
  }

  /**
   * Настраивает наблюдатель за переменными inkjs
   */
  private setupVariableObserver(): void {
    // inkjs 2.x поддерживает ObserveVariable
    if (typeof this.story.ObserveVariable === "function") {
      const varsToObserve = this.isRedForestStory 
        ? RED_FOREST_VARIABLES 
        : ["score", "objectivity", "chapter"];
      
      for (const varName of varsToObserve) {
        try {
          this.story.ObserveVariable(varName, (variableName: string, newValue: unknown) => {
            this.notifyObservers(variableName, newValue);
          });
        } catch {
          // Variable doesn't exist in this story
        }
      }
    }
  }

  /**
   * Уведомляет наблюдателей об изменении переменной
   */
  private notifyObservers(variableName: string, newValue: unknown): void {
    // Уведомляем конкретных наблюдателей
    const observers = this.variableObservers.get(variableName);
    if (observers) {
      observers.forEach(observer => observer(variableName, newValue));
    }
    
    // Уведомляем глобальных наблюдателей
    this.globalObservers.forEach(observer => observer(variableName, newValue));
  }

  /**
   * Подписаться на изменение конкретной переменной
   */
  observeVariable(variableName: string, observer: VariableObserver): () => void {
    if (!this.variableObservers.has(variableName)) {
      this.variableObservers.set(variableName, new Set());
    }
    this.variableObservers.get(variableName)!.add(observer);
    
    // Возвращаем функцию отписки
    return () => {
      this.variableObservers.get(variableName)?.delete(observer);
    };
  }

  /**
   * Подписаться на изменение любой переменной
   */
  observeAllVariables(observer: VariableObserver): () => void {
    this.globalObservers.add(observer);
    return () => {
      this.globalObservers.delete(observer);
    };
  }

  /**
   * Продолжить историю до следующего выбора или конца
   */
  continue(): InkState {
    this.collectedParagraphs = [];

    // Продолжаем пока можем
    while (this.story.canContinue) {
      const text = this.story.Continue();
      const tags = this.story.currentTags || [];

      if (text && text.trim()) {
        this.collectedParagraphs.push({
          text: text.trim(),
          tags: [...tags],
        });
      }
    }

    return this.getState();
  }

  /**
   * Сделать выбор
   */
  choose(choiceIndex: number): InkState {
    if (choiceIndex >= 0 && choiceIndex < this.story.currentChoices.length) {
      this.story.ChooseChoiceIndex(choiceIndex);
    }
    return this.continue();
  }

  /**
   * Получить текущее состояние
   */
  getState(): InkState {
    const choices = this.story.currentChoices.map((choice, index) => ({
      index,
      text: choice.text,
    }));

    // Собираем все теги из параграфов
    const allTags = this.collectedParagraphs.flatMap((p) => p.tags);

    // Собираем глобальные теги
    const globalTags = this.story.globalTags || [];

    const variables = this.getVariables();

    return {
      paragraphs: [...this.collectedParagraphs],
      choices,
      canContinue: this.story.canContinue,
      isEnd: !this.story.canContinue && choices.length === 0,
      variables,
      tags: [...new Set([...allTags, ...globalTags])],
      // Red Forest специфичные поля
      sanity: variables.sanity as number | undefined,
      daysRemaining: variables.days_remaining as number | undefined,
      chapter: variables.chapter as number | undefined,
    };
  }

  /**
   * Получить все переменные
   */
  getVariables(): Record<string, unknown> {
    const vars: Record<string, unknown> = {};
    
    // Выбираем список переменных в зависимости от типа истории
    const knownVars = this.isRedForestStory 
      ? RED_FOREST_VARIABLES 
      : [
          "score",
          "objectivity", 
          "chapter",
          "kravchenko_arrested",
          "secret_folder",
          "victims_count",
        ];

    for (const name of knownVars) {
      try {
        const value = this.story.variablesState.$(name);
        if (value !== undefined) {
          vars[name] = value;
        }
      } catch {
        // Variable not found, skip
      }
    }

    return vars;
  }

  /**
   * Получить значение переменной
   */
  getVariable(name: string): unknown {
    try {
      return this.story.variablesState.$(name);
    } catch {
      return undefined;
    }
  }

  /**
   * Установить переменную
   */
  setVariable(name: string, value: string | number | boolean): void {
    try {
      this.story.variablesState.$(name, value);
    } catch (e) {
      console.warn(`Cannot set variable ${name}:`, e);
    }
  }

  /**
   * Установить несколько переменных сразу
   */
  setVariables(variables: Record<string, string | number | boolean>): void {
    for (const [name, value] of Object.entries(variables)) {
      this.setVariable(name, value);
    }
  }

  /**
   * Сохранить состояние
   */
  saveState(): string {
    return this.story.state.toJson();
  }

  /**
   * Загрузить состояние
   * @throws Error если JSON невалидный
   */
  loadState(stateJson: string): void {
    if (!stateJson || typeof stateJson !== "string") {
      throw new Error("Invalid state JSON: must be a non-empty string");
    }
    
    try {
      // Проверяем что это валидный JSON
      JSON.parse(stateJson);
    } catch (e) {
      throw new Error(`Invalid state JSON: ${e instanceof Error ? e.message : "parse error"}`);
    }
    
    this.story.state.LoadJson(stateJson);
    this.collectedParagraphs = [];
  }

  /**
   * Сбросить историю
   */
  reset(): InkState {
    this.story.ResetState();
    this.collectedParagraphs = [];
    return this.continue();
  }

  /**
   * Перейти к метке
   */
  goTo(path: string): InkState {
    try {
      this.story.ChoosePathString(path);
      return this.continue();
    } catch (e) {
      console.error(`Cannot go to path ${path}:`, e);
      return this.getState();
    }
  }

  /**
   * Проверить, посещена ли метка
   */
  hasVisited(path: string): boolean {
    try {
      return (this.story.state?.VisitCountAtPathString(path) ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Привязать внешнюю функцию
   */
  bindExternalFunction(
    name: string,
    fn: ExternalFunctionHandler,
    lookaheadSafe = true
  ): void {
    this.story.BindExternalFunction(name, fn, lookaheadSafe);
  }

  /**
   * Привязать все стандартные внешние функции Red Forest
   */
  bindRedForestFunctions(handlers: {
    playSound?: (sound: string) => void;
    triggerHaptic?: (type: string) => void;
    saveCheckpoint?: () => void;
    showNotification?: (message: string) => void;
    unlockAchievement?: (id: string) => void;
  }): void {
    if (handlers.playSound) {
      this.bindExternalFunction("play_sound", (sound: unknown) => {
        handlers.playSound!(String(sound));
      });
    }
    
    if (handlers.triggerHaptic) {
      this.bindExternalFunction("trigger_haptic", (type: unknown) => {
        handlers.triggerHaptic!(String(type));
      });
    }
    
    if (handlers.saveCheckpoint) {
      this.bindExternalFunction("save_checkpoint", () => {
        handlers.saveCheckpoint!();
      });
    }
    
    if (handlers.showNotification) {
      this.bindExternalFunction("show_notification", (message: unknown) => {
        handlers.showNotification!(String(message));
      });
    }
    
    if (handlers.unlockAchievement) {
      this.bindExternalFunction("unlock_achievement", (id: unknown) => {
        handlers.unlockAchievement!(String(id));
      });
    }
  }

  /**
   * Подписаться на ошибки
   */
  onError(handler: (message: string, type: number) => void): void {
    this.story.onError = handler;
  }

  /**
   * Проверить, является ли это историей Red Forest
   */
  isRedForest(): boolean {
    return this.isRedForestStory;
  }

  /**
   * Получить прямой доступ к Story (для продвинутых операций)
   */
  getStory(): Story {
    return this.story;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ ДЛЯ РАБОТЫ С ТЕГАМИ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Парсит тег формата "key: value" или "key"
 */
export function parseTag(tag: string): TagValue {
  const colonIndex = tag.indexOf(":");
  if (colonIndex === -1) {
    return { key: tag.trim(), value: true };
  }
  return {
    key: tag.slice(0, colonIndex).trim(),
    value: tag.slice(colonIndex + 1).trim(),
  };
}

/**
 * Извлекает значение тега по ключу
 */
export function getTagValue(tags: string[], key: string): string | boolean | null {
  for (const tag of tags) {
    const parsed = parseTag(tag);
    if (parsed.key === key) {
      return parsed.value;
    }
  }
  return null;
}

/**
 * Проверяет наличие тега
 */
export function hasTag(tags: string[], key: string): boolean {
  return tags.some((tag) => parseTag(tag).key === key);
}

/**
 * Извлекает все значения тега
 */
export function getAllTagValues(tags: string[], key: string): string[] {
  return tags
    .map(parseTag)
    .filter((t) => t.key === key)
    .map((t) => String(t.value));
}
