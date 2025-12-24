/**
 * ══════════════════════════════════════════════════════════════════════════════
 * UNIFIED API RESPONSE UTILITIES
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Стандартизированные ответы API для консистентности.
 * 
 * Формат успешного ответа:
 * {
 *   ok: true,
 *   data: { ... },
 *   meta?: { ... }
 * }
 * 
 * Формат ошибки:
 * {
 *   ok: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human readable message"
 *   }
 * }
 * 
 * Usage:
 *   import { success, error, paginated } from '@/lib/api-response';
 *   return success({ user });
 *   return error("NOT_FOUND", "User not found", 404);
 */

import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMMON ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════

export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  
  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  
  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  
  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  
  // Business Logic
  INSUFFICIENT_ENERGY: "INSUFFICIENT_ENERGY",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  COOLDOWN_ACTIVE: "COOLDOWN_ACTIVE",
  ACTION_NOT_ALLOWED: "ACTION_NOT_ALLOWED",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a success response
 * 
 * @example
 * return success({ user: { id: 1, name: "John" } });
 * // { ok: true, data: { user: { id: 1, name: "John" } } }
 */
export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    ok: true,
    data,
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return NextResponse.json(response, { status });
}

/**
 * Create a paginated success response
 * 
 * @example
 * return paginated(users, { page: 1, pageSize: 20, total: 100 });
 */
export function paginated<T>(
  items: T[],
  pagination: { page: number; pageSize: number; total: number },
  status: number = 200
): NextResponse<ApiSuccessResponse<T[]>> {
  const { page, pageSize, total } = pagination;
  const totalPages = Math.ceil(total / pageSize);
  
  const meta: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
  
  return success(items, meta, status);
}

/**
 * Create a created response (201)
 */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return success(data, undefined, 201);
}

/**
 * Create a no content response (204)
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an error response
 * 
 * @example
 * return error("NOT_FOUND", "User not found", 404);
 */
export function error(
  code: ErrorCode | string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    ok: false,
    error: {
      code,
      message,
    },
  };
  
  if (details) {
    response.error.details = details;
  }
  
  return NextResponse.json(response, { status });
}

// Convenience error functions
export const errors = {
  unauthorized: (message = "Authentication required") =>
    error(ErrorCodes.UNAUTHORIZED, message, 401),
    
  forbidden: (message = "Access denied") =>
    error(ErrorCodes.FORBIDDEN, message, 403),
    
  notFound: (resource = "Resource") =>
    error(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
    
  conflict: (message: string) =>
    error(ErrorCodes.CONFLICT, message, 409),
    
  validation: (message: string, details?: Record<string, unknown>) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, details),
    
  rateLimited: (retryAfter?: number) =>
    error(
      ErrorCodes.RATE_LIMITED,
      "Too many requests, please try again later",
      429,
      retryAfter ? { retryAfter } : undefined
    ),
    
  internal: (message = "Internal server error") =>
    error(ErrorCodes.INTERNAL_ERROR, message, 500),
    
  insufficientEnergy: () =>
    error(ErrorCodes.INSUFFICIENT_ENERGY, "Not enough energy", 400),
    
  cooldown: (secondsRemaining: number) =>
    error(
      ErrorCodes.COOLDOWN_ACTIVE,
      `Please wait ${secondsRemaining} seconds`,
      400,
      { secondsRemaining }
    ),
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default { success, error, paginated, created, noContent, errors };

