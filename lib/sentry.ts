import * as Sentry from "@sentry/nextjs";

/**
 * Sentry utilities for manual error tracking
 */

type ErrorContext = {
  userId?: number | string;
  telegramId?: string;
  quizId?: number;
  sessionId?: number;
  action?: string;
  extra?: Record<string, unknown>;
};

/**
 * Capture an exception with context
 */
export function captureError(error: Error | unknown, context?: ErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));
  
  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: String(context.userId) });
    }
    if (context?.telegramId) {
      scope.setTag("telegram_id", context.telegramId);
    }
    if (context?.quizId) {
      scope.setTag("quiz_id", String(context.quizId));
    }
    if (context?.sessionId) {
      scope.setTag("session_id", String(context.sessionId));
    }
    if (context?.action) {
      scope.setTag("action", context.action);
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    
    Sentry.captureException(err);
  });
}

/**
 * Capture a message (info/warning level)
 */
export function captureMessage(
  message: string, 
  level: "info" | "warning" | "error" = "info",
  context?: ErrorContext
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    if (context?.userId) {
      scope.setUser({ id: String(context.userId) });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context for all subsequent events
 */
export function setUser(user: { id: number; telegramId: string; username?: string | null }) {
  Sentry.setUser({
    id: String(user.id),
    username: user.username || undefined,
    // Custom fields
    telegramId: user.telegramId,
  } as Sentry.User & { telegramId: string });
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: "navigation" | "ui" | "api" | "quiz" | "auth",
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {});
}

