/**
 * ══════════════════════════════════════════════════════════════════════════════
 * STRUCTURED LOGGING UTILITY
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Профессиональный логгер для production:
 * - Уровни логирования (debug, info, warn, error)
 * - Отключение debug в production
 * - Структурированный вывод с context
 * - Интеграция с Sentry для ошибок
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('[Quiz] Started', { quizId: 123, userId: 456 });
 *   logger.error('[Auth] Failed', { error, userId });
 */

import * as Sentry from "@sentry/nextjs";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_SERVER = typeof window === "undefined";

// В production показываем только info и выше
const MIN_LEVEL: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PRODUCTION_MIN_LEVEL = MIN_LEVEL.info;
const DEVELOPMENT_MIN_LEVEL = MIN_LEVEL.debug;

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return "";
  
  try {
    // Safely stringify, handling circular references
    const seen = new WeakSet();
    const serialized = JSON.stringify(context, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      // Handle Error objects
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack?.split("\n").slice(0, 3).join("\n"),
        };
      }
      return value;
    });
    return ` ${serialized}`;
  } catch {
    return " [Unserializable context]";
  }
}

function getLogPrefix(level: LogLevel): string {
  const prefixes: Record<LogLevel, string> = {
    debug: "🔍",
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
  };
  return prefixes[level];
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE LOGGER
// ═══════════════════════════════════════════════════════════════════════════

function shouldLog(level: LogLevel): boolean {
  const minLevel = IS_PRODUCTION ? PRODUCTION_MIN_LEVEL : DEVELOPMENT_MIN_LEVEL;
  return MIN_LEVEL[level] >= minLevel;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: formatTimestamp(),
    context,
  };

  // В production используем структурированный JSON на сервере
  if (IS_PRODUCTION && IS_SERVER) {
    // Vercel/cloud providers parse JSON logs automatically
    console.log(JSON.stringify(entry));
  } else {
    // Development: красивый вывод
    const prefix = getLogPrefix(level);
    const contextStr = formatContext(context);
    const output = `${prefix} ${message}${contextStr}`;

    switch (level) {
      case "debug":
        console.debug(output);
        break;
      case "info":
        console.info(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  // Отправляем ошибки в Sentry
  if (level === "error" && IS_PRODUCTION) {
    const error = context?.error;
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: context,
        tags: { source: "logger" },
      });
    } else {
      Sentry.captureMessage(message, {
        level: "error",
        extra: context,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const logger = {
  /**
   * Debug logs - только для разработки
   * НЕ выводятся в production
   */
  debug: (message: string, context?: LogContext) => log("debug", message, context),

  /**
   * Info logs - важная информация
   * Выводятся в production
   */
  info: (message: string, context?: LogContext) => log("info", message, context),

  /**
   * Warning logs - потенциальные проблемы
   * Выводятся в production
   */
  warn: (message: string, context?: LogContext) => log("warn", message, context),

  /**
   * Error logs - ошибки
   * Выводятся в production + отправляются в Sentry
   */
  error: (message: string, context?: LogContext) => log("error", message, context),

  /**
   * Создаёт логгер с предустановленным контекстом
   * 
   * @example
   * const quizLogger = logger.child({ quizId: 123 });
   * quizLogger.info("Question answered"); // автоматически включит quizId
   */
  child: (defaultContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log("debug", message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("info", message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log("error", message, { ...defaultContext, ...context }),
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default logger;

/**
 * Хелпер для логирования API запросов
 */
export function logApiRequest(
  method: string,
  path: string,
  context?: LogContext
): void {
  logger.info(`[API] ${method} ${path}`, context);
}

/**
 * Хелпер для логирования времени выполнения
 */
export function logTiming(
  operation: string,
  startTime: number,
  context?: LogContext
): void {
  const duration = Date.now() - startTime;
  logger.info(`[Timing] ${operation}`, { ...context, durationMs: duration });
}

