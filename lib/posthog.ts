import posthog from "posthog-js";

/**
 * Posthog Analytics Configuration
 * 
 * Events tracked:
 * - quiz_started: User starts a quiz
 * - quiz_completed: User finishes a quiz
 * - question_answered: User answers a question
 * - share_clicked: User clicks share button
 * - leaderboard_viewed: User views leaderboard
 * - profile_viewed: User views profile
 */

// Initialize only on client side
export function initPosthog() {
  if (typeof window === "undefined") return;
  
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  
  if (!key) {
    console.warn("[Posthog] No API key configured");
    return;
  }
  
  posthog.init(key, {
    api_host: host,
    // Capture page views automatically
    capture_pageview: true,
    // Capture page leaves
    capture_pageleave: true,
    // Session recording (optional, uses quota)
    disable_session_recording: process.env.NODE_ENV !== "production",
    // Respect Do Not Track
    respect_dnt: true,
    // Persist across sessions
    persistence: "localStorage",
    // Bootstrap with feature flags (if any)
    bootstrap: {},
    // Mask sensitive data
    mask_all_text: false,
    mask_all_element_attributes: false,
    // Autocapture clicks, inputs, etc.
    autocapture: true,
    // Suppress network errors in console (504, timeouts, etc.)
    on_xhr_error: (error) => {
      // Silently handle network errors - they're expected when offline
      if (process.env.NODE_ENV !== "production") {
        console.debug("[PostHog] Network error (suppressed):", error);
      }
    },
    // Load toolbar for debugging (dev only)
    loaded: (ph) => {
      if (process.env.NODE_ENV !== "production") {
        // Disable verbose debug logging which causes console spam
        // ph.debug();
      }
    },
  });
}

/**
 * Identify user (call after authentication)
 */
export function identifyUser(user: {
  id: number;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
}) {
  if (typeof window === "undefined") return;
  
  posthog.identify(String(user.id), {
    telegram_id: user.telegramId,
    username: user.username || undefined,
    first_name: user.firstName || undefined,
  });
}

/**
 * Reset user (call on logout)
 */
export function resetUser() {
  if (typeof window === "undefined") return;
  posthog.reset();
}

// ═══════════════════════════════════════════════════════════════════
// QUIZ EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackQuizStarted(quizId: number, quizTitle: string, attemptNumber: number) {
  posthog.capture("quiz_started", {
    quiz_id: quizId,
    quiz_title: quizTitle,
    attempt_number: attemptNumber,
  });
}

export function trackQuizCompleted(data: {
  quizId: number;
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  stars: number;
  attemptNumber: number;
  timeSpentSeconds: number;
}) {
  posthog.capture("quiz_completed", {
    quiz_id: data.quizId,
    quiz_title: data.quizTitle,
    score: data.score,
    correct_count: data.correctCount,
    total_questions: data.totalQuestions,
    accuracy: Math.round((data.correctCount / data.totalQuestions) * 100),
    stars: data.stars,
    attempt_number: data.attemptNumber,
    time_spent_seconds: data.timeSpentSeconds,
  });
}

export function trackQuestionAnswered(data: {
  quizId: number;
  questionIndex: number;
  isCorrect: boolean;
  timeSpentMs: number;
  streak: number;
}) {
  posthog.capture("question_answered", {
    quiz_id: data.quizId,
    question_index: data.questionIndex,
    is_correct: data.isCorrect,
    time_spent_ms: data.timeSpentMs,
    streak: data.streak,
  });
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackPageView(pageName: string, properties?: Record<string, unknown>) {
  posthog.capture("$pageview", {
    page_name: pageName,
    ...properties,
  });
}

export function trackLeaderboardViewed(quizId?: number) {
  posthog.capture("leaderboard_viewed", {
    quiz_id: quizId || "global",
  });
}

export function trackProfileViewed() {
  posthog.capture("profile_viewed");
}

// ═══════════════════════════════════════════════════════════════════
// SOCIAL EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackShareClicked(type: "story" | "message" | "link", quizId?: number) {
  posthog.capture("share_clicked", {
    share_type: type,
    quiz_id: quizId,
  });
}

export function trackFriendInvited() {
  posthog.capture("friend_invited");
}

// ═══════════════════════════════════════════════════════════════════
// ENGAGEMENT EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackButtonClicked(buttonName: string, context?: string) {
  posthog.capture("button_clicked", {
    button_name: buttonName,
    context,
  });
}

export function trackError(errorType: string, errorMessage: string) {
  posthog.capture("error_occurred", {
    error_type: errorType,
    error_message: errorMessage,
  });
}

// Export posthog instance for advanced usage
export { posthog };

