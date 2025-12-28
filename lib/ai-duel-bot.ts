/**
 * ══════════════════════════════════════════════════════════════════════════════
 * AI DUEL BOT — Stealth AI противник для дуэлей
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Профессиональная реализация "невидимого" AI-противника:
 * - Имитирует человеческое поведение (задержки, ошибки)
 * - Записывает ответы в БД как обычный игрок
 * - Скрыт из лидербордов и профилей
 * - Разные уровни сложности
 *
 * ARCHITECTURE:
 * - Serverless worker (не использует WebSocket)
 * - Все ответы записываются через Prisma
 * - Интегрируется с существующей системой дуэлей
 */

import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type AIBotDifficulty = 1 | 2 | 3 | 4;

export interface AIBotConfig {
  difficulty: AIBotDifficulty;
  /** Вероятность правильного ответа (0.0 - 1.0) */
  correctProbability: number;
  /** Минимальное время ответа в мс */
  minResponseMs: number;
  /** Максимальное время ответа в мс */
  maxResponseMs: number;
  /** Вероятность "залипания" (долгой паузы) */
  afkProbability: number;
  /** Время AFK паузы в мс */
  afkDurationMs: [number, number]; // [min, max]
}

export interface AIBotPlayer {
  id: number;
  telegramId: string;
  username: string;
  firstName: string;
  photoUrl: string;
  level: number;
  xp: number;
}

