import { parseInitData, validateInitData } from '@/lib/telegram';

describe('Telegram Utilities', () => {
  describe('parseInitData', () => {
    it('should parse URL-encoded initData', () => {
      const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890&hash=abc123';
      const parsed = parseInitData(initData);
      
      expect(parsed.user).toBe('{"id":123}');
      expect(parsed.auth_date).toBe('1234567890');
      expect(parsed.hash).toBe('abc123');
    });

    it('should handle empty string', () => {
      const parsed = parseInitData('');
      expect(Object.keys(parsed).length).toBe(0);
    });

    it('should handle multiple parameters', () => {
      const initData = 'query_id=AAGhX&user=%7B%22id%22%3A123%7D&auth_date=1234567890';
      const parsed = parseInitData(initData);
      
      expect(parsed.query_id).toBe('AAGhX');
      expect(parsed.user).toBeDefined();
      expect(parsed.auth_date).toBe('1234567890');
    });
  });

  describe('validateInitData', () => {
    it('should return error for empty initData', () => {
      const result = validateInitData('', 'bot_token');
      expect(result.ok).toBe(false);
    });

    it('should return error for missing hash', () => {
      const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890';
      const result = validateInitData(initData, 'bot_token');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('HASH');
      }
    });

    it('should return error for invalid hash', () => {
      // Hash validation happens before expiration check
      const initData = 'user=%7B%22id%22%3A123%7D&auth_date=86400&hash=fakehash';
      const result = validateInitData(initData, 'bot_token');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('HASH');
      }
    });

    // Note: Testing actual HMAC validation requires knowing the bot token
    // In production, you'd mock crypto functions or use test fixtures
  });
});

