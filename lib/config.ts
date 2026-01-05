/**
 * ══════════════════════════════════════════════════════════════════════════════
 * APPLICATION CONFIGURATION — Best Practices 2025
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Централизованная конфигурация приложения.
 * Все timeouts, limits и settings в одном месте.
 * 
 * Преимущества:
 * - Легко менять значения без поиска по коду
 * - Environment-specific overrides
 * - Type safety
 * - Документация в одном месте
 */

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

// ═══════════════════════════════════════════════════════════════════════════
// DUEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const DUEL_CONFIG = {
  /** Время на каждый вопрос в секундах */
  QUESTION_TIME_LIMIT_SECONDS: getEnvNumber("DUEL_QUESTION_TIME_LIMIT", 15),
  
  /** Время обратного отсчёта перед стартом */
  COUNTDOWN_SECONDS: getEnvNumber("DUEL_COUNTDOWN", 3),
  
  /** Время показа правильного ответа в мс */
  REVEAL_DURATION_MS: getEnvNumber("DUEL_REVEAL_DURATION", 2500),
  
  /** Задержка перед появлением оппонента в lobby */
  LOBBY_OPPONENT_DELAY_MS: getEnvNumber("DUEL_LOBBY_DELAY", 2000),
  
  /** Grace period для reconnect в мс */
  RECONNECT_GRACE_PERIOD_MS: getEnvNumber("DUEL_RECONNECT_GRACE", 10000),
  
  /** Время жизни дуэли (для friends) в часах */
  DUEL_EXPIRY_HOURS: getEnvNumber("DUEL_EXPIRY_HOURS", 24),
  
  /** Время жизни AI дуэли в часах */
  AI_DUEL_EXPIRY_HOURS: getEnvNumber("AI_DUEL_EXPIRY_HOURS", 1),
  
  /** XP за победу */
  XP_REWARD_WIN: getEnvNumber("DUEL_XP_WIN", 50),
  
  /** XP за поражение (утешительный) */
  XP_REWARD_LOSE: getEnvNumber("DUEL_XP_LOSE", 10),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// AI BOT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const AI_CONFIG = {
  /** Задержка "подключения" AI в мс */
  READY_DELAY_MS: getEnvNumber("AI_READY_DELAY", 1500),
  
  /** Буфер для countdown в мс */
  COUNTDOWN_BUFFER_MS: getEnvNumber("AI_COUNTDOWN_BUFFER", 3500),
  
  /** Интервал polling ответов AI в мс */
  POLL_INTERVAL_MS: getEnvNumber("AI_POLL_INTERVAL", 300),
  
  /** Максимальное ожидание ответа игрока в мс */
  MAX_WAIT_FOR_PLAYER_MS: getEnvNumber("AI_MAX_WAIT", 60000),
  
  /** Вероятность стратегии "ждать игрока" (0-100) */
  WAIT_FOR_PLAYER_PROBABILITY: getEnvNumber("AI_WAIT_PROBABILITY", 40),
  
  /** Минимальная "реакция" AI после ответа игрока в мс */
  MIN_REACTION_MS: getEnvNumber("AI_MIN_REACTION", 800),
  
  /** Максимальная "реакция" AI после ответа игрока в мс */
  MAX_REACTION_MS: getEnvNumber("AI_MAX_REACTION", 2500),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MATCHMAKING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const MATCHMAKING_CONFIG = {
  /** Таймаут поиска реального игрока в мс */
  TIMEOUT_MS: getEnvNumber("MATCHMAKING_TIMEOUT", 10000),
  
  /** Интервал проверки очереди в мс */
  CHECK_INTERVAL_MS: getEnvNumber("MATCHMAKING_CHECK_INTERVAL", 1000),
  
  /** Максимальное количество проверок */
  MAX_CHECKS: getEnvNumber("MATCHMAKING_MAX_CHECKS", 10),
  
  /** Разброс уровней для матчинга */
  LEVEL_RANGE: getEnvNumber("MATCHMAKING_LEVEL_RANGE", 5),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const QUIZ_CONFIG = {
  /** Время на вопрос по умолчанию в мс */
  DEFAULT_TIME_LIMIT_MS: getEnvNumber("QUIZ_TIME_LIMIT", 15000),
  
  /** Минимальное время ответа (anti-cheat) в мс */
  MIN_ANSWER_TIME_MS: getEnvNumber("QUIZ_MIN_ANSWER_TIME", 400),
  
  /** Grace period для timeout в мс */
  GRACE_PERIOD_MS: getEnvNumber("QUIZ_GRACE_PERIOD", 2000),
  
  /** TTL кеша вопросов в мс */
  CACHE_TTL_MS: getEnvNumber("QUIZ_CACHE_TTL", 5 * 60 * 1000),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const AUTH_CONFIG = {
  /** TTL кеша пользователей в мс */
  USER_CACHE_TTL_MS: getEnvNumber("AUTH_CACHE_TTL", 5 * 60 * 1000),
  
  /** Максимальный размер кеша пользователей */
  USER_CACHE_MAX_SIZE: getEnvNumber("AUTH_CACHE_SIZE", 1000),
  
  /** Время жизни Telegram auth в секундах */
  TELEGRAM_AUTH_TTL_SECONDS: getEnvNumber("TELEGRAM_AUTH_TTL", 24 * 60 * 60),
  
  /** Время жизни admin token в секундах */
  ADMIN_TOKEN_TTL_SECONDS: getEnvNumber("ADMIN_TOKEN_TTL", 8 * 60 * 60),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const SECURITY_CONFIG = {
  /** Включить CSRF protection */
  CSRF_ENABLED: getEnvBoolean("SECURITY_CSRF_ENABLED", isProd),
  
  /** Разрешённые origins для CSRF */
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean)
    .concat([
      "https://web.telegram.org",
      "https://telegram.org",
      // Production domains
      "https://botvik.app",
      "https://www.botvik.app",
    ]),
  
  /** Включить strict mode для validation */
  STRICT_VALIDATION: getEnvBoolean("SECURITY_STRICT_VALIDATION", true),
  
  /** Максимальный размер request body в байтах */
  MAX_BODY_SIZE: getEnvNumber("SECURITY_MAX_BODY_SIZE", 1024 * 1024), // 1MB
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const NOTIFICATION_CONFIG = {
  /** Минимальный интервал между уведомлениями в мс */
  MIN_INTERVAL_MS: getEnvNumber("NOTIFICATION_MIN_INTERVAL", 60000),
  
  /** Максимальное количество уведомлений в час */
  MAX_PER_HOUR: getEnvNumber("NOTIFICATION_MAX_HOUR", 5),
  
  /** Включить уведомления в dev mode */
  ENABLED_IN_DEV: getEnvBoolean("NOTIFICATION_DEV_ENABLED", false),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════

export const FEATURES = {
  /** AI боты в дуэлях */
  AI_DUELS: getEnvBoolean("FEATURE_AI_DUELS", true),
  
  /** Панорамные миссии */
  PANORAMA: getEnvBoolean("FEATURE_PANORAMA", true),
  
  /** Расследования (Crime Map) */
  INVESTIGATIONS: getEnvBoolean("FEATURE_INVESTIGATIONS", true),
  
  /** Турниры */
  TOURNAMENTS: getEnvBoolean("FEATURE_TOURNAMENTS", true),
  
  /** Магазин */
  SHOP: getEnvBoolean("FEATURE_SHOP", true),
  
  /** Реферальная система */
  REFERRALS: getEnvBoolean("FEATURE_REFERRALS", true),
  
  /** Ежедневные награды */
  DAILY_REWARDS: getEnvBoolean("FEATURE_DAILY_REWARDS", true),
  
  /** Dev mode bypass auth */
  DEV_MODE_BYPASS: getEnvBoolean("NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM", false) && isDev,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const config = {
  isDev,
  isProd,
  duel: DUEL_CONFIG,
  ai: AI_CONFIG,
  matchmaking: MATCHMAKING_CONFIG,
  quiz: QUIZ_CONFIG,
  auth: AUTH_CONFIG,
  security: SECURITY_CONFIG,
  notification: NOTIFICATION_CONFIG,
  features: FEATURES,
} as const;

export default config;

