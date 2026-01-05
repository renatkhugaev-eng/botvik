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
  photoUrl: string | null;
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
// Используем стиль "lorelei" для мужских лиц
const MALE_BOTS: Omit<AIBotPlayer, "id">[] = [
  {
    telegramId: "AI_BOT_001",
    username: "artem_2001",
    firstName: "Артём",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=artem2001&backgroundColor=b6e3f4",
    level: 12,
    xp: 4200,
  },
  {
    telegramId: "AI_BOT_003",
    username: "dimon_nsk",
    firstName: "Дима",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=dimon_nsk&backgroundColor=c0aede",
    level: 15,
    xp: 6800,
  },
  {
    telegramId: "AI_BOT_005",
    username: "sashka95",
    firstName: "Саша",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=sashka95m&backgroundColor=ffdfbf",
    level: 18,
    xp: 9200,
  },
  {
    telegramId: "AI_BOT_007",
    username: "maks_msk",
    firstName: "Макс",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=maksim_msk&backgroundColor=c9e4de",
    level: 22,
    xp: 12500,
  },
  {
    telegramId: "AI_BOT_009",
    username: "vanya_98",
    firstName: "Ваня",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=vanya98m&backgroundColor=b5d8eb",
    level: 14,
    xp: 5600,
  },
  {
    telegramId: "AI_BOT_011",
    username: "serega_spb",
    firstName: "Серёга",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=serega_spb&backgroundColor=d4e5f7",
    level: 20,
    xp: 10800,
  },
  {
    telegramId: "AI_BOT_013",
    username: "nikitos_03",
    firstName: "Никита",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=nikitos03&backgroundColor=e8d5b7",
    level: 5,
    xp: 1100,
  },
  {
    telegramId: "AI_BOT_015",
    username: "andrey_kzn",
    firstName: "Андрей",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=andrey_kzn&backgroundColor=ffd5dc",
    level: 25,
    xp: 15000,
  },
  {
    telegramId: "AI_BOT_017",
    username: "pasha_2000",
    firstName: "Паша",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=pasha2000&backgroundColor=d1f4e0",
    level: 8,
    xp: 2300,
  },
  {
    telegramId: "AI_BOT_019",
    username: "kiryuha_99",
    firstName: "Кирилл",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=kiryuha99&backgroundColor=f0e6ef",
    level: 17,
    xp: 7800,
  },
  {
    telegramId: "AI_BOT_021",
    username: "vladik_ekb",
    firstName: "Влад",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=vladik_ekb&backgroundColor=b6e3f4",
    level: 3,
    xp: 600,
  },
  {
    telegramId: "AI_BOT_023",
    username: "roma_97",
    firstName: "Рома",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=roma97m&backgroundColor=c0aede",
    level: 13,
    xp: 4800,
  },
  {
    telegramId: "AI_BOT_025",
    username: "lexa_nn",
    firstName: "Лёха",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=lexa_nn&backgroundColor=ffdfbf",
    level: 10,
    xp: 3300,
  },
  {
    telegramId: "AI_BOT_027",
    username: "deniska_02",
    firstName: "Денис",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=deniska02&backgroundColor=c9e4de",
    level: 7,
    xp: 1900,
  },
  {
    telegramId: "AI_BOT_029",
    username: "egor_vrn",
    firstName: "Егор",
    photoUrl: "https://api.dicebear.com/7.x/lorelei/svg?seed=egor_vrn&backgroundColor=b5d8eb",
    level: 21,
    xp: 11500,
  },
];