export interface QuestionWithAnswers {
  id: number;
  text: string;
  order: number;
  timeLimitSeconds: number | null;
  answers: Array<{
    id: number;
    text: string;
    isCorrect: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ СЛОЖНОСТИ
// ═══════════════════════════════════════════════════════════════════════════

export const DIFFICULTY_PRESETS: Record<AIBotDifficulty, AIBotConfig> = {
  1: {
    difficulty: 1,
    correctProbability: 0.40,
    minResponseMs: 5000,
    maxResponseMs: 12000,
    afkProbability: 0.15,
    afkDurationMs: [3000, 8000],
  },
  2: {
    difficulty: 2,
    correctProbability: 0.60,
    minResponseMs: 3000,
    maxResponseMs: 8000,
    afkProbability: 0.10,
    afkDurationMs: [2000, 5000],
  },
  3: {
    difficulty: 3,
    correctProbability: 0.80,
    minResponseMs: 1500,
    maxResponseMs: 4000,
    afkProbability: 0.05,
    afkDurationMs: [1000, 3000],
  },
  4: {
    difficulty: 4,
    correctProbability: 0.95,
    minResponseMs: 800,
    maxResponseMs: 2000,
    afkProbability: 0.02,
    afkDurationMs: [500, 1500],
  },
};

export const DIFFICULTY_NAMES: Record<AIBotDifficulty, string> = {
  1: "🐱 Котёнок",
  2: "🐈 Кот",
  3: "🦁 Лев",
  4: "🐯 Тигр",
};

// ═══════════════════════════════════════════════════════════════════════════
// ПУЛ AI-ИГРОКОВ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Фейковые игроки с реалистичными профилями
 * Используем DiceBear API для генерации аватаров
 * 
 * ВАЖНО: Мужские имена = мужские аватары, женские имена = женские аватары
 * Параметры DiceBear для мужчин: top=ShortHairShortFlat, facialHairType=BeardLight
 * Параметры DiceBear для женщин: top=LongHairStraight, facialHairType=Blank
 */

// Мужские боты — реалистичные имена и username'ы
const MALE_BOTS: Omit<AIBotPlayer, "id">[] = [
  {
    telegramId: "AI_BOT_001",
    username: "artem_2001",
    firstName: "Артём",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=artem_m&top=ShortHairShortFlat&facialHairType=BeardLight&backgroundColor=b6e3f4",
    level: 12,
    xp: 4200,
  },
  {
    telegramId: "AI_BOT_003",
    username: "dimon_nsk",
    firstName: "Дима",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=dmitry_m&top=ShortHairShortWaved&facialHairType=Blank&backgroundColor=c0aede",
    level: 15,
    xp: 6800,
  },
  {
    telegramId: "AI_BOT_005",
    username: "sashka95",
    firstName: "Саша",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex_m&top=ShortHairTheCaesar&facialHairType=MoustacheFancy&backgroundColor=ffdfbf",
    level: 18,
    xp: 9200,
  },
  {
    telegramId: "AI_BOT_007",
    username: "maks_msk",
    firstName: "Макс",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=maxim_m&top=ShortHairDreads01&facialHairType=Blank&backgroundColor=c9e4de",
    level: 22,
    xp: 12500,
  },
  {
    telegramId: "AI_BOT_009",
    username: "vanya_98",
    firstName: "Ваня",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ivan_m&top=ShortHairShortCurly&facialHairType=BeardMedium&backgroundColor=b5d8eb",
    level: 14,
    xp: 5600,
  },
  {
    telegramId: "AI_BOT_011",
    username: "serega_spb",
    firstName: "Серёга",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sergey_m&top=ShortHairShortRound&facialHairType=Blank&backgroundColor=d4e5f7",
    level: 20,
    xp: 10800,
  },
  {
    telegramId: "AI_BOT_013",
    username: "nikitos_03",
    firstName: "Никита",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=nikita_m&top=ShortHairTheCaesarSidePart&facialHairType=Blank&backgroundColor=e8d5b7",
    level: 5,
    xp: 1100,
  },
  {
    telegramId: "AI_BOT_015",
    username: "andrey_kzn",
    firstName: "Андрей",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=andrey_m&top=ShortHairSides&facialHairType=BeardMajestic&backgroundColor=ffd5dc",
    level: 25,
    xp: 15000,
  },
  {
    telegramId: "AI_BOT_017",
    username: "pasha_2000",
    firstName: "Паша",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=pavel_m&top=ShortHairFrizzle&facialHairType=Blank&backgroundColor=d1f4e0",
    level: 8,
    xp: 2300,
  },
  {
    telegramId: "AI_BOT_019",
    username: "kiryuha_99",
    firstName: "Кирилл",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=kirill_m&top=ShortHairShortFlat&facialHairType=MoustacheMagnum&backgroundColor=f0e6ef",
    level: 17,
    xp: 7800,
  },
  {
    telegramId: "AI_BOT_021",
    username: "vladik_ekb",
    firstName: "Влад",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=vlad_m&top=ShortHairDreads02&facialHairType=Blank&backgroundColor=b6e3f4",
    level: 3,
    xp: 600,
  },
  {
    telegramId: "AI_BOT_023",
    username: "roma_97",
    firstName: "Рома",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=roman_m&top=ShortHairShortWaved&facialHairType=BeardLight&backgroundColor=c0aede",
    level: 13,
    xp: 4800,
  },
  {
    telegramId: "AI_BOT_025",
    username: "lexa_nn",
    firstName: "Лёха",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alexey_m&top=ShortHairShortFlat&facialHairType=Blank&backgroundColor=ffdfbf",
    level: 10,
    xp: 3300,
  },
  {
    telegramId: "AI_BOT_027",
    username: "deniska_02",
    firstName: "Денис",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=denis_m&top=ShortHairTheCaesar&facialHairType=BeardLight&backgroundColor=c9e4de",
    level: 7,
    xp: 1900,
  },
  {
    telegramId: "AI_BOT_029",
    username: "egor_vrn",
    firstName: "Егор",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=egor_m&top=ShortHairShortCurly&facialHairType=Blank&backgroundColor=b5d8eb",
    level: 21,
    xp: 11500,
  },
];

// Женские боты — реалистичные имена и username'ы
const FEMALE_BOTS: Omit<AIBotPlayer, "id">[] = [
  {
    telegramId: "AI_BOT_002",
    username: "masha_99",
    firstName: "Маша",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=maria_f&top=LongHairStraight&facialHairType=Blank&backgroundColor=ffd5dc",
    level: 8,
    xp: 2100,
  },
  {
    telegramId: "AI_BOT_004",
    username: "katya_msk",
    firstName: "Катя",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=kate_f&top=LongHairCurly&facialHairType=Blank&backgroundColor=d1f4e0",
    level: 10,
    xp: 3500,
  },
  {
    telegramId: "AI_BOT_006",
    username: "anyuta_01",
    firstName: "Аня",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=anna_f&top=LongHairBob&facialHairType=Blank&backgroundColor=e8d5b7",
    level: 6,
    xp: 1400,
  },
  {
    telegramId: "AI_BOT_008",
    username: "olya_spb",
    firstName: "Оля",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=olga_f&top=LongHairStraight2&facialHairType=Blank&backgroundColor=f9c0c0",
    level: 9,
    xp: 2800,
  },
  {
    telegramId: "AI_BOT_010",
    username: "liza_2000",
    firstName: "Лиза",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisa_f&top=LongHairMiaWallace&facialHairType=Blank&backgroundColor=f0e6ef",
    level: 11,
    xp: 3900,
  },
  {
    telegramId: "AI_BOT_012",
    username: "natasha_nsk",
    firstName: "Наташа",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=natasha_f&top=LongHairCurvy&facialHairType=Blank&backgroundColor=fce4d8",
    level: 7,
    xp: 1800,
  },
  {
    telegramId: "AI_BOT_014",
    username: "dasha_98",
    firstName: "Даша",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=daria_f&top=LongHairBigHair&facialHairType=Blank&backgroundColor=c9e4de",
    level: 16,
    xp: 7200,
  },
  {
    telegramId: "AI_BOT_016",
    username: "polina_kzn",
    firstName: "Полина",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=polina_f&top=LongHairFrida&facialHairType=Blank&backgroundColor=b5d8eb",
    level: 4,
    xp: 900,
  },
  {
    telegramId: "AI_BOT_018",
    username: "alinka_03",
    firstName: "Алина",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alina_f&top=LongHairNotTooLong&facialHairType=Blank&backgroundColor=d4e5f7",
    level: 19,
    xp: 9800,
  },
  {
    telegramId: "AI_BOT_020",
    username: "vika_ekb",
    firstName: "Вика",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=vika_f&top=LongHairStraightStrand&facialHairType=Blank&backgroundColor=ffdfbf",
    level: 23,
    xp: 13500,
  },
  {
    telegramId: "AI_BOT_022",
    username: "sonechka_02",
    firstName: "Соня",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sofia_f&top=LongHairDreads&facialHairType=Blank&backgroundColor=c0aede",
    level: 2,
    xp: 350,
  },
  {
    telegramId: "AI_BOT_024",
    username: "ksusha_nn",
    firstName: "Ксюша",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ksenia_f&top=LongHairFro&facialHairType=Blank&backgroundColor=b6e3f4",
    level: 12,
    xp: 4500,
  },
  {
    telegramId: "AI_BOT_026",
    username: "nastya_vrn",
    firstName: "Настя",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=nastya_f&top=LongHairStraight&facialHairType=Blank&backgroundColor=ffd5dc",
    level: 9,
    xp: 2600,
  },
  {
    telegramId: "AI_BOT_028",
    username: "yulia_97",
    firstName: "Юля",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=yulia_f&top=LongHairCurly&facialHairType=Blank&backgroundColor=d1f4e0",
    level: 15,
    xp: 6400,
  },
  {
    telegramId: "AI_BOT_030",
    username: "kristina_msk",
    firstName: "Кристина",
    photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=kristina_f&top=LongHairBob&facialHairType=Blank&backgroundColor=e8d5b7",
    level: 24,
    xp: 14200,
  },
];

// Объединённый пул ботов
export const AI_PLAYERS_POOL: Omit<AIBotPlayer, "id">[] = [...MALE_BOTS, ...FEMALE_BOTS];

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════

/** Случайное число между min и max */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Задержка */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Выбор случайного элемента из массива */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить или создать AI-игрока в БД
 * Выбирает случайного из пула, подходящего по уровню
 */
export async function getOrCreateAIPlayer(playerLevel: number): Promise<AIBotPlayer> {
  // Фильтруем ботов по уровню (±5 от уровня игрока)
  const suitableBots = AI_PLAYERS_POOL.filter(
    (bot) => Math.abs(bot.level - playerLevel) <= 5
  );

  // Если нет подходящих — берём любого
  const botTemplate = suitableBots.length > 0
    ? randomChoice(suitableBots)
    : randomChoice(AI_PLAYERS_POOL);

  // Проверяем есть ли уже в БД
  let dbBot = await prisma.user.findUnique({
    where: { telegramId: botTemplate.telegramId },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      photoUrl: true,
      xp: true,
    },
  });

  if (!dbBot) {
    // Создаём бота в БД
    dbBot = await prisma.user.create({
      data: {
        telegramId: botTemplate.telegramId,
        username: botTemplate.username,
        firstName: botTemplate.firstName,
        photoUrl: botTemplate.photoUrl,
        xp: botTemplate.xp,
        isBot: true,
        // Скрываем из публичных профилей
        profilePublic: false,
        showActivity: false,
        showOnlineStatus: false,
      },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        photoUrl: true,
        xp: true,
      },
    });
    
    console.log(`[AI Bot] Created new bot in DB: ${dbBot.firstName} (id=${dbBot.id})`);
  }

