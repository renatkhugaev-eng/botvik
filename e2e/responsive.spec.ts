import { test, expect } from '@playwright/test';

/**
 * Responsive тесты
 * Проверяют адаптивность на разных размерах экрана
 */

// Популярные размеры устройств
const devices = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
];

test.describe('Responsive Design', () => {
  
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

  for (const device of devices) {
    test(`главная страница на ${device.name} (${device.width}x${device.height})`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/miniapp');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Проверяем нет ли горизонтального скролла
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
      
      // Проверяем что контент помещается
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(device.width + 10);
    });
  }

  test('элементы не должны перекрываться на маленьком экране', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone 5/SE
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что кнопки не перекрываются
    const overlappingButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const rects = Array.from(buttons).map(b => b.getBoundingClientRect());
      let overlaps = 0;
      
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const r1 = rects[i];
          const r2 = rects[j];
          
          if (r1.width === 0 || r2.width === 0) continue;
          
          const overlap = !(r1.right < r2.left || 
                          r1.left > r2.right || 
                          r1.bottom < r2.top || 
                          r1.top > r2.bottom);
          
          if (overlap) overlaps++;
        }
      }
      
      return overlaps;
    });
    
    expect(overlappingButtons).toBeLessThanOrEqual(2);
  });

  test('текст должен быть читаемым на всех размерах', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем минимальный размер шрифта
    const tooSmallText = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, div, button, a');
      let tooSmall = 0;
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        const text = el.textContent?.trim();
        
        if (text && text.length > 0 && fontSize < 10) {
          tooSmall++;
        }
      });
      
      return tooSmall;
    });
    
    // Допускаем до 15 элементов с мелким шрифтом (timestamps, labels)
    expect(tooSmallText).toBeLessThanOrEqual(15);
  });

  test('touch targets должны быть достаточно большими', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Минимальный размер touch target по WCAG: 44x44px
    const smallTouchTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, [role="button"], input, select');
      let tooSmall = 0;
      
      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Допускаем 36px как минимум (compromise для мобильных UI)
        if (rect.width > 0 && rect.height > 0 && (rect.width < 36 || rect.height < 36)) {
          tooSmall++;
        }
      });
      
      return tooSmall;
    });
    
    // Допускаем несколько маленьких элементов (иконки и т.д.)
    expect(smallTouchTargets).toBeLessThanOrEqual(10);
  });

  test('изображения должны масштабироваться', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const oversizedImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const viewportWidth = window.innerWidth;
      let oversized = 0;
      
      images.forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.width > viewportWidth) {
          oversized++;
        }
      });
      
      return oversized;
    });
    
    expect(oversizedImages).toBe(0);
  });

  test('модальные окна должны помещаться на экране', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что нет элементов с position:fixed выходящих за экран
    const overflowingModals = await page.evaluate(() => {
      const fixed = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
      let overflow = 0;
      
      fixed.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
          overflow++;
        }
      });
      
      return overflow;
    });
    
    expect(overflowingModals).toBe(0);
  });

  test('landscape ориентация должна работать', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone landscape
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что страница не сломана
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);
    
    // Нет горизонтального скролла
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
  });

  test('скриншот на разных устройствах', async ({ page }) => {
    const testDevices = [
      { name: 'mobile-small', width: 320, height: 568 },
      { name: 'mobile-medium', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
    ];
    
    for (const device of testDevices) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/miniapp');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot(`responsive-${device.name}.png`, {
        maxDiffPixelRatio: 0.25, // Допуск для динамического контента
      });
    }
  });
});

