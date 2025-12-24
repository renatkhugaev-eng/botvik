/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DEBUG UTILITIES
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Безопасные функции для debug-логирования:
 * - Автоматически отключаются в production
 * - Не требуют изменения существующего кода
 * - Drop-in замена для console.log
 * 
 * Usage (новый код):
 *   import { debug, debugGroup } from '@/lib/debug';
 *   debug("[Component]", "message", data);
 * 
 * Для постепенной миграции существующего кода:
 *   Замените console.log на debug
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Debug log - выводится ТОЛЬКО в development
 * Полностью отключен в production (no-op)
 */
export function debug(...args: unknown[]): void {
  if (IS_PRODUCTION) return;
  console.log(...args);
}

/**
 * Debug warn - выводится ТОЛЬКО в development
 */
export function debugWarn(...args: unknown[]): void {
  if (IS_PRODUCTION) return;
  console.warn(...args);
}

/**
 * Debug group - группирует логи в development
 */
export function debugGroup(label: string): void {
  if (IS_PRODUCTION) return;
  console.group(label);
}

/**
 * Debug group end
 */
export function debugGroupEnd(): void {
  if (IS_PRODUCTION) return;
  console.groupEnd();
}

/**
 * Debug table - выводит таблицу в development
 */
export function debugTable(data: unknown): void {
  if (IS_PRODUCTION) return;
  console.table(data);
}

/**
 * Debug time - начинает таймер в development
 */
export function debugTime(label: string): void {
  if (IS_PRODUCTION) return;
  console.time(label);
}

/**
 * Debug time end - завершает таймер в development
 */
export function debugTimeEnd(label: string): void {
  if (IS_PRODUCTION) return;
  console.timeEnd(label);
}

/**
 * Conditional debug - выводит только если condition true
 */
export function debugIf(condition: boolean, ...args: unknown[]): void {
  if (IS_PRODUCTION || !condition) return;
  console.log(...args);
}

/**
 * Creates a namespaced debug function
 * 
 * @example
 * const log = createDebug('[Quiz]');
 * log('Started', { quizId }); // → [Quiz] Started { quizId: 123 }
 */
export function createDebug(namespace: string) {
  return (...args: unknown[]): void => {
    if (IS_PRODUCTION) return;
    console.log(namespace, ...args);
  };
}

export default debug;

