/**
 * ══════════════════════════════════════════════════════════════════════════════
 * STORY ENGINE - Простой движок интерактивных историй
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Упрощённая альтернатива Ink - легко писать, легко использовать.
 * Поддерживает: сцены, выборы, переменные, теги, условия.
 */

// ══════════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════════════════════

export type StoryChoice = {
  id: string;
  text: string;
  next: string; // ID следующей сцены
  condition?: string; // Условие для показа выбора
  effects?: Record<string, number | string | boolean>; // Изменения переменных
};

export type StoryScene = {
  id: string;
  paragraphs: string[]; // Текст сцены (каждый элемент = параграф)
  speaker?: string; // Говорящий персонаж
  mood?: "normal" | "dark" | "tense" | "horror" | "hope";
  tags?: string[]; // Теги для метаданных
  choices?: StoryChoice[]; // Выборы
  next?: string; // Автопереход к следующей сцене (если нет выборов)
  isEnd?: boolean; // Конец истории
  onEnter?: Record<string, number | string | boolean>; // Эффекты при входе в сцену
};

export type Story = {
  id: string;
  title: string;
  startScene: string;
  scenes: Record<string, StoryScene>;
  variables?: Record<string, number | string | boolean>;
};

export type StoryState = {
  currentSceneId: string;
  variables: Record<string, number | string | boolean>;
  visitedScenes: string[];
  collectedClues: string[];
  score: number;
  history: string[]; // История посещённых сцен
};

export type StoryOutput = {
  scene: StoryScene;
  choices: StoryChoice[];
  state: StoryState;
  isEnd: boolean;
};

// ══════════════════════════════════════════════════════════════════════════════
// STORY RUNNER CLASS
// ══════════════════════════════════════════════════════════════════════════════

export class StoryRunner {
  private story: Story;
  private state: StoryState;

  constructor(story: Story, savedState?: StoryState) {
    this.story = story;
    this.state = savedState ?? {
      currentSceneId: story.startScene,
      variables: { ...story.variables },
      visitedScenes: [],
      collectedClues: [],
      score: 0,
      history: [],
    };
  }

  /**
   * Получить текущую сцену и доступные выборы
   */
  getCurrentOutput(): StoryOutput {
    const scene = this.story.scenes[this.state.currentSceneId];
    
    if (!scene) {
      throw new Error(`Scene not found: ${this.state.currentSceneId}`);
    }

    // Применяем эффекты при входе в сцену (если ещё не посещали)
    if (!this.state.visitedScenes.includes(scene.id)) {
      this.state.visitedScenes.push(scene.id);
      this.state.history.push(scene.id);
      
      if (scene.onEnter) {
        this.applyEffects(scene.onEnter);
      }

      // Обрабатываем теги
      if (scene.tags) {
        for (const tag of scene.tags) {
          if (tag.startsWith("clue:")) {
            const clue = tag.replace("clue:", "");
            if (!this.state.collectedClues.includes(clue)) {
              this.state.collectedClues.push(clue);
            }
          }
          if (tag.startsWith("score:")) {
            const delta = parseInt(tag.replace("score:", ""), 10);
            if (!isNaN(delta)) {
              this.state.score += delta;
            }
          }
        }
      }
    }

    // Фильтруем выборы по условиям
    const availableChoices = (scene.choices ?? []).filter((choice) => {
      if (!choice.condition) return true;
      return this.evaluateCondition(choice.condition);
    });

    return {
      scene,
      choices: availableChoices,
      state: { ...this.state },
      isEnd: scene.isEnd ?? false,
    };
  }

  /**
   * Сделать выбор
   */
  choose(choiceId: string): StoryOutput {
    const currentScene = this.story.scenes[this.state.currentSceneId];
    const choice = currentScene.choices?.find((c) => c.id === choiceId);

    if (!choice) {
      throw new Error(`Choice not found: ${choiceId}`);
    }

    // Применяем эффекты выбора
    if (choice.effects) {
      this.applyEffects(choice.effects);
    }

    // Переходим к следующей сцене
    this.state.currentSceneId = choice.next;

    return this.getCurrentOutput();
  }

  /**
   * Перейти к следующей сцене (автопереход)
   */
  continue(): StoryOutput {
    const currentScene = this.story.scenes[this.state.currentSceneId];
    
    if (currentScene.next) {
      this.state.currentSceneId = currentScene.next;
    }

    return this.getCurrentOutput();
  }

  /**
   * Применить эффекты
   */
  private applyEffects(effects: Record<string, number | string | boolean>): void {
    for (const [key, value] of Object.entries(effects)) {
      if (typeof value === "number" && typeof this.state.variables[key] === "number") {
        // Если значение числовое, добавляем к текущему
        (this.state.variables[key] as number) += value;
      } else {
        this.state.variables[key] = value;
      }
    }
  }

  /**
   * Проверить условие
   */
  private evaluateCondition(condition: string): boolean {
    // Простой парсер условий: "variable > 5", "visited:scene_id", "has:clue_id"
    
    if (condition.startsWith("visited:")) {
      const sceneId = condition.replace("visited:", "");
      return this.state.visitedScenes.includes(sceneId);
    }
    
    if (condition.startsWith("has:")) {
      const clueId = condition.replace("has:", "");
      return this.state.collectedClues.includes(clueId);
    }

    if (condition.startsWith("!visited:")) {
      const sceneId = condition.replace("!visited:", "");
      return !this.state.visitedScenes.includes(sceneId);
    }

    // Числовые сравнения: "score > 50"
    const match = condition.match(/^(\w+)\s*(>|<|>=|<=|==|!=)\s*(\d+)$/);
    if (match) {
      const [, varName, op, valueStr] = match;
      const varValue = this.state.variables[varName] as number ?? 0;
      const compareValue = parseInt(valueStr, 10);

      switch (op) {
        case ">": return varValue > compareValue;
        case "<": return varValue < compareValue;
        case ">=": return varValue >= compareValue;
        case "<=": return varValue <= compareValue;
        case "==": return varValue === compareValue;
        case "!=": return varValue !== compareValue;
      }
    }

    return true;
  }

  /**
   * Получить переменную
   */
  getVariable(name: string): number | string | boolean | undefined {
    return this.state.variables[name];
  }

  /**
   * Установить переменную
   */
  setVariable(name: string, value: number | string | boolean): void {
    this.state.variables[name] = value;
  }

  /**
   * Сохранить состояние
   */
  saveState(): StoryState {
    return { ...this.state };
  }

  /**
   * Загрузить состояние
   */
  loadState(state: StoryState): void {
    this.state = { ...state };
  }

  /**
   * Сбросить к началу
   */
  reset(): StoryOutput {
    this.state = {
      currentSceneId: this.story.startScene,
      variables: { ...this.story.variables },
      visitedScenes: [],
      collectedClues: [],
      score: 0,
      history: [],
    };
    return this.getCurrentOutput();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ══════════════════════════════════════════════════════════════════════════════

export function createStory(story: Story): Story {
  return story;
}
