/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LIVEBLOCKS CONFIGURATION — Real-time Duels
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Этот файл определяет типы для Liveblocks:
 * - Presence: состояние присутствия игрока
 * - Storage: общее состояние дуэли
 * - UserMeta: метаданные пользователя
 * - RoomEvent: события в комнате
 */

import { createClient } from "@liveblocks/client";
import { createRoomContext, createLiveblocksContext } from "@liveblocks/react";

// ═══════════════════════════════════════════════════════════════════════════
// LIVEBLOCKS CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
  
  // Throttle для оптимизации
  throttle: 100,
});

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ ДУЭЛИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Presence — локальное состояние каждого игрока
 * Видно другим игрокам в комнате
 */
export type DuelPresence = {
  odId: number;           // ID пользователя
  odName: string;         // Имя для отображения
  odPhotoUrl: string | null;
  isReady: boolean;       // Готов начать?
  currentQuestion: number; // На каком вопросе сейчас
  hasAnswered: boolean;   // Ответил ли на текущий вопрос
};

/**
 * Storage — общее состояние дуэли (синхронизируется через CRDT)
 */
export type DuelStorage = {
  // Метаданные дуэли
  duelId: string;
  quizId: number;
  quizTitle: string;
  
  // Игроки
  players: {
    odId: number;
    odName: string;
    odPhotoUrl: string | null;
  }[];
  
  // Вопросы (загружаются при старте)
  questions: {
    id: number;
    text: string;
    options: { id: number; text: string }[];
    timeLimitSeconds: number;
  }[];
  
  // Состояние игры
  status: "waiting" | "countdown" | "playing" | "question_result" | "finished";
  currentQuestionIndex: number;
  questionStartedAt: number | null; // timestamp
  
  // Ответы игроков (скрыты до reveal)
  // Формат: { odId: { questionIndex: optionId } }
  answers: Record<number, Record<number, number>>;
  
  // SECURITY: Правильные ответы теперь приходят ТОЛЬКО от сервера после ответа
  // revealedAnswers заполняется после того как оба ответили и сервер вернул correctOptionId
  revealedAnswers: Record<number, number>; // { questionIndex: correctOptionId }
  
  // Очки
  scores: Record<number, number>; // { odId: score }
  
  // Финальные результаты
  winnerId: number | null;
  finished: boolean;
};

/**
 * UserMeta — метаданные пользователя (из auth endpoint)
 */
export type DuelUserMeta = {
  id: string;        // odId as string
  info: {
    odId: number;
    odName: string;
    odPhotoUrl: string | null;
  };
};

/**
 * RoomEvent — события от сервера или других клиентов
 */
export type DuelRoomEvent = 
  | { type: "GAME_START"; startsAt: number }
  | { type: "QUESTION_REVEAL"; questionIndex: number }
  | { type: "ANSWER_REVEAL"; questionIndex: number; correctOptionId: number }
  | { type: "GAME_END"; winnerId: number | null; scores: Record<number, number> }
  | { type: "PLAYER_ANSWERED"; odId: number; questionIndex: number }
  | { type: "TIME_UP"; questionIndex: number }
  | { type: "PLAYER_FORFEIT"; odId: number; winnerId: number; scores: Record<number, number> };

// ═══════════════════════════════════════════════════════════════════════════
// ROOM CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useSelf,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useOther,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  useLostConnectionListener,
  
  // Storage hooks
  useStorage,
  useMutation,
  useCanUndo,
  useCanRedo,
  useUndo,
  useRedo,
  useHistory,
  
  // Suspense versions
  suspense: {
    RoomProvider: SuspenseRoomProvider,
    useRoom: useSuspenseRoom,
    useMyPresence: useSuspenseMyPresence,
    useSelf: useSuspenseSelf,
    useOthers: useSuspenseOthers,
    useStorage: useSuspenseStorage,
  },
} = createRoomContext<
  DuelPresence,
  DuelStorage,
  DuelUserMeta,
  DuelRoomEvent
>(client);

// ═══════════════════════════════════════════════════════════════════════════
// LIVEBLOCKS CONTEXT (для глобального провайдера)
// ═══════════════════════════════════════════════════════════════════════════

export const {
  LiveblocksProvider,
  useInboxNotifications,
  useUnreadInboxNotificationsCount,
} = createLiveblocksContext(client);

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Начальное состояние Presence
 */
export const initialPresence: DuelPresence = {
  odId: 0,
  odName: "",
  odPhotoUrl: null,
  isReady: false,
  currentQuestion: 0,
  hasAnswered: false,
};

/**
 * Начальное состояние Storage
 * SECURITY: correctAnswers больше не передаются — они приходят от сервера после ответов
 */
export function createInitialStorage(data: {
  duelId: string;
  quizId: number;
  quizTitle: string;
  players: DuelStorage["players"];
  questions: DuelStorage["questions"];
}): DuelStorage {
  return {
    duelId: data.duelId,
    quizId: data.quizId,
    quizTitle: data.quizTitle,
    players: data.players,
    questions: data.questions,
    status: "waiting",
    currentQuestionIndex: 0,
    questionStartedAt: null,
    answers: {},
    revealedAnswers: {}, // Заполняется от сервера после ответов
    scores: Object.fromEntries(data.players.map(p => [p.odId, 0])),
    winnerId: null,
    finished: false,
  };
}
