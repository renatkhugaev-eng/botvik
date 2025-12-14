/**
 * XP System Constants and Utilities
 * 
 * Система опыта для прогрессии игрока (отдельно от очков лидерборда)
 */

// ═══════════════════════════════════════════════════════════════════
// XP REWARDS
// ═══════════════════════════════════════════════════════════════════

export const XP_REWARDS = {
  QUIZ_COMPLETE: 50,       // Завершить квиз
  CORRECT_ANSWER: 10,      // За каждый правильный ответ
  PERFECT_QUIZ: 100,       // Бонус за 100% правильных
  FIRST_QUIZ_OF_DAY: 30,   // Первый квиз дня
  STREAK_5: 25,            // Серия 5+
  STREAK_10: 50,           // Серия 10 (заменяет STREAK_5)
} as const;

// ═══════════════════════════════════════════════════════════════════
// LEVEL CURVE
// ═══════════════════════════════════════════════════════════════════

/**
 * XP needed to reach a specific level
 * Formula: 50 * level * (level + 1)
 * 
 * Level 1  → 0 XP
 * Level 2  → 100 XP
 * Level 3  → 300 XP
 * Level 5  → 1,000 XP
 * Level 10 → 4,500 XP
 * Level 20 → 19,000 XP
 * Level 50 → 122,500 XP
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * (level + 1);
}

/**
 * Calculate level from total XP
 */
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  
  // Solve: 50 * level * (level + 1) = xp
  // level^2 + level - xp/50 = 0
  // Using quadratic formula: (-1 + sqrt(1 + 4*xp/50)) / 2
  const discriminant = 1 + (4 * xp) / 50;
  const level = Math.floor((-1 + Math.sqrt(discriminant)) / 2);
  
  return Math.max(1, level);
}

/**
 * Get level progress info
 */
export function getLevelProgress(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0-100
  xpInCurrentLevel: number;
  xpNeededForNext: number;
} {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progress = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100));
  
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progress,
    xpInCurrentLevel,
    xpNeededForNext,
  };
}

// ═══════════════════════════════════════════════════════════════════
// XP CALCULATION
// ═══════════════════════════════════════════════════════════════════

export type XpBreakdown = {
  base: number;
  correctAnswers: number;
  perfectBonus: number;
  dailyBonus: number;
  streakBonus: number;
  total: number;
};

/**
 * Calculate XP earned from a quiz session
 */
export function calculateQuizXp(params: {
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
  isFirstQuizOfDay: boolean;
}): XpBreakdown {
  const { correctCount, totalQuestions, maxStreak, isFirstQuizOfDay } = params;
  
  // Base XP for completing
  const base = XP_REWARDS.QUIZ_COMPLETE;
  
  // XP per correct answer
  const correctAnswers = correctCount * XP_REWARDS.CORRECT_ANSWER;
  
  // Perfect quiz bonus (100%)
  const perfectBonus = (correctCount === totalQuestions && totalQuestions > 0) 
    ? XP_REWARDS.PERFECT_QUIZ 
    : 0;
  
  // Daily bonus
  const dailyBonus = isFirstQuizOfDay ? XP_REWARDS.FIRST_QUIZ_OF_DAY : 0;
  
  // Streak bonus (only highest tier counts)
  let streakBonus = 0;
  if (maxStreak >= 10) {
    streakBonus = XP_REWARDS.STREAK_10;
  } else if (maxStreak >= 5) {
    streakBonus = XP_REWARDS.STREAK_5;
  }
  
  const total = base + correctAnswers + perfectBonus + dailyBonus + streakBonus;
  
  return {
    base,
    correctAnswers,
    perfectBonus,
    dailyBonus,
    streakBonus,
    total,
  };
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL TITLES
// ═══════════════════════════════════════════════════════════════════

export const LEVEL_TITLES = [
  { min: 1, max: 4, title: "Новичок", icon: "🌱", color: "from-slate-400 to-slate-500" },
  { min: 5, max: 9, title: "Следопыт", icon: "🎯", color: "from-emerald-500 to-teal-600" },
  { min: 10, max: 19, title: "Детектив", icon: "🔍", color: "from-blue-500 to-indigo-600" },
  { min: 20, max: 34, title: "Инспектор", icon: "🔮", color: "from-violet-500 to-purple-600" },
  { min: 35, max: 49, title: "Профайлер", icon: "🕵️", color: "from-pink-500 to-rose-600" },
  { min: 50, max: 99, title: "Мастер", icon: "⚡", color: "from-amber-400 to-orange-500" },
  { min: 100, max: Infinity, title: "Легенда", icon: "👑", color: "from-yellow-400 to-amber-500" },
] as const;

export function getLevelTitle(level: number): {
  title: string;
  icon: string;
  color: string;
} {
  for (const tier of LEVEL_TITLES) {
    if (level >= tier.min && level <= tier.max) {
      return { title: tier.title, icon: tier.icon, color: tier.color };
    }
  }
  return { title: "Новичок", icon: "🌱", color: "from-slate-400 to-slate-500" };
}

