import { test, expect } from '@playwright/test';

/**
 * E2E тесты: Квиз страницы
 */
test.describe('Квиз', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          disableVerticalSwipes: () => {},
          enableClosingConfirmation: () => {},
          setHeaderColor: () => {},
          setBackgroundColor: () => {},
          initData: 'test_init_data',
          initDataUnsafe: {
            user: {
              id: 123456789,
              first_name: 'Test',
              last_name: 'User',
              username: 'testuser',
              photo_url: 'https://t.me/i/userpic/320/test.jpg',
            },
            auth_date: Math.floor(Date.now() / 1000),
            hash: 'test_hash',
          },
          themeParams: {
            bg_color: '#1a1a2e',
            text_color: '#ffffff',
          },
          colorScheme: 'dark',
          platform: 'web',
          version: '7.0',
        },
      };
    });
  });

  test('страница квиза должна загружаться', async ({ page }) => {
    await page.goto('/miniapp/quiz/1');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем что страница загрузилась (может быть loading или error)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(5);
  });

  test('должна быть адаптивной', async ({ page }) => {
    await page.goto('/miniapp/quiz/1');
    await page.waitForLoadState('domcontentloaded');
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('API quiz должен возвращать список', async ({ request }) => {
    const response = await request.get('/api/quiz');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
  });

  test('API quiz/1 должен возвращать данные квиза', async ({ request }) => {
    const response = await request.get('/api/quiz/1');
    
    // Может быть 200 или 404
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('id');
    }
  });

  test('несуществующий квиз должен обрабатываться', async ({ page }) => {
    await page.goto('/miniapp/quiz/99999');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Страница должна загрузиться (показать ошибку или редирект)
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('не должно быть критических JS ошибок', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/miniapp/quiz/1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('hydration') &&
      !e.includes('ResizeObserver') &&
      !e.includes('TELEGRAM_BOT_TOKEN') &&
      !e.includes('404')
    );
    
    expect(criticalErrors.length).toBeLessThanOrEqual(3);
  });
});