  return {
    id: dbBot.id,
    telegramId: dbBot.telegramId,
    username: dbBot.username ?? botTemplate.username,
    firstName: dbBot.firstName ?? botTemplate.firstName,
    photoUrl: dbBot.photoUrl ?? botTemplate.photoUrl,
    level: botTemplate.level,
    xp: dbBot.xp,
  };
}

/**
 * Определить сложность AI на основе уровня игрока
 */
export function getDifficultyForPlayer(playerLevel: number): AIBotDifficulty {
  if (playerLevel <= 5) return 1;
  if (playerLevel <= 10) return 2;
  if (playerLevel <= 20) return 3;
  return 4;
}

/**
 * Симулировать человеческую задержку перед ответом
 */
export async function simulateHumanDelay(config: AIBotConfig): Promise<number> {
  // Базовое время "чтения" вопроса
  let totalDelay = randomBetween(config.minResponseMs, config.maxResponseMs);

  // Шанс на AFK (залипание)
  if (Math.random() < config.afkProbability) {
    const afkTime = randomBetween(config.afkDurationMs[0], config.afkDurationMs[1]);
    totalDelay += afkTime;
    console.log(`[AI Bot] AFK pause: +${afkTime}ms`);
  }

  await sleep(totalDelay);
  return totalDelay;
}

