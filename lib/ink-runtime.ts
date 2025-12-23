/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INK RUNTIME — Обёртка над inkjs для React
 * ══════════════════════════════════════════════════════════════════════════════
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
};

export type TagValue = {
  key: string;
  value: string | boolean;
};

// ══════════════════════════════════════════════════════════════════════════════
// INK RUNNER CLASS
// ══════════════════════════════════════════════════════════════════════════════

export class InkRunner {
  private story: Story;
  private collectedParagraphs: InkParagraph[] = [];

  constructor(storyJson: object) {
    this.story = new Story(storyJson);
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

    return {
      paragraphs: [...this.collectedParagraphs],
      choices,
      canContinue: this.story.canContinue,
      isEnd: !this.story.canContinue && choices.length === 0,
      variables: this.getVariables(),
      tags: [...new Set([...allTags, ...globalTags])],
    };
  }

  /**
   * Получить все переменные
   */
  getVariables(): Record<string, unknown> {
    const vars: Record<string, unknown> = {};
    
    // Стандартные переменные которые мы используем
    const knownVars = [
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
  setVariable(name: string, value: unknown): void {
    try {
      this.story.variablesState.$(name, value);
    } catch (e) {
      console.warn(`Cannot set variable ${name}:`, e);
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
   */
  loadState(stateJson: string): void {
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
      return this.story.state.VisitCountAtPathString(path) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Привязать внешнюю функцию
   */
  bindExternalFunction(
    name: string,
    fn: (...args: unknown[]) => unknown,
    lookaheadSafe = true
  ): void {
    this.story.BindExternalFunction(name, fn, lookaheadSafe);
  }

  /**
   * Подписаться на ошибки
   */
  onError(handler: (message: string, type: number) => void): void {
    this.story.onError = handler;
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
