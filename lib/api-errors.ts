/**
 * ══════════════════════════════════════════════════════════════════════════════
 * API ERROR CODES — Best Practices 2025
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Централизованные коды ошибок API.
 * Преимущества:
 * - Типизированные ошибки (TypeScript)
 * - Единообразие ответов
 * - Локализация на клиенте
 * - Документация в одном месте
 */

import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CODES ENUM
// ═══════════════════════════════════════════════════════════════════════════

export const API_ERRORS = {
  // ═══ AUTH ERRORS (401) ═══
  NO_AUTH_DATA: {
    code: "NO_AUTH_DATA",
    message: "Откройте приложение через Telegram",
    status: 401,
  },
  AUTH_FAILED: {
    code: "AUTH_FAILED",
    message: "Ошибка авторизации",
    status: 401,
  },
  AUTH_EXPIRED: {
    code: "AUTH_EXPIRED",
    message: "Сессия истекла, перезайдите",
    status: 401,
  },
  INVALID_TOKEN: {
    code: "INVALID_TOKEN",
    message: "Неверный токен",
    status: 401,
  },

  // ═══ AUTHORIZATION ERRORS (403) ═══
  NOT_AUTHORIZED: {
    code: "NOT_AUTHORIZED",
    message: "Нет доступа",
    status: 403,
  },
  ADMIN_REQUIRED: {
    code: "ADMIN_REQUIRED",
    message: "Требуются права администратора",
    status: 403,
  },
  NOT_PARTICIPANT: {
    code: "NOT_PARTICIPANT",
    message: "Вы не участник этой игры",
    status: 403,
  },
  NOT_OWNER: {
    code: "NOT_OWNER",
    message: "Вы не владелец этого ресурса",
    status: 403,
  },
  CSRF_ERROR: {
    code: "CSRF_ERROR",
    message: "Ошибка безопасности",
    status: 403,
  },

  // ═══ NOT FOUND ERRORS (404) ═══
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "Не найдено",
    status: 404,
  },
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    message: "Пользователь не найден",
    status: 404,
  },
  QUIZ_NOT_FOUND: {
    code: "QUIZ_NOT_FOUND",
    message: "Квиз не найден",
    status: 404,
  },
  DUEL_NOT_FOUND: {
    code: "DUEL_NOT_FOUND",
    message: "Дуэль не найдена",
    status: 404,
  },
  SESSION_NOT_FOUND: {
    code: "SESSION_NOT_FOUND",
    message: "Сессия не найдена",
    status: 404,
  },
  ITEM_NOT_FOUND: {
    code: "ITEM_NOT_FOUND",
    message: "Предмет не найден",
    status: 404,
  },
  FRIENDSHIP_NOT_FOUND: {
    code: "FRIENDSHIP_NOT_FOUND",
    message: "Дружба не найдена",
    status: 404,
  },

  // ═══ VALIDATION ERRORS (400) ═══
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "Неверные данные",
    status: 400,
  },
  MISSING_PARAMS: {
    code: "MISSING_PARAMS",
    message: "Отсутствуют обязательные параметры",
    status: 400,
  },
  INVALID_JSON: {
    code: "INVALID_JSON",
    message: "Неверный формат JSON",
    status: 400,
  },
  INVALID_ID: {
    code: "INVALID_ID",
    message: "Неверный ID",
    status: 400,
  },

  // ═══ BUSINESS LOGIC ERRORS (400) ═══
  ALREADY_EXISTS: {
    code: "ALREADY_EXISTS",
    message: "Уже существует",
    status: 400,
  },
  DUEL_ALREADY_EXISTS: {
    code: "DUEL_ALREADY_EXISTS",
    message: "Дуэль уже существует",
    status: 400,
  },
  ALREADY_FRIENDS: {
    code: "ALREADY_FRIENDS",
    message: "Вы уже друзья",
    status: 400,
  },
  ALREADY_OWNED: {
    code: "ALREADY_OWNED",
    message: "Предмет уже куплен",
    status: 400,
  },
  CANNOT_ADD_SELF: {
    code: "CANNOT_ADD_SELF",
    message: "Нельзя добавить себя",
    status: 400,
  },
  CANNOT_CHALLENGE_SELF: {
    code: "CANNOT_CHALLENGE_SELF",
    message: "Нельзя вызвать себя на дуэль",
    status: 400,
  },
  NOT_FRIENDS: {
    code: "NOT_FRIENDS",
    message: "Вы не друзья",
    status: 400,
  },
  DUEL_NOT_READY: {
    code: "DUEL_NOT_READY",
    message: "Дуэль ещё не готова",
    status: 400,
  },
  DUEL_EXPIRED: {
    code: "DUEL_EXPIRED",
    message: "Дуэль истекла",
    status: 400,
  },
  GAME_NOT_COMPLETE: {
    code: "GAME_NOT_COMPLETE",
    message: "Игра ещё не завершена",
    status: 400,
  },
  SESSION_FINISHED: {
    code: "SESSION_FINISHED",
    message: "Сессия уже завершена",
    status: 400,
  },
  QUIZ_COMPLETED: {
    code: "QUIZ_COMPLETED",
    message: "Квиз уже пройден",
    status: 400,
  },
  ITEM_NOT_AVAILABLE: {
    code: "ITEM_NOT_AVAILABLE",
    message: "Предмет недоступен",
    status: 400,
  },
  INSUFFICIENT_FUNDS: {
    code: "INSUFFICIENT_FUNDS",
    message: "Недостаточно средств",
    status: 400,
  },
  REQUEST_PENDING: {
    code: "REQUEST_PENDING",
    message: "Запрос уже отправлен",
    status: 400,
  },

  // ═══ RATE LIMIT ERRORS (429) ═══
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Слишком много запросов",
    status: 429,
  },

  // ═══ SERVER ERRORS (500) ═══
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "Внутренняя ошибка сервера",
    status: 500,
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "Ошибка базы данных",
    status: 500,
  },
  EXTERNAL_SERVICE_ERROR: {
    code: "EXTERNAL_SERVICE_ERROR",
    message: "Ошибка внешнего сервиса",
    status: 500,
  },
  PAYMENT_ERROR: {
    code: "PAYMENT_ERROR",
    message: "Ошибка платежа",
    status: 500,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ApiErrorCode = keyof typeof API_ERRORS;
export type ApiError = (typeof API_ERRORS)[ApiErrorCode];

export interface ApiErrorResponse {
  ok: false;
  error: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data?: T;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create error response from API_ERRORS
 */
export function errorResponse(
  errorKey: ApiErrorCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const error = API_ERRORS[errorKey];
  
  const body: ApiErrorResponse = {
    ok: false,
    error: error.code,
    message: error.message,
  };
  
  if (details !== undefined) {
    body.details = details;
  }
  
  return NextResponse.json(body, { status: error.status });
}

/**
 * Create success response
 */
export function successResponse<T>(
  data?: T,
  extra?: Record<string, unknown>
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    ok: true,
    ...(data !== undefined && { data }),
    ...extra,
  });
}

/**
 * Create custom error response
 */
export function customError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    ok: false,
    error: code,
    message,
  };
  
  if (details !== undefined) {
    body.details = details;
  }
  
  return NextResponse.json(body, { status });
}

/**
 * Type guard to check if error is ApiErrorCode
 */
export function isApiErrorCode(code: string): code is ApiErrorCode {
  return code in API_ERRORS;
}

/**
 * Get localized error message
 */
export function getErrorMessage(code: string): string {
  if (isApiErrorCode(code)) {
    return API_ERRORS[code].message;
  }
  return "Произошла ошибка";
}

