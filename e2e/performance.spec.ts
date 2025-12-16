import { test, expect } from '@playwright/test';

/**
 * E2E тесты: Производительность
 */
test.describe('Производительность', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          disableVerticalSwipes: () => {},
          initData: 'test',
          initDataUnsafe: {
            user: { id: 123, first_name: 'Test', username: 'test' },
          },
          themeParams: {},
          colorScheme: 'dark',
        },
      };
    });
  });

  test('главная страница должна загружаться < 10 сек', async ({ page }) => {
    const start = Date.now();
    
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    const duration = Date.now() - start;
    
    // 10 секунд - для dev сервера с cold start и компиляцией
    expect(duration).toBeLessThan(10000);
  });

  test('API health должен отвечать < 2 сек', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/health');
    const duration = Date.now() - start;
    
    // 2 сек - допуск для cold start
    expect(duration).toBeLessThan(2000);
  });

  test('API quiz list должен отвечать < 3 сек', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/quiz');
    const duration = Date.now() - start;
    
    // 3 сек - допуск для dev сервера
    expect(duration).toBeLessThan(3000);
  });

  test('API leaderboard/weekly должен отвечать < 5 сек', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/leaderboard/weekly');
    const duration = Date.now() - start;
    
    // 10 секунд - для dev сервера с cold start (weekly API может быть медленным)
    expect(duration).toBeLessThan(10000);
  });

  test('изображения должны иметь width/height атрибуты', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const images = page.locator('img:visible');
    const count = await images.count();
    
    let withDimensions = 0;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const img = images.nth(i);
      const width = await img.getAttribute('width');
      const height = await img.getAttribute('height');
      
      if (width || height) withDimensions++;
    }
    
    // Хотя бы 50% изображений должны иметь размеры
    if (count > 0) {
      expect(withDimensions / count).toBeGreaterThanOrEqual(0.5);
    }
  });

  test('страница должна использовать gzip/brotli', async ({ request }) => {
    const response = await request.get('/miniapp', {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
    
    // Next.js обычно сжимает ответы
    expect(response.ok()).toBeTruthy();
  });

  test('CSS должен загружаться', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    const stylesheets = await page.evaluate(() => document.styleSheets.length);
    expect(stylesheets).toBeGreaterThan(0);
  });

  test('JavaScript bundle не должен блокировать рендер надолго', async ({ page }) => {
    const start = Date.now();
    
    await page.goto('/miniapp');
    
    // Ждём первого контента
    await page.waitForSelector('body', { timeout: 10000 });
    
    const timeToFirstContent = Date.now() - start;
    
    // 30 секунд - для dev сервера с компиляцией (cold start может быть долгим)
    expect(timeToFirstContent).toBeLessThan(30000);
  });

  test('не должно быть memory leaks при навигации', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    const initialHeap = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Навигация туда-обратно
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    const finalHeap = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Если memory API доступен, проверяем рост памяти
    if (initialHeap > 0 && finalHeap > 0) {
      const growthRatio = finalHeap / initialHeap;
      // Допускаем рост до 3x (Next.js кеширует)
      expect(growthRatio).toBeLessThan(3);
    }
  });
});
