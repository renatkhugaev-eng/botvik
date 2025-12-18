/**
 * Achievements System
 * 
 * 100 достижений, привязанных к реальным данным приложения
 * Категории:
 * - BEGINNER: Первые шаги
 * - QUIZ: Достижения в квизах
 * - STREAK: Серии и регулярность
 * - SOCIAL: Социальные достижения
 * - SCORE: Очки и рекорды
 * - SPEED: Скорость ответов
 * - MASTERY: Мастерство
 * - SPECIAL: Особые достижения
 * - COLLECTOR: Коллекционирование
 * - VETERAN: Для опытных игроков
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AchievementCategory = 
  | "beginner"
  | "quiz" 
  | "streak" 
  | "social" 
  | "score" 
  | "speed" 
  | "mastery" 
  | "special" 
  | "collector"
  | "veteran";

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  xpReward: number;
  // Условие для разблокировки (для отображения прогресса)
  requirement: {
    type: AchievementRequirementType;
    value: number;
  };
  // Секретные достижения не показывают описание до разблокировки
  secret?: boolean;
};

export type AchievementRequirementType =
  | "quizzes_played"           // Сыграно квизов
  | "quizzes_completed"        // Завершено квизов
  | "correct_answers"          // Правильных ответов
  | "total_score"              // Всего очков
  | "best_score"               // Лучший результат за игру
  | "perfect_games"            // Идеальных игр (100%)
  | "daily_streak"             // Серия daily rewards
  | "quiz_streak"              // Серия правильных ответов
  | "friends_count"            // Количество друзей
  | "chat_messages"            // Сообщений в чате
  | "level"                    // Уровень игрока
  | "xp"                       // Общий XP
  | "fast_answers"             // Быстрых ответов (< 3 сек)
  | "weekly_top"               // Попаданий в топ недели
  | "weekly_wins"              // Побед в недельном соревновании
  | "bonus_energy_earned"      // Заработано бонусной энергии
  | "bonus_energy_used"        // Использовано бонусной энергии
  | "different_quizzes"        // Разных квизов сыграно
  | "login_days"               // Дней захода в приложение
  | "referrals_count"          // Количество приглашённых друзей
  | "special";                 // Особое условие (проверяется кодом)

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY INFO
// ═══════════════════════════════════════════════════════════════════════════

export const CATEGORY_INFO: Record<AchievementCategory, { name: string; icon: string; color: string }> = {
  beginner: { name: "Первые шаги", icon: "🌱", color: "#22c55e" },
  quiz: { name: "Квизы", icon: "🎯", color: "#3b82f6" },
  streak: { name: "Серии", icon: "🔥", color: "#f97316" },
  social: { name: "Социальные", icon: "👥", color: "#8b5cf6" },
  score: { name: "Рекорды", icon: "🏆", color: "#eab308" },
  speed: { name: "Скорость", icon: "⚡", color: "#06b6d4" },
  mastery: { name: "Мастерство", icon: "🎓", color: "#ec4899" },
  special: { name: "Особые", icon: "✨", color: "#f43f5e" },
  collector: { name: "Коллекция", icon: "📦", color: "#84cc16" },
  veteran: { name: "Ветеран", icon: "🎖️", color: "#a855f7" },
};

export const RARITY_INFO: Record<AchievementRarity, { name: string; color: string; glow: string }> = {
  common: { name: "Обычное", color: "#9ca3af", glow: "shadow-gray-400/30" },
  uncommon: { name: "Необычное", color: "#22c55e", glow: "shadow-green-500/30" },
  rare: { name: "Редкое", color: "#3b82f6", glow: "shadow-blue-500/30" },
  epic: { name: "Эпическое", color: "#a855f7", glow: "shadow-purple-500/30" },
  legendary: { name: "Легендарное", color: "#f59e0b", glow: "shadow-amber-500/30" },
};

// ═══════════════════════════════════════════════════════════════════════════
// ALL ACHIEVEMENTS (100 штук)
// ═══════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS: Achievement[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // BEGINNER — Первые шаги (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "first_quiz",
    name: "Первый шаг",
    description: "Сыграй свой первый квиз",
    icon: "🎮",
    category: "beginner",
    rarity: "common",
    xpReward: 10,
    requirement: { type: "quizzes_played", value: 1 },
  },
  {
    id: "first_correct",
    name: "Правильный ответ",
    description: "Ответь правильно на первый вопрос",
    icon: "✅",
    category: "beginner",
    rarity: "common",
    xpReward: 5,
    requirement: { type: "correct_answers", value: 1 },
  },
  {
    id: "first_complete",
    name: "Финишер",
    description: "Заверши свой первый квиз до конца",
    icon: "🏁",
    category: "beginner",
    rarity: "common",
    xpReward: 15,
    requirement: { type: "quizzes_completed", value: 1 },
  },
  {
    id: "first_friend",
    name: "Компания",
    description: "Добавь первого друга",
    icon: "🤝",
    category: "beginner",
    rarity: "common",
    xpReward: 20,
    requirement: { type: "friends_count", value: 1 },
  },
  {
    id: "first_message",
    name: "Голос",
    description: "Напиши первое сообщение в чат",
    icon: "💬",
    category: "beginner",
    rarity: "common",
    xpReward: 10,
    requirement: { type: "chat_messages", value: 1 },
  },
  {
    id: "first_daily",
    name: "Ежедневник",
    description: "Забери первую ежедневную награду",
    icon: "🎁",
    category: "beginner",
    rarity: "common",
    xpReward: 10,
    requirement: { type: "daily_streak", value: 1 },
  },
  {
    id: "level_2",
    name: "Уровень 2",
    description: "Достигни 2 уровня",
    icon: "⬆️",
    category: "beginner",
    rarity: "common",
    xpReward: 15,
    requirement: { type: "level", value: 2 },
  },
  {
    id: "score_100",
    name: "Первая сотня",
    description: "Набери 100 очков за игру",
    icon: "💯",
    category: "beginner",
    rarity: "common",
    xpReward: 20,
    requirement: { type: "best_score", value: 100 },
  },
  {
    id: "five_correct",
    name: "Пятёрочка",
    description: "Ответь правильно на 5 вопросов",
    icon: "🖐️",
    category: "beginner",
    rarity: "common",
    xpReward: 15,
    requirement: { type: "correct_answers", value: 5 },
  },
  {
    id: "three_quizzes",
    name: "Вошёл во вкус",
    description: "Сыграй 3 квиза",
    icon: "🎲",
    category: "beginner",
    rarity: "common",
    xpReward: 25,
    requirement: { type: "quizzes_played", value: 3 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ — Достижения в квизах (15)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "quizzes_10",
    name: "Игрок",
    description: "Сыграй 10 квизов",
    icon: "🎮",
    category: "quiz",
    rarity: "common",
    xpReward: 30,
    requirement: { type: "quizzes_played", value: 10 },
  },
  {
    id: "quizzes_25",
    name: "Любитель",
    description: "Сыграй 25 квизов",
    icon: "🎯",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "quizzes_played", value: 25 },
  },
  {
    id: "quizzes_50",
    name: "Энтузиаст",
    description: "Сыграй 50 квизов",
    icon: "🔥",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "quizzes_played", value: 50 },
  },
  {
    id: "quizzes_100",
    name: "Профи",
    description: "Сыграй 100 квизов",
    icon: "💪",
    category: "quiz",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "quizzes_played", value: 100 },
  },
  {
    id: "quizzes_250",
    name: "Мастер",
    description: "Сыграй 250 квизов",
    icon: "🎓",
    category: "quiz",
    rarity: "epic",
    xpReward: 200,
    requirement: { type: "quizzes_played", value: 250 },
  },
  {
    id: "quizzes_500",
    name: "Гроссмейстер",
    description: "Сыграй 500 квизов",
    icon: "👑",
    category: "quiz",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "quizzes_played", value: 500 },
  },
  {
    id: "completed_10",
    name: "Завершитель",
    description: "Заверши 10 квизов",
    icon: "🏁",
    category: "quiz",
    rarity: "common",
    xpReward: 30,
    requirement: { type: "quizzes_completed", value: 10 },
  },
  {
    id: "completed_50",
    name: "Настойчивый",
    description: "Заверши 50 квизов",
    icon: "🎯",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "quizzes_completed", value: 50 },
  },
  {
    id: "completed_100",
    name: "Неутомимый",
    description: "Заверши 100 квизов",
    icon: "🏆",
    category: "quiz",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "quizzes_completed", value: 100 },
  },
  {
    id: "correct_50",
    name: "Знаток",
    description: "Ответь правильно на 50 вопросов",
    icon: "🧠",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "correct_answers", value: 50 },
  },
  {
    id: "correct_100",
    name: "Эрудит",
    description: "Ответь правильно на 100 вопросов",
    icon: "📚",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "correct_answers", value: 100 },
  },
  {
    id: "correct_250",
    name: "Мудрец",
    description: "Ответь правильно на 250 вопросов",
    icon: "🦉",
    category: "quiz",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "correct_answers", value: 250 },
  },
  {
    id: "correct_500",
    name: "Гуру",
    description: "Ответь правильно на 500 вопросов",
    icon: "🧙",
    category: "quiz",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "correct_answers", value: 500 },
  },
  {
    id: "correct_1000",
    name: "Оракул",
    description: "Ответь правильно на 1000 вопросов",
    icon: "🔮",
    category: "quiz",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "correct_answers", value: 1000 },
  },
  {
    id: "different_quizzes_5",
    name: "Разнообразие",
    description: "Сыграй 5 разных квизов",
    icon: "🎨",
    category: "quiz",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "different_quizzes", value: 5 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STREAK — Серии и регулярность (12)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "streak_3",
    name: "Три дня",
    description: "Заходи 3 дня подряд",
    icon: "🔥",
    category: "streak",
    rarity: "common",
    xpReward: 30,
    requirement: { type: "daily_streak", value: 3 },
  },
  {
    id: "streak_7",
    name: "Неделя",
    description: "Заходи 7 дней подряд",
    icon: "📅",
    category: "streak",
    rarity: "uncommon",
    xpReward: 70,
    requirement: { type: "daily_streak", value: 7 },
  },
  {
    id: "streak_14",
    name: "Две недели",
    description: "Заходи 14 дней подряд",
    icon: "💪",
    category: "streak",
    rarity: "rare",
    xpReward: 140,
    requirement: { type: "daily_streak", value: 14 },
  },
  {
    id: "streak_30",
    name: "Месяц",
    description: "Заходи 30 дней подряд",
    icon: "🗓️",
    category: "streak",
    rarity: "epic",
    xpReward: 300,
    requirement: { type: "daily_streak", value: 30 },
  },
  {
    id: "streak_60",
    name: "Два месяца",
    description: "Заходи 60 дней подряд",
    icon: "🏅",
    category: "streak",
    rarity: "epic",
    xpReward: 500,
    requirement: { type: "daily_streak", value: 60 },
  },
  {
    id: "streak_100",
    name: "Сотня дней",
    description: "Заходи 100 дней подряд",
    icon: "💯",
    category: "streak",
    rarity: "legendary",
    xpReward: 1000,
    requirement: { type: "daily_streak", value: 100 },
  },
  {
    id: "quiz_streak_5",
    name: "Серия 5",
    description: "5 правильных ответов подряд",
    icon: "5️⃣",
    category: "streak",
    rarity: "common",
    xpReward: 25,
    requirement: { type: "quiz_streak", value: 5 },
  },
  {
    id: "quiz_streak_10",
    name: "Серия 10",
    description: "10 правильных ответов подряд",
    icon: "🔟",
    category: "streak",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "quiz_streak", value: 10 },
  },
  {
    id: "quiz_streak_15",
    name: "Серия 15",
    description: "15 правильных ответов подряд",
    icon: "🔥",
    category: "streak",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "quiz_streak", value: 15 },
  },
  {
    id: "quiz_streak_20",
    name: "Серия 20",
    description: "20 правильных ответов подряд",
    icon: "💥",
    category: "streak",
    rarity: "epic",
    xpReward: 200,
    requirement: { type: "quiz_streak", value: 20 },
  },
  {
    id: "quiz_streak_25",
    name: "Непобедимый",
    description: "25 правильных ответов подряд",
    icon: "⚡",
    category: "streak",
    rarity: "legendary",
    xpReward: 400,
    requirement: { type: "quiz_streak", value: 25 },
  },
  {
    id: "login_days_30",
    name: "Постоянный гость",
    description: "Заходи в приложение 30 разных дней",
    icon: "🏠",
    category: "streak",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "login_days", value: 30 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL — Социальные достижения (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "friends_5",
    name: "Маленькая компания",
    description: "Добавь 5 друзей",
    icon: "👥",
    category: "social",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "friends_count", value: 5 },
  },
  {
    id: "friends_10",
    name: "Популярный",
    description: "Добавь 10 друзей",
    icon: "🎉",
    category: "social",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "friends_count", value: 10 },
  },
  {
    id: "friends_25",
    name: "Звезда",
    description: "Добавь 25 друзей",
    icon: "⭐",
    category: "social",
    rarity: "epic",
    xpReward: 200,
    requirement: { type: "friends_count", value: 25 },
  },
  {
    id: "friends_50",
    name: "Суперзвезда",
    description: "Добавь 50 друзей",
    icon: "🌟",
    category: "social",
    rarity: "legendary",
    xpReward: 400,
    requirement: { type: "friends_count", value: 50 },
  },
  {
    id: "chat_10",
    name: "Общительный",
    description: "Отправь 10 сообщений в чат",
    icon: "💬",
    category: "social",
    rarity: "common",
    xpReward: 25,
    requirement: { type: "chat_messages", value: 10 },
  },
  {
    id: "chat_50",
    name: "Болтун",
    description: "Отправь 50 сообщений в чат",
    icon: "🗣️",
    category: "social",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "chat_messages", value: 50 },
  },
  {
    id: "chat_100",
    name: "Душа компании",
    description: "Отправь 100 сообщений в чат",
    icon: "🎭",
    category: "social",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "chat_messages", value: 100 },
  },
  {
    id: "chat_500",
    name: "Легенда чата",
    description: "Отправь 500 сообщений в чат",
    icon: "👑",
    category: "social",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "chat_messages", value: 500 },
  },
  {
    id: "weekly_participant",
    name: "Участник",
    description: "Попади в топ-10 недельного рейтинга",
    icon: "📊",
    category: "social",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "weekly_top", value: 1 },
  },
  {
    id: "weekly_winner",
    name: "Чемпион недели",
    description: "Выиграй недельное соревнование",
    icon: "🏆",
    category: "social",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "weekly_wins", value: 1 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE — Очки и рекорды (12)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "score_250",
    name: "250 очков",
    description: "Набери 250 очков за одну игру",
    icon: "🎯",
    category: "score",
    rarity: "common",
    xpReward: 30,
    requirement: { type: "best_score", value: 250 },
  },
  {
    id: "score_500",
    name: "500 очков",
    description: "Набери 500 очков за одну игру",
    icon: "🔥",
    category: "score",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "best_score", value: 500 },
  },
  {
    id: "score_750",
    name: "750 очков",
    description: "Набери 750 очков за одну игру",
    icon: "💪",
    category: "score",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "best_score", value: 750 },
  },
  {
    id: "score_1000",
    name: "Тысяча",
    description: "Набери 1000 очков за одну игру",
    icon: "🏆",
    category: "score",
    rarity: "epic",
    xpReward: 200,
    requirement: { type: "best_score", value: 1000 },
  },
  {
    id: "score_1500",
    name: "Полторы тысячи",
    description: "Набери 1500 очков за одну игру",
    icon: "👑",
    category: "score",
    rarity: "legendary",
    xpReward: 400,
    requirement: { type: "best_score", value: 1500 },
  },
  {
    id: "total_1000",
    name: "Начинающий",
    description: "Набери 1000 очков всего",
    icon: "📈",
    category: "score",
    rarity: "common",
    xpReward: 25,
    requirement: { type: "total_score", value: 1000 },
  },
  {
    id: "total_5000",
    name: "Развивающийся",
    description: "Набери 5000 очков всего",
    icon: "📊",
    category: "score",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "total_score", value: 5000 },
  },
  {
    id: "total_10000",
    name: "Опытный",
    description: "Набери 10000 очков всего",
    icon: "🎯",
    category: "score",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "total_score", value: 10000 },
  },
  {
    id: "total_25000",
    name: "Эксперт",
    description: "Набери 25000 очков всего",
    icon: "💎",
    category: "score",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "total_score", value: 25000 },
  },
  {
    id: "total_50000",
    name: "Мастер очков",
    description: "Набери 50000 очков всего",
    icon: "🏅",
    category: "score",
    rarity: "epic",
    xpReward: 400,
    requirement: { type: "total_score", value: 50000 },
  },
  {
    id: "total_100000",
    name: "Легенда",
    description: "Набери 100000 очков всего",
    icon: "👑",
    category: "score",
    rarity: "legendary",
    xpReward: 1000,
    requirement: { type: "total_score", value: 100000 },
  },
  {
    id: "perfect_game",
    name: "Перфекционист",
    description: "Заверши квиз с идеальным результатом",
    icon: "💯",
    category: "score",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "perfect_games", value: 1 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEED — Скорость ответов (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fast_1",
    name: "Быстрый ум",
    description: "Ответь правильно менее чем за 3 секунды",
    icon: "⚡",
    category: "speed",
    rarity: "common",
    xpReward: 20,
    requirement: { type: "fast_answers", value: 1 },
  },
  {
    id: "fast_10",
    name: "Молния",
    description: "10 быстрых правильных ответов",
    icon: "🌩️",
    category: "speed",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "fast_answers", value: 10 },
  },
  {
    id: "fast_25",
    name: "Скоростной",
    description: "25 быстрых правильных ответов",
    icon: "🚀",
    category: "speed",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "fast_answers", value: 25 },
  },
  {
    id: "fast_50",
    name: "Сверхскорость",
    description: "50 быстрых правильных ответов",
    icon: "💨",
    category: "speed",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "fast_answers", value: 50 },
  },
  {
    id: "fast_100",
    name: "Флеш",
    description: "100 быстрых правильных ответов",
    icon: "⚡",
    category: "speed",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "fast_answers", value: 100 },
  },
  {
    id: "fast_250",
    name: "Квикмастер",
    description: "250 быстрых правильных ответов",
    icon: "🏎️",
    category: "speed",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "fast_answers", value: 250 },
  },
  {
    id: "fast_500",
    name: "Скорость света",
    description: "500 быстрых правильных ответов",
    icon: "✨",
    category: "speed",
    rarity: "epic",
    xpReward: 400,
    requirement: { type: "fast_answers", value: 500 },
  },
  {
    id: "fast_1000",
    name: "Мгновение",
    description: "1000 быстрых правильных ответов",
    icon: "🌟",
    category: "speed",
    rarity: "legendary",
    xpReward: 750,
    requirement: { type: "fast_answers", value: 1000 },
  },
  {
    id: "speed_demon",
    name: "Демон скорости",
    description: "Ответь на все вопросы квиза менее чем за 3 сек каждый",
    icon: "👹",
    category: "speed",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "instant_answer",
    name: "Мгновенный ответ",
    description: "Ответь правильно менее чем за 1 секунду",
    icon: "⏱️",
    category: "speed",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "special", value: 1 },
    secret: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTERY — Мастерство (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "perfect_3",
    name: "Три подряд",
    description: "3 идеальные игры",
    icon: "🎯",
    category: "mastery",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "perfect_games", value: 3 },
  },
  {
    id: "perfect_5",
    name: "Пять звёзд",
    description: "5 идеальных игр",
    icon: "⭐",
    category: "mastery",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "perfect_games", value: 5 },
  },
  {
    id: "perfect_10",
    name: "Десятка",
    description: "10 идеальных игр",
    icon: "🌟",
    category: "mastery",
    rarity: "epic",
    xpReward: 400,
    requirement: { type: "perfect_games", value: 10 },
  },
  {
    id: "perfect_25",
    name: "Мастер совершенства",
    description: "25 идеальных игр",
    icon: "💎",
    category: "mastery",
    rarity: "legendary",
    xpReward: 750,
    requirement: { type: "perfect_games", value: 25 },
  },
  {
    id: "level_5",
    name: "Уровень 5",
    description: "Достигни 5 уровня",
    icon: "📈",
    category: "mastery",
    rarity: "common",
    xpReward: 30,
    requirement: { type: "level", value: 5 },
  },
  {
    id: "level_10",
    name: "Уровень 10",
    description: "Достигни 10 уровня",
    icon: "🔟",
    category: "mastery",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "level", value: 10 },
  },
  {
    id: "level_20",
    name: "Уровень 20",
    description: "Достигни 20 уровня",
    icon: "💪",
    category: "mastery",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "level", value: 20 },
  },
  {
    id: "level_30",
    name: "Уровень 30",
    description: "Достигни 30 уровня",
    icon: "🏆",
    category: "mastery",
    rarity: "epic",
    xpReward: 300,
    requirement: { type: "level", value: 30 },
  },
  {
    id: "level_50",
    name: "Уровень 50",
    description: "Достигни 50 уровня",
    icon: "👑",
    category: "mastery",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "level", value: 50 },
  },
  {
    id: "xp_10000",
    name: "XP-миллионер",
    description: "Набери 10000 XP",
    icon: "💰",
    category: "mastery",
    rarity: "epic",
    xpReward: 250,
    requirement: { type: "xp", value: 10000 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIAL — Особые достижения (11)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "night_owl",
    name: "Полуночник",
    description: "Сыграй квиз после полуночи (00:00-04:00 MSK)",
    icon: "🦉",
    category: "special",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "early_bird",
    name: "Ранняя пташка",
    description: "Сыграй квиз рано утром (05:00-07:00 MSK)",
    icon: "🐦",
    category: "special",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "weekend_warrior",
    name: "Воин выходного дня",
    description: "Сыграй 10 квизов за один выходной",
    icon: "🗡️",
    category: "special",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "comeback",
    name: "Возвращение",
    description: "Вернись после 7+ дней отсутствия",
    icon: "🔄",
    category: "special",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "underdog",
    name: "Андердог",
    description: "Выиграй с минимальным отрывом",
    icon: "🐕",
    category: "special",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "bonus_energy_5",
    name: "Энергетик",
    description: "Накопи 5 бонусной энергии",
    icon: "🔋",
    category: "special",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "bonus_energy_earned", value: 5 },
  },
  {
    id: "bonus_energy_10",
    name: "Аккумулятор",
    description: "Накопи 10 бонусной энергии",
    icon: "⚡",
    category: "special",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "bonus_energy_earned", value: 10 },
  },
  {
    id: "bonus_used_5",
    name: "Экономный",
    description: "Используй 5 бонусной энергии",
    icon: "💡",
    category: "special",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "bonus_energy_used", value: 5 },
  },
  {
    id: "new_year",
    name: "С Новым годом!",
    description: "Сыграй квиз в новогоднюю ночь",
    icon: "🎄",
    category: "special",
    rarity: "legendary",
    xpReward: 300,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "birthday",
    name: "День рождения",
    description: "Секретное достижение",
    icon: "🎂",
    category: "special",
    rarity: "legendary",
    xpReward: 200,
    requirement: { type: "special", value: 1 },
    secret: true,
  },
  {
    id: "all_achievements",
    name: "Коллекционер достижений",
    description: "Разблокируй все достижения",
    icon: "🏅",
    category: "special",
    rarity: "legendary",
    xpReward: 2000,
    requirement: { type: "special", value: 1 },
    secret: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLECTOR — Коллекционирование (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "achievements_10",
    name: "Первый сбор",
    description: "Разблокируй 10 достижений",
    icon: "📦",
    category: "collector",
    rarity: "common",
    xpReward: 50,
    requirement: { type: "special", value: 10 },
  },
  {
    id: "achievements_25",
    name: "Коллекционер",
    description: "Разблокируй 25 достижений",
    icon: "🎒",
    category: "collector",
    rarity: "uncommon",
    xpReward: 100,
    requirement: { type: "special", value: 25 },
  },
  {
    id: "achievements_50",
    name: "Собиратель",
    description: "Разблокируй 50 достижений",
    icon: "🗃️",
    category: "collector",
    rarity: "rare",
    xpReward: 200,
    requirement: { type: "special", value: 50 },
  },
  {
    id: "achievements_75",
    name: "Охотник",
    description: "Разблокируй 75 достижений",
    icon: "🏹",
    category: "collector",
    rarity: "epic",
    xpReward: 350,
    requirement: { type: "special", value: 75 },
  },
  {
    id: "rare_collector",
    name: "Редкий коллекционер",
    description: "Разблокируй 10 редких+ достижений",
    icon: "💎",
    category: "collector",
    rarity: "epic",
    xpReward: 300,
    requirement: { type: "special", value: 10 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VETERAN — Для опытных игроков (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "veteran_30",
    name: "30 дней с нами",
    description: "Аккаунту 30 дней",
    icon: "📅",
    category: "veteran",
    rarity: "uncommon",
    xpReward: 75,
    requirement: { type: "login_days", value: 30 },
  },
  {
    id: "veteran_90",
    name: "90 дней с нами",
    description: "Аккаунту 90 дней",
    icon: "🗓️",
    category: "veteran",
    rarity: "rare",
    xpReward: 150,
    requirement: { type: "login_days", value: 90 },
  },
  {
    id: "veteran_180",
    name: "Полгода с нами",
    description: "Аккаунту 180 дней",
    icon: "🎖️",
    category: "veteran",
    rarity: "epic",
    xpReward: 300,
    requirement: { type: "login_days", value: 180 },
  },
  {
    id: "veteran_365",
    name: "Год с нами",
    description: "Аккаунту 365 дней",
    icon: "🏆",
    category: "veteran",
    rarity: "legendary",
    xpReward: 1000,
    requirement: { type: "login_days", value: 365 },
  },
  {
    id: "og_player",
    name: "OG Игрок",
    description: "Один из первых 100 игроков",
    icon: "👴",
    category: "veteran",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "special", value: 1 },
    secret: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERRAL — Приглашение друзей (5)
  // ═══════════════════════════════════════════════════════════════════════════
  
  {
    id: "referral_1",
    name: "Первый друг",
    description: "Пригласи 1 друга",
    icon: "🤝",
    category: "social",
    rarity: "common",
    xpReward: 25,
    requirement: { type: "referrals_count", value: 1 },
  },
  {
    id: "referral_3",
    name: "Трио",
    description: "Пригласи 3 друзей",
    icon: "👥",
    category: "social",
    rarity: "uncommon",
    xpReward: 50,
    requirement: { type: "referrals_count", value: 3 },
  },
  {
    id: "referral_5",
    name: "Команда",
    description: "Пригласи 5 друзей",
    icon: "🎯",
    category: "social",
    rarity: "rare",
    xpReward: 100,
    requirement: { type: "referrals_count", value: 5 },
  },
  {
    id: "referral_10",
    name: "Лидер",
    description: "Пригласи 10 друзей",
    icon: "⭐",
    category: "social",
    rarity: "epic",
    xpReward: 200,
    requirement: { type: "referrals_count", value: 10 },
  },
  {
    id: "referral_25",
    name: "Амбассадор",
    description: "Пригласи 25 друзей",
    icon: "👑",
    category: "social",
    rarity: "legendary",
    xpReward: 500,
    requirement: { type: "referrals_count", value: 25 },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить достижение по ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * Получить достижения по категории
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Получить достижения по редкости
 */
