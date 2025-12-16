import {
  calculateTotalScore,
  calculateActivityBonus,
  shouldUpdateBestScore,
  getActivityProgress,
  getScoreBreakdown,
  sortLeaderboardEntries,
  formatScore,
  formatScoreBreakdown,
  ACTIVITY_BONUS_PER_GAME,
  MAX_ACTIVITY_BONUS,
  MAX_GAMES_FOR_BONUS,
} from '@/lib/scoring';

describe('Scoring System', () => {
  describe('calculateActivityBonus', () => {
    it('should return 0 for 0 games', () => {
      expect(calculateActivityBonus(0)).toBe(0);
    });

    it('should return correct bonus for games under cap', () => {
      expect(calculateActivityBonus(1)).toBe(50);
      expect(calculateActivityBonus(5)).toBe(250);
      expect(calculateActivityBonus(9)).toBe(450);
    });

    it('should cap at MAX_ACTIVITY_BONUS', () => {
      expect(calculateActivityBonus(10)).toBe(500);
      expect(calculateActivityBonus(15)).toBe(500);
      expect(calculateActivityBonus(100)).toBe(500);
    });
  });

  describe('calculateTotalScore', () => {
    it('should add bestScore and activityBonus', () => {
      expect(calculateTotalScore(1000, 0)).toBe(1000);
      expect(calculateTotalScore(1000, 5)).toBe(1250);
      expect(calculateTotalScore(1500, 10)).toBe(2000);
    });

    it('should cap activity bonus at 500', () => {
      expect(calculateTotalScore(1500, 20)).toBe(2000);
    });

    it('should handle edge cases', () => {
      expect(calculateTotalScore(0, 0)).toBe(0);
      expect(calculateTotalScore(0, 10)).toBe(500);
    });
  });

  describe('shouldUpdateBestScore', () => {
    it('should return true when new score is higher', () => {
      expect(shouldUpdateBestScore(100, 150)).toBe(true);
      expect(shouldUpdateBestScore(0, 1)).toBe(true);
    });

    it('should return false when new score is equal or lower', () => {
      expect(shouldUpdateBestScore(100, 100)).toBe(false);
      expect(shouldUpdateBestScore(100, 50)).toBe(false);
    });
  });

  describe('getActivityProgress', () => {
    it('should return correct progress for 0 games', () => {
      const progress = getActivityProgress(0);
      expect(progress.currentBonus).toBe(0);
      expect(progress.maxBonus).toBe(500);
      expect(progress.gamesUntilMax).toBe(10);
      expect(progress.progressPercent).toBe(0);
      expect(progress.isMaxed).toBe(false);
    });

    it('should return correct progress for partial games', () => {
      const progress = getActivityProgress(5);
      expect(progress.currentBonus).toBe(250);
      expect(progress.gamesUntilMax).toBe(5);
      expect(progress.progressPercent).toBe(50);
      expect(progress.isMaxed).toBe(false);
    });

    it('should return maxed status for 10+ games', () => {
      const progress = getActivityProgress(10);
      expect(progress.currentBonus).toBe(500);
      expect(progress.gamesUntilMax).toBe(0);
      expect(progress.progressPercent).toBe(100);
      expect(progress.isMaxed).toBe(true);

      const progressOver = getActivityProgress(15);
      expect(progressOver.isMaxed).toBe(true);
    });
  });

  describe('getScoreBreakdown', () => {
    it('should return correct breakdown', () => {
      const breakdown = getScoreBreakdown(1500, 5);
      expect(breakdown.bestScore).toBe(1500);
      expect(breakdown.activityBonus).toBe(250);
      expect(breakdown.totalScore).toBe(1750);
      expect(breakdown.gamesPlayed).toBe(5);
      expect(breakdown.gamesUntilMaxBonus).toBe(5);
    });

    it('should handle maxed bonus', () => {
      const breakdown = getScoreBreakdown(2000, 15);
      expect(breakdown.activityBonus).toBe(500);
      expect(breakdown.gamesUntilMaxBonus).toBe(0);
    });
  });

  describe('sortLeaderboardEntries', () => {
    it('should sort by totalScore descending', () => {
      const entries = [
        { bestScore: 1000, attempts: 2 },
        { bestScore: 500, attempts: 10 },
        { bestScore: 1500, attempts: 0 },
      ];
      
      const sorted = sortLeaderboardEntries(entries);
      
      // 1500 + 0 = 1500
      // 1000 + 100 = 1100
      // 500 + 500 = 1000
      expect(sorted[0].totalScore).toBe(1500);
      expect(sorted[1].totalScore).toBe(1100);
      expect(sorted[2].totalScore).toBe(1000);
    });

    it('should handle quizzes field as alternative to attempts', () => {
      const entries = [
        { bestScore: 1000, quizzes: 5 },
      ];
      
      const sorted = sortLeaderboardEntries(entries);
      expect(sorted[0].totalScore).toBe(1250);
    });
  });

  describe('formatScore', () => {
    it('should format numbers with Russian locale', () => {
      expect(formatScore(1000)).toMatch(/1[\s ]?000/);
      expect(formatScore(1500000)).toMatch(/1[\s ]?500[\s ]?000/);
    });

    it('should handle small numbers', () => {
      expect(formatScore(100)).toBe('100');
      expect(formatScore(0)).toBe('0');
    });
  });

  describe('formatScoreBreakdown', () => {
    it('should show bonus when present', () => {
      const breakdown = getScoreBreakdown(1500, 5);
      const formatted = formatScoreBreakdown(breakdown);
      expect(formatted).toContain('бонус');
    });

    it('should not show bonus when zero', () => {
      const breakdown = getScoreBreakdown(1500, 0);
      const formatted = formatScoreBreakdown(breakdown);
      expect(formatted).not.toContain('бонус');
    });
  });

  describe('Constants', () => {
    it('should have correct values', () => {
      expect(ACTIVITY_BONUS_PER_GAME).toBe(50);
      expect(MAX_ACTIVITY_BONUS).toBe(500);
      expect(MAX_GAMES_FOR_BONUS).toBe(10);
    });
  });
});