// Женские боты — реалистичные имена и username'ы
// Используем стиль "notionists" для женских лиц (более мягкие черты)
const FEMALE_BOTS: Omit<AIBotPlayer, "id">[] = [
  {
    telegramId: "AI_BOT_002",
    username: "masha_99",
    firstName: "Маша",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=masha99&backgroundColor=ffd5dc",
    level: 8,
    xp: 2100,
  },
  {
    telegramId: "AI_BOT_004",
    username: "katya_msk",
    firstName: "Катя",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=katya_msk&backgroundColor=d1f4e0",
    level: 10,
    xp: 3500,
  },
  {
    telegramId: "AI_BOT_006",
    username: "anyuta_01",
    firstName: "Аня",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=anyuta01&backgroundColor=e8d5b7",
    level: 6,
    xp: 1400,
  },
  {
    telegramId: "AI_BOT_008",
    username: "olya_spb",
    firstName: "Оля",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=olya_spb&backgroundColor=f9c0c0",
    level: 9,
    xp: 2800,
  },
  {
    telegramId: "AI_BOT_010",
    username: "liza_2000",
    firstName: "Лиза",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=liza2000&backgroundColor=f0e6ef",
    level: 11,
    xp: 3900,
  },
  {
    telegramId: "AI_BOT_012",
    username: "natasha_nsk",
    firstName: "Наташа",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=natasha_nsk&backgroundColor=fce4d8",
    level: 7,
    xp: 1800,
  },
  {
    telegramId: "AI_BOT_014",
    username: "dasha_98",
    firstName: "Даша",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=dasha98&backgroundColor=c9e4de",
    level: 16,
    xp: 7200,
  },
  {
    telegramId: "AI_BOT_016",
    username: "polina_kzn",
    firstName: "Полина",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=polina_kzn&backgroundColor=b5d8eb",
    level: 4,
    xp: 900,
  },
  {
    telegramId: "AI_BOT_018",
    username: "alinka_03",
    firstName: "Алина",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=alinka03&backgroundColor=d4e5f7",
    level: 19,
    xp: 9800,
  },
  {
    telegramId: "AI_BOT_020",
    username: "vika_ekb",
    firstName: "Вика",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=vika_ekb&backgroundColor=ffdfbf",
    level: 23,
    xp: 13500,
  },
  {
    telegramId: "AI_BOT_022",
    username: "sonechka_02",
    firstName: "Соня",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=sonechka02&backgroundColor=c0aede",
    level: 2,
    xp: 350,
  },
  {
    telegramId: "AI_BOT_024",
    username: "ksusha_nn",
    firstName: "Ксюша",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=ksusha_nn&backgroundColor=b6e3f4",
    level: 12,
    xp: 4500,
  },
  {
    telegramId: "AI_BOT_026",
    username: "nastya_vrn",
    firstName: "Настя",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=nastya_vrn&backgroundColor=ffd5dc",
    level: 9,
    xp: 2600,
  },
  {
    telegramId: "AI_BOT_028",
    username: "yulia_97",
    firstName: "Юля",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=yulia97&backgroundColor=d1f4e0",
    level: 15,
    xp: 6400,
  },
  {
    telegramId: "AI_BOT_030",
    username: "kristina_msk",
    firstName: "Кристина",
    photoUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=kristina_msk&backgroundColor=e8d5b7",
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
  humanUserId: number; // ID реального игрока для синхронизации
  difficulty: AIBotDifficulty;
  questions: QuestionWithAnswers[];
  questionTimeLimitSeconds: number;
}

// Константы для синхронизации с клиентом
const AI_READY_DELAY_MS = 1500;      // Время пока AI "подключится" и нажмёт "Готов"
const COUNTDOWN_DURATION_MS = 3500;   // 3 секунды countdown + буфер
const REVEAL_DURATION_MS = 2500;      // Время показа правильного ответа
const POLL_INTERVAL_MS = 300;         // Интервал проверки ответа игрока
const MAX_WAIT_FOR_PLAYER_MS = 60000; // Максимальное ожидание ответа игрока (60с)

/**
 * Ждать пока реальный игрок ответит на вопрос
 * Возвращает true если игрок ответил, false если timeout или дуэль завершена
 */
async function waitForPlayerAnswer(
  duelId: string,
  humanUserId: number,
  questionIndex: number,
  maxWaitMs: number = MAX_WAIT_FOR_PLAYER_MS
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    // Проверяем не завершена ли дуэль
    const duel = await prisma.duel.findUnique({
      where: { id: duelId },
      select: { status: true },
    });
    
    if (!duel || duel.status === "FINISHED" || duel.status === "CANCELLED") {
      console.log(`[AI Worker] Duel ${duelId} ended while waiting for player`);
      return false;
    }
    
    // Проверяем есть ли ответ игрока на этот вопрос
    const playerAnswer = await prisma.duelAnswer.findUnique({
      where: {
        duelId_userId_questionIndex: {
          duelId,
          userId: humanUserId,
          questionIndex,
        },
      },
    });
    
    if (playerAnswer) {
      console.log(`[AI Worker] Player answered Q${questionIndex}, now AI will respond`);
      return true;
    }
    
    await sleep(POLL_INTERVAL_MS);
  }
  
  console.log(`[AI Worker] Timeout waiting for player on Q${questionIndex}`);
  return false;
}

/**
 * Запустить AI-воркер для игры в дуэль
 * 
 * РЕАЛИСТИЧНОЕ ПОВЕДЕНИЕ:
 * - С вероятностью 40% AI ждёт пока игрок ответит, потом отвечает (медленнее игрока)
 * - С вероятностью 60% AI отвечает по своему таймеру (может быть быстрее игрока)
 * - Задержки варьируются от 2 до 12 секунд в зависимости от сложности
 * 
 * Это создаёт непредсказуемое поведение, похожее на реального человека.
 */
