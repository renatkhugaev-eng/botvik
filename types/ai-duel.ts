/**
 * ══════════════════════════════════════════════════════════════════════════════
 * AI DUEL TYPES — Типы для AI-противников в дуэлях
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type AIBotDifficulty = 1 | 2 | 3 | 4;

export interface CreateAIDuelRequest {
  /** Режим игры с AI */
  mode: "ai";
  /** ID квиза для дуэли */
  quizId: number;
  /** Сложность AI (опционально, автоматически подбирается по уровню) */
  difficulty?: AIBotDifficulty;
  /** ID конкретного AI-бота для реванша (опционально) */
  opponentId?: number;
}

export interface CreateDuelWithFriendRequest {
  /** ID оппонента (друга) */
  opponentId: number;
  /** ID квиза для дуэли */
  quizId: number;
}

export type CreateDuelRequest = CreateAIDuelRequest | CreateDuelWithFriendRequest;

export function isAIDuelRequest(body: CreateDuelRequest): body is CreateAIDuelRequest {
  return "mode" in body && body.mode === "ai";
}

