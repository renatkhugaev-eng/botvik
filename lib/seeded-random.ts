/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEEDED RANDOM
 * Детерминированный генератор случайных чисел для воспроизводимости миссий
 * 
 * Best Practices 2025:
 * - Reproducible procedural generation
 * - Deterministic outputs for testing
 * - No external dependencies
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Mulberry32 — быстрый и качественный PRNG
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Конвертировать строку в числовой seed
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Генератор случайных чисел с seed
 */
export class SeededRandom {
  private rng: () => number;
  public readonly seed: string;
  
  constructor(seed?: string) {
    // Если seed не передан — генерируем уникальный
    this.seed = seed || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.rng = mulberry32(stringToSeed(this.seed));
  }
  
  /**
   * Случайное число от 0 до 1 (аналог Math.random())
   */
  random(): number {
    return this.rng();
  }
  
  /**
   * Целое число в диапазоне [min, max] (включительно)
   */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
  
  /**
   * Число с плавающей точкой в диапазоне [min, max)
   */
  float(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }
  
  /**
   * Выбрать случайный элемент из массива
   */
  choice<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot choose from empty array");
    }
    return arr[Math.floor(this.random() * arr.length)];
  }
  
  /**
   * Перемешать массив (Fisher-Yates shuffle)
   */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  /**
   * Булево значение с заданной вероятностью true
   */
  boolean(probability: number = 0.5): boolean {
    return this.random() < probability;
  }
  
  /**
   * Выбрать N случайных уникальных элементов из массива
   */
  sample<T>(arr: readonly T[], count: number): T[] {
    if (count > arr.length) {
      return this.shuffle([...arr]);
    }
    
    const shuffled = this.shuffle([...arr]);
    return shuffled.slice(0, count);
  }
}

/**
 * Создать генератор с автоматическим seed
 */
export function createSeededRandom(seed?: string): SeededRandom {
  return new SeededRandom(seed);
}

/**
 * Сгенерировать уникальный seed
 */
export function generateSeed(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

