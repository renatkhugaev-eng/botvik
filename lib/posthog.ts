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

// ═══════════════════════════════════════════════════════════════════
// DUEL EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackDuelCreated(duelId: number, opponentId: number) {
  posthog.capture("duel_created", {
    duel_id: duelId,
    opponent_id: opponentId,
  });
}

export function trackDuelCompleted(data: {
  duelId: number;
  result: "win" | "lose" | "draw";
  myScore: number;
  opponentScore: number;
}) {
  posthog.capture("duel_completed", {
    duel_id: data.duelId,
    result: data.result,
    my_score: data.myScore,
    opponent_score: data.opponentScore,
  });
}

// ═══════════════════════════════════════════════════════════════════
// SHOP EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackShopItemViewed(itemId: number, itemName: string, price: number) {
  posthog.capture("shop_item_viewed", {
    item_id: itemId,
    item_name: itemName,
    price,
  });
}

export function trackPurchaseStarted(itemId: number, itemName: string, price: number) {
  posthog.capture("purchase_started", {
    item_id: itemId,
    item_name: itemName,
    price,
  });
}

export function trackPurchaseCompleted(itemId: number, itemName: string, price: number) {
  posthog.capture("purchase_completed", {
    item_id: itemId,
    item_name: itemName,
    price,
    revenue: price, // For revenue tracking
  });
}

// ═══════════════════════════════════════════════════════════════════
// TOURNAMENT EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackTournamentJoined(tournamentId: number, tournamentTitle: string) {
  posthog.capture("tournament_joined", {
    tournament_id: tournamentId,
    tournament_title: tournamentTitle,
  });
}

export function trackTournamentStageCompleted(data: {
  tournamentId: number;
  stageOrder: number;
  score: number;
  passed: boolean;
}) {
  posthog.capture("tournament_stage_completed", {
    tournament_id: data.tournamentId,
    stage_order: data.stageOrder,
    score: data.score,
    passed: data.passed,
  });
}

// ═══════════════════════════════════════════════════════════════════
// DAILY & REWARDS EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackDailyRewardClaimed(day: number, rewardType: string, rewardValue: number) {
  posthog.capture("daily_reward_claimed", {
    day,
    reward_type: rewardType,
    reward_value: rewardValue,
  });
}

export function trackAchievementUnlocked(achievementId: string, achievementTitle: string) {
  posthog.capture("achievement_unlocked", {
    achievement_id: achievementId,
    achievement_title: achievementTitle,
  });
}

export function trackLevelUp(newLevel: number, totalXp: number) {
  posthog.capture("level_up", {
    new_level: newLevel,
    total_xp: totalXp,
  });
}

// ═══════════════════════════════════════════════════════════════════
// INVESTIGATION EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackInvestigationStarted(investigationId: string, investigationTitle: string) {
  posthog.capture("investigation_started", {
    investigation_id: investigationId,
    investigation_title: investigationTitle,
  });
}

export function trackInvestigationCompleted(investigationId: string, investigationTitle: string) {
  posthog.capture("investigation_completed", {
    investigation_id: investigationId,
    investigation_title: investigationTitle,
  });
}

// ═══════════════════════════════════════════════════════════════════
// SESSION EVENTS
// ═══════════════════════════════════════════════════════════════════

export function trackAppOpened(source: "direct" | "notification" | "referral" | "share") {
  posthog.capture("app_opened", {
    source,
  });
}

export function trackReferralUsed(referralCode: string, referrerId: number) {
  posthog.capture("referral_used", {
    referral_code: referralCode,
    referrer_id: referrerId,
  });
}

// Export posthog instance for advanced usage
export { posthog };

