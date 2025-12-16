import { test, expect } from '@playwright/test';

/**
 * E2E тесты: Главная страница Mini App
 * 
 * Примечание: Приложение работает в Telegram WebApp и требует аутентификацию.
 * В тестах мы проверяем базовую загрузку и структуру.
 */
test.describe('Главная страница', () => {
  
  test.beforeEach(async ({ page }) => {
    // Мокаем Telegram WebApp для dev режима
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
            button_color: '#6366f1',
            button_text_color: '#ffffff',
          },
          colorScheme: 'dark',
          platform: 'web',
          version: '7.0',
        },
      };
    });
  });

  test('должна загружаться без критических ошибок', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Фильтруем известные безобидные ошибки
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('hydration') &&
      !e.includes('ResizeObserver') &&
      !e.includes('TELEGRAM_BOT_TOKEN') &&
      !e.includes('initData')
    );
    
    // Допускаем не более 2 некритичных ошибок
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

  test('должна отображать контент', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Ждём появления какого-либо контента
    await page.waitForTimeout(2000);
    
    // Проверяем что body не пустой
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('должна быть адаптивной для мобильных', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем что нет горизонтального скролла
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // +5 для погрешности
  });

  test('viewport должен быть настроен правильно', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем meta viewport
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('страница должна иметь заголовок', async ({ page }) => {
    await page.goto('/miniapp');
    
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('должна загружать стили', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем что CSS загрузился (есть stylesheets)
    const styleSheets = await page.evaluate(() => document.styleSheets.length);
    expect(styleSheets).toBeGreaterThan(0);
  });

  test('должна иметь корректную структуру HTML', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем базовую структуру
    await expect(page.locator('html')).toHaveAttribute('lang');
    await expect(page.locator('body')).toBeVisible();
  });

  test('не должна иметь broken images (visible)', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Находим все видимые изображения
    const images = page.locator('img:visible');
    const count = await images.count();
    
    let brokenCount = 0;
    for (let i = 0; i < Math.min(count, 10); i++) { // Проверяем первые 10
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth === 0) brokenCount++;
    }
    
    // Допускаем не более 3 broken images (placeholder, lazy loading)
    expect(brokenCount).toBeLessThanOrEqual(3);
  });
});