/**
 * Выбрать ответ для AI
 * Учитывает вероятность правильного ответа и выбирает "правдоподобные" неправильные
 */
export function selectAIAnswer(
  question: QuestionWithAnswers,
  config: AIBotConfig
): { optionId: number; isCorrect: boolean } {
  const willBeCorrect = Math.random() < config.correctProbability;

  if (willBeCorrect) {
    const correctAnswer = question.answers.find((a) => a.isCorrect);
    if (correctAnswer) {
      return { optionId: correctAnswer.id, isCorrect: true };
    }
  }

  // Выбираем неправильный ответ
  const wrongAnswers = question.answers.filter((a) => !a.isCorrect);
  if (wrongAnswers.length > 0) {
    const selected = randomChoice(wrongAnswers);
    return { optionId: selected.id, isCorrect: false };
  }

  // Fallback: если нет неправильных ответов (не должно случиться)
  const correctAnswer = question.answers.find((a) => a.isCorrect);
  return { optionId: correctAnswer?.id ?? question.answers[0].id, isCorrect: true };
}

/**
 * Записать ответ AI в БД
 */
export async function recordAIAnswer(
  duelId: string,
  botUserId: number,
  questionIndex: number,
  optionId: number,
  isCorrect: boolean,
  timeSpentMs: number
): Promise<void> {
  try {
    // Проверяем не ответили ли уже
    const existing = await prisma.duelAnswer.findUnique({
      where: {
        duelId_userId_questionIndex: {
          duelId,
          userId: botUserId,
          questionIndex,
        },
      },
    });

    if (existing) {
      console.log(`[AI Bot] Answer for Q${questionIndex} already exists, skipping`);
      return;
    }

    await prisma.duelAnswer.create({
      data: {
        duelId,
        userId: botUserId,
        questionIndex,
        optionId,
        isCorrect,
        timeSpentMs,
      },
    });

    console.log(
      `[AI Bot] Recorded answer: Q${questionIndex}, optionId=${optionId}, ` +
      `correct=${isCorrect}, time=${timeSpentMs}ms`
    );
  } catch (error) {
    console.error(`[AI Bot] Failed to record answer for Q${questionIndex}:`, error);
    // Не бросаем ошибку — воркер должен продолжить работу
  }
}

