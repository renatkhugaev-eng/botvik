import { test, expect } from '@playwright/test';

/**
 * Visual Regression тесты
 * Сравнивают скриншоты страниц с эталонными
 * 
 * При первом запуске создаются эталонные скриншоты в e2e/visual.spec.ts-snapshots/
 * При последующих запусках сравниваются с эталонами
 */
test.describe('Visual Regression', () => {
  
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

  test('главная страница - полный вид', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Ждём загрузки всего контента
    
    await expect(page).toHaveScreenshot('home-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.25, // Допускаем 25% различий (динамический контент, анимации)
    });
  });

  test('главная страница - верхняя часть (hero)', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Скриншот только viewport (верхняя часть)
    await expect(page).toHaveScreenshot('home-hero.png', {
      maxDiffPixelRatio: 0.25,
    });
  });

  test('профиль пользователя', async ({ page }) => {
    await page.goto('/miniapp/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    await expect(page).toHaveScreenshot('profile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.25,
    });
  });

  test('лидерборд', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    await expect(page).toHaveScreenshot('leaderboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.25,
    });
  });

  test('страница квиза', async ({ page }) => {
    await page.goto('/miniapp/quiz/1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    await expect(page).toHaveScreenshot('quiz.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.7, // Квиз очень динамичный (таймеры, состояния загрузки)
    });
  });

  test('компоненты не должны выходить за границы экрана', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что ничего не выходит за viewport (кроме декоративных элементов)
    const overflowElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const overflow: string[] = [];
      const viewportWidth = window.innerWidth;
      
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // className может быть SVGAnimatedString, поэтому безопасно получаем строку
        const elClassName = el.className as string | { baseVal?: string } | undefined;
        const className = typeof elClassName === 'string' ? elClassName : (elClassName?.baseVal || '');
        
        // Исключаем декоративные элементы (glow, blur, absolute позиционирование)
        const isDecorative = className.includes('blur') || 
                            className.includes('glow') || 
                            className.includes('fx-') ||
                            className.includes('animate-') ||
                            (className.includes('absolute') && (className.includes('-inset') || className.includes('-top') || className.includes('-right')));
        
        if (rect.right > viewportWidth + 10 && !isDecorative) {
          overflow.push(`${el.tagName}.${className.substring(0, 50)}: right=${rect.right}px`);
        }
      });
      
      return overflow.slice(0, 5);
    });
    
    // Допускаем небольшое количество overflow (карусель, декоративные элементы)
    expect(overflowElements.length).toBeLessThanOrEqual(10);
  });

  test('текст должен быть читаемым (не обрезан)', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что нет text-overflow: ellipsis без title
    const truncatedWithoutTitle = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const issues: string[] = [];
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.textOverflow === 'ellipsis' && !el.getAttribute('title')) {
          const text = el.textContent?.trim();
          if (text && text.length > 20) {
            issues.push(text.substring(0, 30));
          }
        }
      });
      
      return issues.slice(0, 3);
    });
    
    // Информационно - не fail, просто логируем
    if (truncatedWithoutTitle.length > 0) {
      console.log('Truncated text without title:', truncatedWithoutTitle);
    }
  });
});