export async function runAIWorker(params: AIWorkerParams): Promise<void> {
  const { duelId, botUserId, humanUserId, difficulty, questions, questionTimeLimitSeconds } = params;
  const config = DIFFICULTY_PRESETS[difficulty];

  console.log(
    `[AI Worker] Starting for duel ${duelId}, bot ${botUserId}, human ${humanUserId}, ` +
    `difficulty ${difficulty}, ${questions.length} questions`
  );

  // ═══ КРИТИЧНО: Ждём пока игрок будет готов и пройдёт countdown ═══
  // Lobby (~2с) + Countdown (3с) + небольшой буфер
  const initialDelay = AI_READY_DELAY_MS + COUNTDOWN_DURATION_MS + randomBetween(500, 1000);
  console.log(`[AI Worker] Waiting ${initialDelay}ms for game to start...`);
  await sleep(initialDelay);

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionStartTime = Date.now();

    // Проверяем не завершена ли уже дуэль
    const duel = await prisma.duel.findUnique({
      where: { id: duelId },
      select: { status: true },
    });

    if (!duel || duel.status === "FINISHED" || duel.status === "CANCELLED") {
      console.log(`[AI Worker] Duel ${duelId} is ${duel?.status}, stopping`);
      break;
    }

    // ═══ СТРАТЕГИЯ ОТВЕТА ═══
    // С вероятностью 40% ждём пока игрок ответит (AI медленнее)
    // С вероятностью 60% отвечаем по своему таймеру (AI может быть быстрее)
    const waitForPlayer = Math.random() < 0.4;
    
    // Время "раздумий" AI для этого вопроса
    let thinkTimeMs = randomBetween(config.minResponseMs, config.maxResponseMs);
    
    // Добавляем шанс AFK (залипание)
    if (Math.random() < config.afkProbability) {
      const afkTime = randomBetween(config.afkDurationMs[0], config.afkDurationMs[1]);
      thinkTimeMs += afkTime;
      console.log(`[AI Worker] Q${i} AFK pause: +${afkTime}ms`);
    }
    
    if (waitForPlayer) {
      // Стратегия: ждём игрока, потом быстро отвечаем
      console.log(`[AI Worker] Q${i} waiting for player first...`);
      
      const playerAnswered = await waitForPlayerAnswer(
        duelId, 
        humanUserId, 
        i, 
        questionTimeLimitSeconds * 1000
      );
      
      if (!playerAnswered) {
        // Дуэль завершена или таймаут — выходим
        break;
      }
      
      // Игрок ответил — добавляем короткую задержку и отвечаем
      const reactionTime = randomBetween(800, 2500);
      console.log(`[AI Worker] Q${i} player answered, AI responding in ${reactionTime}ms`);
      await sleep(reactionTime);
      thinkTimeMs = reactionTime; // Для записи в БД
      
    } else {
      // Стратегия: отвечаем по своему таймеру
      console.log(`[AI Worker] Q${i} thinking for ${thinkTimeMs}ms...`);
      await sleep(thinkTimeMs);
    }
    
    // Проверяем лимит времени на вопрос
    const elapsedMs = Date.now() - questionStartTime;
    const questionTimeoutMs = questionTimeLimitSeconds * 1000;
    
    if (elapsedMs >= questionTimeoutMs) {
      // Время вышло — AI не успел ответить
      console.log(`[AI Worker] Q${i} timeout (${elapsedMs}ms >= ${questionTimeoutMs}ms)`);
      // Ждём reveal и переход к следующему вопросу
      await sleep(REVEAL_DURATION_MS + randomBetween(200, 500));
      continue;
    }
    
    // Проверяем не завершена ли дуэль после ожидания
    const duelCheck = await prisma.duel.findUnique({
      where: { id: duelId },
      select: { status: true },
    });
    
    if (!duelCheck || duelCheck.status === "FINISHED" || duelCheck.status === "CANCELLED") {
      console.log(`[AI Worker] Duel ${duelId} ended, stopping`);
      break;
    }
    
    // Выбираем и записываем ответ
    const { optionId, isCorrect } = selectAIAnswer(question, config);
    await recordAIAnswer(duelId, botUserId, i, optionId, isCorrect, Math.round(thinkTimeMs));
    
    console.log(`[AI Worker] Q${i} answered: optionId=${optionId}, correct=${isCorrect}`);

    // ═══ ЖДЁМ ПОКА ИГРОК ТОЖЕ ОТВЕТИТ (если ещё не ответил) ═══
    // Это нужно для синхронизации с reveal периодом
    await waitForPlayerAnswer(duelId, humanUserId, i, 30000);

    // Пауза между вопросами (reveal time на клиенте = 2.5с)
    await sleep(REVEAL_DURATION_MS + randomBetween(200, 500));
  }

  console.log(`[AI Worker] Finished all questions for duel ${duelId}`);
}