/**
 * Проверить является ли пользователь AI-ботом
 */
export async function isAIPlayer(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBot: true },
  });
  return user?.isBot ?? false;
}

/**
 * Проверить является ли пользователь AI-ботом (синхронно, по telegramId)
 */
export function isAITelegramId(telegramId: string): boolean {
  return telegramId.startsWith("AI_BOT_");
}

// ═══════════════════════════════════════════════════════════════════════════
// AI WORKER — Главная функция для игры AI в дуэли
// ═══════════════════════════════════════════════════════════════════════════

export interface AIWorkerParams {
  duelId: string;
  botUserId: number;
  difficulty: AIBotDifficulty;
  questions: QuestionWithAnswers[];
  questionTimeLimitSeconds: number;
}

// Константы для синхронизации с клиентом
const AI_READY_DELAY_MS = 1500;      // Время пока AI "подключится" и нажмёт "Готов"
const COUNTDOWN_DURATION_MS = 3500;   // 3 секунды countdown + буфер
const REVEAL_DURATION_MS = 2500;      // Время показа правильного ответа

/**
 * Запустить AI-воркер для игры в дуэль
 * 
 * ВАЖНО: Эта функция НЕ блокирует запрос — она запускается асинхронно
 * и отвечает на вопросы с задержками, имитируя реального игрока.
 * 
 * TIMING:
 * - Ждём пока игрок нажмёт "Готов" (~2с после start)
 * - Ждём countdown (3с)
 * - Начинаем отвечать на вопросы
 */
export async function runAIWorker(params: AIWorkerParams): Promise<void> {
  const { duelId, botUserId, difficulty, questions, questionTimeLimitSeconds } = params;
  const config = DIFFICULTY_PRESETS[difficulty];

  console.log(
    `[AI Worker] Starting for duel ${duelId}, bot ${botUserId}, ` +
    `difficulty ${difficulty}, ${questions.length} questions`
  );

  // ═══ КРИТИЧНО: Ждём пока игрок будет готов и пройдёт countdown ═══
  // Lobby (~2с) + Countdown (3с) + небольшой буфер
  const initialDelay = AI_READY_DELAY_MS + COUNTDOWN_DURATION_MS + randomBetween(500, 1000);
  console.log(`[AI Worker] Waiting ${initialDelay}ms for game to start...`);
  await sleep(initialDelay);

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Проверяем не завершена ли уже дуэль
    const duel = await prisma.duel.findUnique({
      where: { id: duelId },
      select: { status: true },
    });

    if (!duel || duel.status === "FINISHED" || duel.status === "CANCELLED") {
      console.log(`[AI Worker] Duel ${duelId} is ${duel?.status}, stopping`);
      break;
    }

    // Симулируем задержку
    const timeSpent = await simulateHumanDelay(config);

    // Проверяем не превысили ли лимит времени
    const effectiveTimeSpent = Math.min(timeSpent, questionTimeLimitSeconds * 1000);

    // Если время вышло — отправляем timeout (null optionId)
    if (timeSpent > questionTimeLimitSeconds * 1000) {
      await recordAIAnswer(duelId, botUserId, i, 0, false, effectiveTimeSpent);
      console.log(`[AI Worker] Q${i} timeout (took ${timeSpent}ms > ${questionTimeLimitSeconds * 1000}ms)`);
      continue;
    }

    // Выбираем и записываем ответ
    const { optionId, isCorrect } = selectAIAnswer(question, config);
    await recordAIAnswer(duelId, botUserId, i, optionId, isCorrect, effectiveTimeSpent);

    // Пауза между вопросами (reveal time на клиенте = 2.5с)
    await sleep(REVEAL_DURATION_MS + randomBetween(200, 500));
  }

  console.log(`[AI Worker] Finished all questions for duel ${duelId}`);
}

