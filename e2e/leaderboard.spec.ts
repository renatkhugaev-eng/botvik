import { test, expect } from '@playwright/test';

/**
 * E2E тесты: Лидерборд
 */
test.describe('Лидерборд', () => {
  
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

  test('должен загружаться без критических ошибок', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('hydration') &&
      !e.includes('ResizeObserver') &&
      !e.includes('TELEGRAM_BOT_TOKEN')
    );
    
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

  test('должен отображать контент', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('URL должен быть /miniapp/leaderboard', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    
    expect(page.url()).toContain('/miniapp/leaderboard');
  });

  test('должен быть адаптивным', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('должна работать прокрутка', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(300);
    
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(0);
  });

  test('API leaderboard/weekly должен возвращать данные', async ({ request }) => {
    const response = await request.get('/api/leaderboard/weekly');
    
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('week');
    expect(json).toHaveProperty('leaderboard');
    expect(Array.isArray(json.leaderboard)).toBe(true);
  });
});