export function getAchievementsByRarity(rarity: AchievementRarity): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.rarity === rarity);
}

/**
 * Подсчитать общий XP за все достижения
 */
export function getTotalAchievementXP(): number {
  return ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
}

/**
 * Получить статистику достижений
 */
export function getAchievementStats() {
  const byCategory = Object.keys(CATEGORY_INFO).reduce((acc, cat) => {
    acc[cat as AchievementCategory] = ACHIEVEMENTS.filter(a => a.category === cat).length;
    return acc;
  }, {} as Record<AchievementCategory, number>);

  const byRarity = Object.keys(RARITY_INFO).reduce((acc, rar) => {
    acc[rar as AchievementRarity] = ACHIEVEMENTS.filter(a => a.rarity === rar).length;
    return acc;
  }, {} as Record<AchievementRarity, number>);

  return {
    total: ACHIEVEMENTS.length,
    totalXP: getTotalAchievementXP(),
    byCategory,
    byRarity,
    secretCount: ACHIEVEMENTS.filter(a => a.secret).length,
  };
}

// Проверяем что достижений ровно 105 (100 + 5 referral)
if (ACHIEVEMENTS.length !== 105) {
  console.warn(`[Achievements] Expected 105 achievements, got ${ACHIEVEMENTS.length}`);
}
