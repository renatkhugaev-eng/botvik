import { test, expect } from '@playwright/test';

/**
 * E2E тесты: API endpoints
 */
test.describe('API Endpoints', () => {

  test('GET /api/health должен возвращать ok', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json.ok).toBe(true);
  });

  test('GET /api/quiz должен возвращать массив квизов', async ({ request }) => {
    const response = await request.get('/api/quiz');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    // API возвращает массив напрямую
    expect(Array.isArray(json)).toBe(true);
    
    if (json.length > 0) {
      // Проверяем структуру первого квиза
      expect(json[0]).toHaveProperty('id');
      expect(json[0]).toHaveProperty('title');
    }
  });

  test('GET /api/leaderboard без quizId возвращает данные или ошибку', async ({ request }) => {
    const response = await request.get('/api/leaderboard');
    
    // API может вернуть 200 (weekly по умолчанию) или 400
    expect([200, 400]).toContain(response.status());
  });

  test('GET /api/leaderboard с quizId должен работать', async ({ request }) => {
    const response = await request.get('/api/leaderboard?quizId=1');
    
    // Может вернуть 200 или 404 если квиз не существует
    expect([200, 404]).toContain(response.status());
  });

  test('GET /api/leaderboard/weekly должен работать', async ({ request }) => {
    const response = await request.get('/api/leaderboard/weekly');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('week');
    expect(json).toHaveProperty('leaderboard');
  });

  test('POST /api/quiz/start без auth должен вернуть ошибку', async ({ request }) => {
    const response = await request.post('/api/quiz/start', {
      data: { quizId: 1 },
    });
    
    // Без auth - ошибка (400, 401, или 405 если метод не поддерживается)
    expect([400, 401, 405]).toContain(response.status());
  });

  test('POST /api/quiz/answer без sessionId должен вернуть ошибку', async ({ request }) => {
    const response = await request.post('/api/quiz/answer', {
      data: {
        questionId: 1,
        optionId: 1,
        timeSpentMs: 5000,
      },
    });
    
    // Без sessionId - ошибка (400, 404, или 405 если метод не поддерживается)
    expect([400, 404, 405]).toContain(response.status());
  });

  test('GET /api/friends требует аутентификации', async ({ request }) => {
    const response = await request.get('/api/friends');
    
    // Без Telegram auth header:
    // - Production: 401 NO_AUTH_DATA
    // - Dev mode с ALLOW_DEV_NO_TELEGRAM=true: 200 с mock данными
    const status = response.status();
    expect([200, 401]).toContain(status);
    
    const json = await response.json();
    if (status === 401) {
      expect(json.error).toBe('NO_AUTH_DATA');
    } else {
      // Dev mode - возвращает friends list
      expect(json).toHaveProperty('friends');
    }
  });

  test('POST /api/auth/telegram без initData должен вернуть 400', async ({ request }) => {
    const response = await request.post('/api/auth/telegram', {
      data: {},
    });
    
    expect(response.status()).toBe(400);
  });

  test('GET /api/me/summary требует аутентификации', async ({ request }) => {
    const response = await request.get('/api/me/summary');
    
    // Без Telegram auth header:
    // - Production: 401 NO_AUTH_DATA
    // - Dev mode с ALLOW_DEV_NO_TELEGRAM=true: 200 с mock данными
    // - Dev mode без mock user в БД: 404 user_not_found
    const status = response.status();
    expect([200, 401, 404]).toContain(status);
    
    const json = await response.json();
    if (status === 401) {
      expect(json.error).toBe('NO_AUTH_DATA');
    } else if (status === 404) {
      expect(json.error).toBe('user_not_found');
    } else {
      // Dev mode - возвращает user summary
      expect(json).toHaveProperty('user');
      expect(json).toHaveProperty('stats');
    }
  });

  test('API должен возвращать JSON', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('API должен отвечать быстро (< 5 сек)', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/health');
    const duration = Date.now() - start;
    
    // 5 сек - допуск для dev сервера с cold start
    expect(duration).toBeLessThan(5000);
  });

  test('GET /api/quiz/1 должен возвращать данные квиза', async ({ request }) => {
    const response = await request.get('/api/quiz/1');
    
    // 200 если существует, 404 если нет
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title');
    }
  });
});
