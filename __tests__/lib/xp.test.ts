import {
  xpForLevel,
  levelFromXp,
  getLevelProgress,
  calculateQuizXp,
  getLevelTitle,
  XP_REWARDS,
  LEVEL_TITLES,
} from '@/lib/xp';

describe('XP System', () => {
  describe('xpForLevel', () => {
    it('should return 0 for level 1', () => {
      expect(xpForLevel(1)).toBe(0);
      expect(xpForLevel(0)).toBe(0);
      expect(xpForLevel(-1)).toBe(0);
    });

    it('should return correct XP for levels', () => {
      // Formula: 50 * level * (level + 1)
      expect(xpForLevel(2)).toBe(300);   // 50 * 2 * 3 = 300
      expect(xpForLevel(3)).toBe(600);   // 50 * 3 * 4 = 600
      expect(xpForLevel(5)).toBe(1500);  // 50 * 5 * 6 = 1500
      expect(xpForLevel(10)).toBe(5500); // 50 * 10 * 11 = 5500
    });
  });

  describe('levelFromXp', () => {
    it('should return level 1 for 0 or negative XP', () => {
      expect(levelFromXp(0)).toBe(1);
      expect(levelFromXp(-100)).toBe(1);
    });

    it('should return correct level for XP values', () => {
      // Level boundaries: L1=0, L2=300, L3=600, L4=1000, L5=1500
      expect(levelFromXp(50)).toBe(1);
      expect(levelFromXp(299)).toBe(1);
      expect(levelFromXp(300)).toBe(2);
      expect(levelFromXp(599)).toBe(2);
      expect(levelFromXp(600)).toBe(3);
      expect(levelFromXp(1499)).toBe(4);
      expect(levelFromXp(1500)).toBe(5);
    });

    it('should handle high XP values', () => {
      expect(levelFromXp(5500)).toBe(10);
      expect(levelFromXp(19000)).toBe(19);
      expect(levelFromXp(100000)).toBeGreaterThan(30);
    });
  });

  describe('getLevelProgress', () => {
    it('should return correct progress at level boundaries', () => {
      const progress = getLevelProgress(0);
      expect(progress.level).toBe(1);
      expect(progress.progress).toBe(0);
    });

    it('should calculate mid-level progress', () => {
      // Level 2 requires 300 XP, Level 3 requires 600 XP
      // At 450 XP: 150 XP into level 2, need 300 total for level
      const progress = getLevelProgress(450);
      expect(progress.level).toBe(2);
      expect(progress.xpInCurrentLevel).toBe(150); // 450 - 300
      expect(progress.xpNeededForNext).toBe(300);  // 600 - 300
      expect(progress.progress).toBe(50);
    });

    it('should cap progress at 100', () => {
      const progress = getLevelProgress(99);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateQuizXp', () => {
    it('should calculate base XP for completing quiz', () => {
      const result = calculateQuizXp({
        correctCount: 0,
        totalQuestions: 5,
        maxStreak: 0,
        isFirstQuizOfDay: false,
      });
      expect(result.base).toBe(XP_REWARDS.QUIZ_COMPLETE);
      expect(result.total).toBe(50);
    });

    it('should add XP for correct answers', () => {
      const result = calculateQuizXp({
        correctCount: 5,
        totalQuestions: 5,
        maxStreak: 0,
        isFirstQuizOfDay: false,
      });
      expect(result.correctAnswers).toBe(50); // 5 * 10
    });

    it('should add perfect bonus for 100%', () => {
      const result = calculateQuizXp({
        correctCount: 5,
        totalQuestions: 5,
        maxStreak: 5,
        isFirstQuizOfDay: false,
      });
      expect(result.perfectBonus).toBe(XP_REWARDS.PERFECT_QUIZ);
    });

    it('should not add perfect bonus for less than 100%', () => {
      const result = calculateQuizXp({
        correctCount: 4,
        totalQuestions: 5,
        maxStreak: 4,
        isFirstQuizOfDay: false,
      });
      expect(result.perfectBonus).toBe(0);
    });

    it('should add daily bonus', () => {
      const result = calculateQuizXp({
        correctCount: 0,
        totalQuestions: 5,
        maxStreak: 0,
        isFirstQuizOfDay: true,
      });
      expect(result.dailyBonus).toBe(XP_REWARDS.FIRST_QUIZ_OF_DAY);
    });

    it('should add streak bonus for 5+', () => {
      const result = calculateQuizXp({
        correctCount: 5,
        totalQuestions: 10,
        maxStreak: 5,
        isFirstQuizOfDay: false,
      });
      expect(result.streakBonus).toBe(XP_REWARDS.STREAK_5);
    });

    it('should add higher streak bonus for 10+', () => {
      const result = calculateQuizXp({
        correctCount: 10,
        totalQuestions: 10,
        maxStreak: 10,
        isFirstQuizOfDay: false,
      });
      expect(result.streakBonus).toBe(XP_REWARDS.STREAK_10);
    });

    it('should calculate total correctly', () => {
      const result = calculateQuizXp({
        correctCount: 5,
        totalQuestions: 5,
        maxStreak: 5,
        isFirstQuizOfDay: true,
      });
      
      const expected = 
        XP_REWARDS.QUIZ_COMPLETE +    // 50
        5 * XP_REWARDS.CORRECT_ANSWER + // 50
        XP_REWARDS.PERFECT_QUIZ +       // 100
        XP_REWARDS.FIRST_QUIZ_OF_DAY +  // 30
        XP_REWARDS.STREAK_5;            // 25
      
      expect(result.total).toBe(expected);
    });
  });

  describe('getLevelTitle', () => {
    it('should return Новичок for level 1-4', () => {
      expect(getLevelTitle(1).title).toBe('Новичок');
      expect(getLevelTitle(4).title).toBe('Новичок');
    });

    it('should return Следопыт for level 5-9', () => {
      expect(getLevelTitle(5).title).toBe('Следопыт');
      expect(getLevelTitle(9).title).toBe('Следопыт');
    });

    it('should return Детектив for level 10-19', () => {
      expect(getLevelTitle(10).title).toBe('Детектив');
      expect(getLevelTitle(19).title).toBe('Детектив');
    });

    it('should return Легенда for level 100+', () => {
      expect(getLevelTitle(100).title).toBe('Легенда');
      expect(getLevelTitle(500).title).toBe('Легенда');
    });

    it('should include icon and color', () => {
      const title = getLevelTitle(10);
      expect(title.icon).toBeDefined();
      expect(title.color).toBeDefined();
    });
  });

  describe('XP_REWARDS constants', () => {
    it('should have correct values', () => {
      expect(XP_REWARDS.QUIZ_COMPLETE).toBe(50);
      expect(XP_REWARDS.CORRECT_ANSWER).toBe(10);
      expect(XP_REWARDS.PERFECT_QUIZ).toBe(100);
      expect(XP_REWARDS.FIRST_QUIZ_OF_DAY).toBe(30);
      expect(XP_REWARDS.STREAK_5).toBe(25);
      expect(XP_REWARDS.STREAK_10).toBe(50);
    });
  });
});

