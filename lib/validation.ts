/**
 * Zod Validation Utilities for API Endpoints
 * 
 * Централизованная валидация входных данных с типобезопасностью
 */

import { z } from "zod";
import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// COMMON SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/** Положительное целое число */
export const positiveInt = z.number().int().positive();

/** ID пользователя */
export const userId = z.number().int().positive();

/** ID квиза */
export const quizId = z.number().int().positive();

/** ID сессии */
export const sessionId = z.number().int().positive();

/** Telegram ID (строка) */
export const telegramId = z.string().min(1).max(20);

/** Username (опционально) */
export const username = z.string().min(1).max(64).optional().nullable();

/** Время в миллисекундах (неотрицательное) */
export const timeMs = z.number().int().min(0).max(300000); // max 5 min

// ═══════════════════════════════════════════════════════════════════════════
// QUIZ SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const quizAnswerSchema = z.object({
  sessionId: positiveInt,
  questionId: positiveInt,
  optionId: positiveInt,
  timeSpentMs: timeMs.optional().default(0),
});

export const quizStartSchema = z.object({
  userId: positiveInt.optional(), // Legacy support
});

// ═══════════════════════════════════════════════════════════════════════════
// SHOP SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const shopPurchaseSchema = z.object({
  itemId: positiveInt,
});

export const shopEquipSchema = z.object({
  itemId: positiveInt.nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════
// FRIENDS SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const addFriendSchema = z.object({
  friendUsername: z.string().min(1).max(64),
});

export const friendActionSchema = z.object({
  requestId: positiveInt,
  action: z.enum(["accept", "decline"]),
});

export const deleteFriendSchema = z.object({
  friendshipId: positiveInt,
});

// ═══════════════════════════════════════════════════════════════════════════
// DUEL SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const createDuelSchema = z.object({
  opponentId: positiveInt,
  quizId: positiveInt,
});

export const duelAnswerSchema = z.object({
  questionIndex: z.number().int().min(0).max(50),
  optionId: positiveInt.nullable(), // null = timeout
  timeSpentMs: timeMs,
});

export const duelActionSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const notificationSettingsSchema = z.object({
  settings: z.object({
    notifyLevelUp: z.boolean().optional(),
    notifyEnergyFull: z.boolean().optional(),
    notifyDailyReminder: z.boolean().optional(),
    notifyLeaderboard: z.boolean().optional(),
    notifyFriends: z.boolean().optional(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  prizeTitle: z.string().min(1).max(200),
  prizeDescription: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  questions: z.array(z.object({
    text: z.string().min(1).max(1000),
    difficulty: z.number().int().min(1).max(3).optional().default(1),
    timeLimitSeconds: z.number().int().min(5).max(120).optional().default(15),
    answers: z.array(z.object({
      text: z.string().min(1).max(500),
      isCorrect: z.boolean().optional().default(false),
    })).min(2).max(6),
  })).optional(),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  prizeTitle: z.string().min(1).max(200).optional(),
  prizeDescription: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// INVESTIGATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const episodeCompleteSchema = z.object({
  score: z.number().int().min(0).optional(),
  choices: z.record(z.string(), z.string()).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  timeSpent: z.number().int().min(0).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════════════════

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details: z.ZodError };

/**
 * Validate request body with Zod schema
 * Returns parsed data or error response
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(body);
  
  if (!result.success) {
    return {
      success: false,
      error: "validation_error",
      details: result.error,
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Parse and validate request body, returning NextResponse on error
 */
export async function parseAndValidate<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; response: NextResponse }> {
  let body: unknown;
  
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        { status: 400 }
      ),
    };
  }
  
  const result = schema.safeParse(body);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    const path = firstError?.path.join(".") || "body";
    const message = firstError?.message || "Validation failed";
    
    return {
      success: false,
      response: NextResponse.json(
        { 
          error: "validation_error", 
          message: `${path}: ${message}`,
          details: result.error.errors.map(e => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate URL params (e.g., quiz ID from route)
 */
export function validateId(value: string | undefined, name: string = "id"): 
  { success: true; value: number } | { success: false; response: NextResponse } {
  
  const num = Number(value);
  
  if (!value || Number.isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "invalid_param", message: `${name} must be a positive integer` },
        { status: 400 }
      ),
    };
  }
  
  return { success: true, value: num };
}

/**
 * Validate request body with Zod schema (async version for NextRequest)
 * Alias for parseAndValidate with simpler return type
 */
export async function validate<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; details?: z.ZodIssue[] }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      error: "Invalid JSON body",
    };
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      details: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

