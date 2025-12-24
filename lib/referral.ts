/**
 * Referral System
 * 
 * Система приглашений друзей с наградами
 * 
 * Награды:
 * - Приглашающий: +50 XP + 1 бонусная энергия за каждого друга
 * - Приглашённый: +25 XP при регистрации
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const REFERRAL_REWARDS = {
  // Награды для приглашающего
  referrer: {
    xp: 50,
    bonusEnergy: 1,
  },
  // Награды для приглашённого
  referred: {
    xp: 25,
  },
} as const;

// Длина реферального кода
const REFERRAL_CODE_LENGTH = 8;

// Символы для генерации кода (без похожих: 0/O, 1/I/l)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Генерация уникального реферального кода
 * 
 * SECURITY: Используем crypto.getRandomValues для криптографически 
 * безопасной генерации вместо Math.random()
 */
export function generateReferralCode(): string {
  // Node.js crypto или Web Crypto API
  const getRandomBytes = (): Uint8Array => {
    if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
      const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
      globalThis.crypto.getRandomValues(bytes);
      return bytes;
    }
    // Fallback for Node.js without webcrypto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto");
    return new Uint8Array(nodeCrypto.randomBytes(REFERRAL_CODE_LENGTH));
  };

  const bytes = getRandomBytes();
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(bytes[i] % CODE_CHARS.length);
  }
  return code;
}

/**
 * Валидация формата реферального кода
 */
export function isValidReferralCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  if (code.length !== REFERRAL_CODE_LENGTH) return false;
  return /^[A-Z0-9]+$/.test(code.toUpperCase());
}

/**
 * Нормализация кода (uppercase, trim)
 */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ReferralStats = {
  referralCode: string;
  referralLink: string;
  referralsCount: number;
  totalXpEarned: number;
  totalEnergyEarned: number;
  referrals: {
    id: number;
    username: string | null;
    firstName: string | null;
    photoUrl: string | null;
    joinedAt: Date;
  }[];
};

export type ReferralResult = {
  success: boolean;
  error?: string;
  reward?: {
    xp: number;
    bonusEnergy?: number;
  };
};
